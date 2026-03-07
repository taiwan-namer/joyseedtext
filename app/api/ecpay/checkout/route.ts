import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ecpayCheckMacValue } from "@/lib/payment-utils";

const ECPAY_STAGE_URL = "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5";
const ECPAY_PRODUCTION_URL = "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5";

function getEcpayCreds() {
  const id = process.env.ECPAY_MERCHANT_ID?.trim();
  const key = process.env.ECPAY_HASH_KEY?.trim();
  const iv = process.env.ECPAY_HASH_IV?.trim();
  if (!id || !key || !iv) return null;
  return { merchantId: id, hashKey: key, hashIv: iv };
}

function getEcpayActionUrl(): string {
  return (process.env.ECPAY_ENV ?? "").trim().toLowerCase() === "production"
    ? ECPAY_PRODUCTION_URL
    : ECPAY_STAGE_URL;
}

function htmlErrorPage(title: string, message: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>body{font-family:system-ui,sans-serif;max-width:480px;margin:2rem auto;padding:0 1rem;}h1{font-size:1.25rem;color:#b91c1c;}p{color:#374151;}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;
  return new NextResponse(html, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * GET /api/ecpay/checkout?bookingId=xxx
 * 依 bookingId 取得訂單，組綠界參數並回傳自動 POST 表單（Content-Type: text/html）。
 */
export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get("bookingId");
  if (!bookingId) {
    return htmlErrorPage("參數錯誤", "缺少 bookingId，請從結帳流程重新進入。");
  }

  const creds = getEcpayCreds();
  if (!creds) {
    return htmlErrorPage("金流未設定", "綠界金流未設定（請設定 ECPAY_MERCHANT_ID、ECPAY_HASH_KEY、ECPAY_HASH_IV）。");
  }

  const supabase = createServerSupabase();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, merchant_id, order_amount, status, payment_method")
    .eq("id", bookingId)
    .single();

  if (error || !booking) {
    return htmlErrorPage("訂單不存在", "查無此訂單，請確認連結是否正確或重新下單。");
  }
  if (booking.status !== "unpaid") {
    return htmlErrorPage("訂單狀態錯誤", "此訂單已付款或已關閉，無法重複付款。");
  }

  const amount = Math.max(0, Number(booking.order_amount) ?? 0);
  if (amount <= 0) {
    return htmlErrorPage("訂單金額異常", "訂單金額有誤，請聯絡客服。");
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "";
  const returnUrl = `${baseUrl}/api/ecpay/callback`;

  const tradeNo = (
    Date.now().toString().slice(-10) +
    bookingId.replace(/-/g, "").slice(0, 10)
  ).slice(0, 20);
  const tradeDate = new Date().toLocaleString("sv-SE").replace("T", " ").slice(0, 19);

  await supabase
    .from("bookings")
    .update({ payment_method: "ecpay", ecpay_merchant_trade_no: tradeNo })
    .eq("id", bookingId)
    .eq("status", "unpaid");

  const params: Record<string, string> = {
    MerchantID: creds.merchantId,
    MerchantTradeNo: tradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType: "aio",
    TotalAmount: String(amount),
    TradeDesc: "課程報名",
    ItemName: "課程報名",
    ReturnURL: returnUrl,
    ChoosePayment: "Credit",
    EncryptType: "1",
  };

  params.CheckMacValue = ecpayCheckMacValue(params, creds.hashKey, creds.hashIv);

  console.log("[ECPay checkout] 送出參數（已隱藏金鑰）:", {
    MerchantID: params.MerchantID,
    MerchantTradeNo: params.MerchantTradeNo,
    MerchantTradeDate: params.MerchantTradeDate,
    TotalAmount: params.TotalAmount,
    ReturnURL: params.ReturnURL,
    CheckMacValue: params.CheckMacValue?.slice(0, 8) + "...",
    actionUrl: getEcpayActionUrl(),
  });

  const actionUrl = getEcpayActionUrl();
  const formFields = Object.entries(params)
    .map(([k, v]) => `  <input type="hidden" name="${escapeAttr(k)}" value="${escapeAttr(v)}" />`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>導向綠界付款</title>
  <style>body{font-family:system-ui,sans-serif;max-width:480px;margin:2rem auto;padding:0 1rem;text-align:center;color:#374151;}p{margin-top:1rem;}</style>
</head>
<body>
  <form id="payment-form" method="POST" action="${escapeAttr(actionUrl)}">
${formFields}
  </form>
  <p>正在導向綠界付款頁…</p>
  <script>document.getElementById("payment-form").submit();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
