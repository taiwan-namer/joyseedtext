import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { newebpayAesEncrypt, newebpayTradeSha, newebpayQueryString } from "@/lib/payment-utils";

const NEWEBPAY_STAGE_URL = "https://ccore.newebpay.com/MPG/main/standard";
const NEWEBPAY_PRODUCTION_URL = "https://core.newebpay.com/MPG/mpg_gateway";

function getNewebpayCreds() {
  const id = process.env.NEWEBPAY_MERCHANT_ID?.trim();
  const key = process.env.NEWEBPAY_HASH_KEY?.trim();
  const iv = process.env.NEWEBPAY_HASH_IV?.trim();
  if (!id || !key || !iv) return null;
  return { merchantId: id, hashKey: key, hashIv: iv };
}

function getNewebpayActionUrl(): string {
  return (process.env.NEWEBPAY_ENV ?? "").trim().toLowerCase() === "production"
    ? NEWEBPAY_PRODUCTION_URL
    : NEWEBPAY_STAGE_URL;
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
 * GET /api/newebpay/checkout?bookingId=xxx
 * 依 bookingId 取得訂單，組藍新 TradeInfo + TradeSha，回傳自動 POST 表單（Content-Type: text/html）。
 */
export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get("bookingId");
  if (!bookingId) {
    return htmlErrorPage("參數錯誤", "缺少 bookingId，請從結帳流程重新進入。");
  }

  const creds = getNewebpayCreds();
  if (!creds) {
    return htmlErrorPage("金流未設定", "藍新金流未設定（請設定 NEWEBPAY_MERCHANT_ID、NEWEBPAY_HASH_KEY、NEWEBPAY_HASH_IV）。");
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
  const returnUrl = `${baseUrl}/api/newebpay/callback/return`;
  const notifyUrl = `${baseUrl}/api/newebpay/callback`;

  const merchantOrderNo = bookingId.replace(/-/g, "").slice(0, 30);
  await supabase
    .from("bookings")
    .update({ payment_method: "newebpay", newebpay_merchant_order_no: merchantOrderNo })
    .eq("id", bookingId)
    .eq("status", "unpaid");

  const tradeInfoObj = {
    MerchantID: creds.merchantId,
    RespondType: "JSON",
    TimeStamp: String(Math.floor(Date.now() / 1000)),
    Version: "2.0",
    MerchantOrderNo: merchantOrderNo,
    Amt: amount,
    ItemDesc: "課程報名",
    ReturnURL: returnUrl,
    NotifyURL: notifyUrl,
  };

  const tradeInfoPlain = newebpayQueryString(tradeInfoObj);
  const tradeInfo = newebpayAesEncrypt(tradeInfoPlain, creds.hashKey, creds.hashIv);
  const tradeSha = newebpayTradeSha(tradeInfo, creds.hashKey, creds.hashIv);

  console.log("[NewebPay checkout] 送出參數（已隱藏金鑰）:", {
    MerchantID: creds.merchantId,
    MerchantOrderNo: merchantOrderNo,
    Amt: amount,
    ReturnURL: returnUrl,
    NotifyURL: notifyUrl,
    TradeInfoPlain: tradeInfoPlain,
    TradeInfoLength: tradeInfo.length,
    TradeSha: tradeSha?.slice(0, 8) + "...",
    actionUrl: getNewebpayActionUrl(),
  });

  const actionUrl = getNewebpayActionUrl();
  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>導向藍新付款</title>
  <style>body{font-family:system-ui,sans-serif;max-width:480px;margin:2rem auto;padding:0 1rem;text-align:center;color:#374151;}p{margin-top:1rem;}</style>
</head>
<body>
  <form id="payment-form" method="POST" action="${escapeAttr(actionUrl)}">
    <input type="hidden" name="MerchantID" value="${escapeAttr(creds.merchantId)}" />
    <input type="hidden" name="TradeInfo" value="${escapeAttr(tradeInfo)}" />
    <input type="hidden" name="TradeSha" value="${escapeAttr(tradeSha)}" />
    <input type="hidden" name="Version" value="2.0" />
  </form>
  <p>正在導向藍新付款頁…</p>
  <script>document.getElementById("payment-form").submit();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
