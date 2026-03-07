import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getLinePaySandboxCredentials, confirmLinePayPayment } from "@/lib/linepay";

/**
 * LINE Pay 使用者完成授權後會導向此 confirmUrl，並帶上 transactionId、orderId（= 我們的 booking id）。
 * 流程：從 URL 取得 transactionId / orderId → 呼叫 LINE Pay Confirm API →
 * 使用 Supabase Service Role 將對應訂單 status 更新為 paid、寫入 line_pay_transaction_id → 導向報名成功頁。
 * 訂單 ID 可從 orderId、bookingId、id 任一 query 參數讀取。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const transactionId = searchParams.get("transactionId");
  const orderIdRaw =
    searchParams.get("orderId") || searchParams.get("bookingId") || searchParams.get("id");
  const orderId = typeof orderIdRaw === "string" ? orderIdRaw.trim() : "";

  const baseUrl =
    (typeof process.env.NEXT_PUBLIC_BASE_URL === "string" && process.env.NEXT_PUBLIC_BASE_URL.trim()) || "";
  const redirectFail = (msg: string, detail?: string) => {
    const params = new URLSearchParams({ error: "linepay_confirm", message: msg });
    if (detail) params.set("detail", detail);
    return NextResponse.redirect(`${baseUrl || "/"}?${params.toString()}`);
  };
  const redirectNoId = () =>
    NextResponse.redirect(`${baseUrl || "/"}?error=no_id_provided`);

  if (!orderId) {
    return redirectNoId();
  }

  if (!transactionId) {
    return redirectFail("缺少交易參數", "缺少 transactionId");
  }

  const supabase = createServerSupabase();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, merchant_id, class_id, order_amount, status, payment_method")
    .eq("id", orderId)
    .single();

  if (bookingError || !booking) {
    return redirectFail("訂單不存在", bookingError?.message ?? "");
  }

  if (booking.status !== "unpaid" || booking.payment_method !== "linepay") {
    return redirectFail("訂單狀態不允許確認付款", `status=${booking.status} payment_method=${booking.payment_method}`);
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
    const slug = (booking as { class_id?: string }).class_id || "course";
    const failUrl = `${baseUrl}/course/${slug}/checkout?error=linepay_confirm&message=${encodeURIComponent("支付失敗，請重新嘗試")}`;
    return NextResponse.redirect(failUrl);
  }

  const updatePayload: { status: "paid"; line_pay_transaction_id: string } = {
    status: "paid",
    line_pay_transaction_id: transactionId,
  };
  const { data: updateData, error: updateError } = await supabase
    .from("bookings")
    .update(updatePayload)
    .eq("id", orderId)
    .eq("merchant_id", booking.merchant_id)
    .eq("status", "unpaid")
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("[LINE Pay Confirm] 更新訂單失敗:", updateError.message, updateError);
    return redirectFail("更新訂單狀態失敗", updateError.message);
  }
  if (!updateData) {
    return redirectFail("更新訂單狀態失敗", "無符合條件的訂單（可能已被更新）");
  }

  revalidatePath("/member");

  const successUrl = `${baseUrl}/booking/success?bookingId=${encodeURIComponent(orderId)}`;
  return NextResponse.redirect(successUrl);
}
