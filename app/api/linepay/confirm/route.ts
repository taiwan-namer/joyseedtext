import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getLinePaySandboxCredentials, confirmLinePayPayment } from "@/lib/linepay";

/** 手動測試用：transactionId 為此值時不呼叫 LINE Pay Confirm API，僅將訂單改為 paid 並導向成功頁。
 * 訂單 ID 可從 orderId、bookingId、id 任一參數讀取。
 * 測試網址格式：{BASE_URL}/api/linepay/confirm?transactionId=TEST12345&orderId={訂單UUID}
 * 或：?transactionId=TEST12345&bookingId={訂單UUID} 或 &id={訂單UUID}
 */
const LINE_PAY_CONFIRM_TEST_TRANSACTION_ID = "TEST12345";

/**
 * LINE Pay 使用者完成授權後會導向此 confirmUrl，並帶上 transactionId、orderId（= 我們的 booking id）。
 * 流程：從 URL 取得 transactionId / orderId → 呼叫 LINE Pay Confirm API（測試時可略過）→
 * 使用 Supabase Service Role 將對應訂單 status 更新為 paid、並寫入 line_pay_transaction_id → 導向報名成功頁。
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const transactionId = searchParams.get("transactionId");
  const orderIdRaw =
    searchParams.get("orderId") || searchParams.get("bookingId") || searchParams.get("id");
  const orderId = typeof orderIdRaw === "string" ? orderIdRaw.trim() : "";

  console.log("[LINE Pay Confirm] API 收到參數:", {
    transactionId,
    orderId,
    raw: { orderId: searchParams.get("orderId"), bookingId: searchParams.get("bookingId"), id: searchParams.get("id") },
  });

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

  const isTestMode = transactionId === LINE_PAY_CONFIRM_TEST_TRANSACTION_ID;
  if (!isTestMode && !transactionId) {
    return redirectFail("缺少交易參數", "缺少 transactionId");
  }

  const supabase = createServerSupabase();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, merchant_id, order_amount, status, payment_method")
    .eq("id", orderId)
    .single();

  console.log("[LINE Pay Confirm] 資料庫查詢結果:", {
    booking,
    bookingError: bookingError ? { message: bookingError.message, code: bookingError.code } : null,
  });

  if (bookingError || !booking) {
    return redirectFail("訂單不存在", bookingError?.message ?? "");
  }

  if (!isTestMode && (booking.status !== "unpaid" || booking.payment_method !== "linepay")) {
    return redirectFail("訂單狀態不允許確認付款", `status=${booking.status} payment_method=${booking.payment_method}`);
  }

  if (!isTestMode) {
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
  }

  console.log("[LINE Pay Confirm] 準備更新訂單:", orderId);

  const updatePayload = { status: "paid" as const, line_pay_transaction_id: transactionId ?? "" };
  const bookingsTable = supabase.from("bookings");
  const updateQuery = bookingsTable
    .update(updatePayload)
    .eq("id", orderId)
    .eq("merchant_id", booking.merchant_id);
  const { data: updateData, error: updateError } = isTestMode
    ? await updateQuery.select("id").maybeSingle()
    : await updateQuery.eq("status", "unpaid").select("id").maybeSingle();

  if (updateError) {
    console.log("[LINE Pay Confirm] 更新失敗:", updateError);
    return redirectFail("更新訂單狀態失敗", updateError.message);
  }
  if (!updateData) {
    const detail = isTestMode
      ? "更新影響 0 筆，請確認 orderId 為訂單 id (UUID) 且該筆屬於目前 merchant_id"
      : "無符合條件的訂單（可能已被更新）";
    console.log("[LINE Pay Confirm] 更新影響 0 筆:", { orderId, merchant_id: booking.merchant_id });
    return redirectFail(isTestMode ? "測試模式更新失敗" : "更新訂單狀態失敗", detail);
  }

  revalidatePath("/member");

  const successUrl = `${baseUrl}/booking/success?bookingId=${encodeURIComponent(orderId)}`;
  return NextResponse.redirect(successUrl);
}
