import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  newebpayBuildTradeInfoString,
  newebpayEncryptTradeInfo,
  newebpayGetTradeSha,
  newebpaySanitizeItemDesc,
} from "@/lib/crypto-utils";

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
 * GET /api/newebpay/checkout?pendingId=xxx 或 ?bookingId=xxx（舊流程相容）
 * 依 pendingId 從 pending_payments 取得待付款，組藍新參數並回傳自動 POST 表單。未付款不寫入 bookings。
 */
export async function GET(request: NextRequest) {
  console.log("--- NewebPay Start ---");
  const pendingId = request.nextUrl.searchParams.get("pendingId");
  const bookingIdLegacy = request.nextUrl.searchParams.get("bookingId");
  if (!pendingId && !bookingIdLegacy) {
    return htmlErrorPage("參數錯誤", "缺少 pendingId，請從結帳流程重新進入。");
  }

  const creds = getNewebpayCreds();
  if (!creds) {
    return htmlErrorPage("金流未設定", "藍新金流未設定（請設定 NEWEBPAY_MERCHANT_ID、NEWEBPAY_HASH_KEY、NEWEBPAY_HASH_IV）。");
  }

  const supabase = createServerSupabase();
  let amount: number;
  let merchantOrderNo: string;
  let userEmail = "";

  if (pendingId) {
    const { data: pending, error } = await supabase
      .from("pending_payments")
      .select("order_amount, gateway_key, member_email")
      .eq("id", pendingId)
      .eq("payment_method", "newebpay")
      .single();
    if (error || !pending) {
      return htmlErrorPage("待付款不存在", "查無此筆待付款，請從結帳頁重新選擇藍新付款。");
    }
    amount = Math.max(0, Number((pending as { order_amount?: number }).order_amount) ?? 0);
    merchantOrderNo = String((pending as { gateway_key?: string }).gateway_key ?? "").slice(0, 30);
    userEmail = String((pending as { member_email?: string }).member_email ?? "").trim();
    if (amount <= 0 || !merchantOrderNo) {
      return htmlErrorPage("資料異常", "待付款金額或編號有誤，請重新下單。");
    }
  } else {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, order_amount, status, member_email")
      .eq("id", bookingIdLegacy)
      .single();
    if (error || !booking) {
      return htmlErrorPage("訂單不存在", "查無此訂單，請確認連結是否正確或重新下單。");
    }
    if ((booking as { status?: string }).status !== "unpaid") {
      return htmlErrorPage("訂單狀態錯誤", "此訂單已付款或已關閉，無法重複付款。");
    }
    amount = Math.max(0, Number((booking as { order_amount?: number }).order_amount) ?? 0);
    userEmail = String((booking as { member_email?: string }).member_email ?? "").trim();
    if (amount <= 0) {
      return htmlErrorPage("訂單金額異常", "訂單金額有誤，請聯絡客服。");
    }
    merchantOrderNo = "NB" + Date.now().toString();
    await supabase
      .from("bookings")
      .update({ payment_method: "newebpay", newebpay_merchant_order_no: merchantOrderNo })
      .eq("id", bookingIdLegacy)
      .eq("status", "unpaid");
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "";
  const returnUrl = `${baseUrl}/api/newebpay/callback/return`;
  const notifyUrl = `${baseUrl}/api/newebpay/callback`;

  // MPG 2.0：TradeInfo 明文必填欄位（MerchantID, RespondType=JSON, TimeStamp, Version=2.0, MerchantOrderNo, Amt, ItemDesc, LoginType=0）
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const tradeInfoObj: Record<string, string> = {
    MerchantID: creds.merchantId,
    RespondType: "JSON",
    TimeStamp: timeStamp,
    Version: "2.0",
    MerchantOrderNo: merchantOrderNo,
    Amt: String(amount),
    ItemDesc: newebpaySanitizeItemDesc("Booking"),
    LoginType: "0",
    ReturnURL: returnUrl,
    NotifyURL: notifyUrl,
  };
  if (userEmail) tradeInfoObj.Email = userEmail;

  const rawData = newebpayBuildTradeInfoString(tradeInfoObj);
  let tradeInfo: string;
  try {
    tradeInfo = newebpayEncryptTradeInfo(rawData, creds.hashKey, creds.hashIv);
  } catch (e) {
    console.error("[NewebPay checkout] AES 加密失敗", e);
    return htmlErrorPage("加密錯誤", "TradeInfo 加密失敗，請確認 HashKey（32 字元）與 HashIV（16 字元）設定正確。");
  }
  const tradeSha = newebpayGetTradeSha(tradeInfo, creds.hashKey, creds.hashIv);

  console.log("Raw Data:", rawData);
  console.log("TradeInfo:", tradeInfo);
  console.log("TradeSha:", tradeSha);

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
