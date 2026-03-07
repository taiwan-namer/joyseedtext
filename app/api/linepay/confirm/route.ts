import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getLinePaySandboxCredentials, confirmLinePayPayment } from "@/lib/linepay";

/**
 * LINE Pay 使用者完成授權後會導向此 confirmUrl，並帶上 transactionId、orderId（= 我們的 booking id）。
 * 流程：從 URL 取得 transactionId / orderId → 呼叫 LINE Pay Confirm API →
 * 使用 Supabase Service Role 將對應訂單 status 更新為 paid、並寫入 line_pay_transaction_id → 導向報名成功頁。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const transactionId = searchParams.get("transactionId");
  const orderId = searchParams.get("orderId");

  const baseUrl =
    (typeof process.env.NEXT_PUBLIC_BASE_URL === "string" && process.env.NEXT_PUBLIC_BASE_URL.trim()) || "";
  const redirectFail = (msg: string) =>
    NextResponse.redirect(`${baseUrl || "/"}?error=linepay_confirm&message=${encodeURIComponent(msg)}`);

  if (!transactionId || !orderId) {
    return redirectFail("缺少交易參數");
  }

  const supabase = createServerSupabase();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, merchant_id, order_amount, status, payment_method")
    .eq("id", orderId)
    .single();

  if (bookingError || !booking) {
    return redirectFail("訂單不存在");
  }

  if (booking.status !== "unpaid" || booking.payment_method !== "linepay") {
    return redirectFail("訂單狀態不允許確認付款");
  }

  const amount = typeof booking.order_amount === "number" && booking.order_amount >= 0
    ? booking.order_amount
    : 0;
  if (amount <= 0) {
    return redirectFail("訂單金額異常");
  }

  const { data: settingsRow, error: settingsError } = await supabase
    .from("store_settings")
    .select("frontend_settings")
    .eq("merchant_id", booking.merchant_id)
    .maybeSingle();

  if (settingsError || !settingsRow?.frontend_settings) {
    return redirectFail("店家金流未設定");
  }

  const raw = settingsRow.frontend_settings as Record<string, unknown>;
  const linePayApi = typeof raw.linePayApi === "string" ? raw.linePayApi : null;
  const creds = getLinePaySandboxCredentials(linePayApi);

  if (!creds) {
    return redirectFail("LINE Pay 未設定（請設定 .env 或後台金流）");
  }

  const confirmRes = await confirmLinePayPayment({
    channelId: creds.channelId,
    channelSecret: creds.channelSecret,
    transactionId,
    amount,
    currency: "TWD",
  });

  if (!confirmRes.success) {
    return redirectFail(confirmRes.returnMessage || "付款確認失敗");
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: "paid", line_pay_transaction_id: transactionId })
    .eq("id", orderId)
    .eq("merchant_id", booking.merchant_id)
    .eq("status", "unpaid");

  if (updateError) {
    return redirectFail("更新訂單狀態失敗");
  }

  revalidatePath("/member");

  const successUrl = `${baseUrl}/booking/success?bookingId=${encodeURIComponent(orderId)}`;
  return NextResponse.redirect(successUrl);
}
