import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ecpayCheckMacValue, ECPAY_SIGN_KEYS } from "@/lib/ecpay/checkmac";
import { getAppUrl } from "@/lib/appUrl";

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
 * GET /api/ecpay/checkout?pendingId=xxx 或 ?bookingId=xxx（舊流程相容）
 * 依 pendingId 從 pending_payments 取得待付款，組綠界參數並回傳自動 POST 表單。未付款不寫入 bookings。
 */
export async function GET(request: NextRequest) {
  const pendingId = request.nextUrl.searchParams.get("pendingId");
  const bookingIdLegacy = request.nextUrl.searchParams.get("bookingId");
  if (!pendingId && !bookingIdLegacy) {
    return htmlErrorPage("參數錯誤", "缺少 pendingId，請從結帳流程重新進入。");
  }

  const creds = getEcpayCreds();
  if (!creds) {
    return htmlErrorPage("金流未設定", "綠界金流未設定（請設定 ECPAY_MERCHANT_ID、ECPAY_HASH_KEY、ECPAY_HASH_IV）。");
  }

  const supabase = createServerSupabase();
  let amount: number;
  let tradeNo: string;
  const now = new Date();
  const twTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const MerchantTradeDate = twTime.toISOString().slice(0, 19).replace("T", " ").replace(/-/g, "/");

  if (pendingId) {
    const { data: pending, error } = await supabase
      .from("pending_payments")
      .select("order_amount, gateway_key")
      .eq("id", pendingId)
      .eq("payment_method", "ecpay")
      .single();
    if (error || !pending) {
      return htmlErrorPage("待付款不存在", "查無此筆待付款，請從結帳頁重新選擇綠界付款。");
    }
    amount = Math.max(0, Number((pending as { order_amount?: number }).order_amount) ?? 0);
    tradeNo = String((pending as { gateway_key?: string }).gateway_key ?? "").trim().slice(0, 20);
    if (amount <= 0 || !tradeNo) {
      return htmlErrorPage("資料異常", "待付款金額或編號有誤，請重新下單。（gateway_key 為空時請從結帳頁重新選擇綠界付款）");
    }
    console.log("[ECPay checkout] pending flow gateway_key from DB:", JSON.stringify(tradeNo), "length:", tradeNo.length);
  } else {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, merchant_id, order_amount, status")
      .eq("id", bookingIdLegacy)
      .single();
    if (error || !booking) {
      return htmlErrorPage("訂單不存在", "查無此訂單，請確認連結是否正確或重新下單。");
    }
    if ((booking as { status?: string }).status !== "unpaid") {
      return htmlErrorPage("訂單狀態錯誤", "此訂單已付款或已關閉，無法重複付款。");
    }
    amount = Math.max(0, Number((booking as { order_amount?: number }).order_amount) ?? 0);
    if (amount <= 0) {
      return htmlErrorPage("訂單金額異常", "訂單金額有誤，請聯絡客服。");
    }
    tradeNo = (
      "EC" +
      Date.now().toString().slice(-8) +
      Math.random().toString(36).slice(-4).toUpperCase()
    ).slice(0, 20);
    await supabase
      .from("bookings")
      .update({ payment_method: "ecpay", ecpay_merchant_trade_no: tradeNo })
      .eq("id", bookingIdLegacy)
      .eq("status", "unpaid");
  }

  const appUrl = getAppUrl();
  if (!appUrl) {
    console.error("[ECPay checkout] 未設定 APP_URL 或 NEXT_PUBLIC_BASE_URL，無法產生回傳網址");
    return htmlErrorPage("設定錯誤", "未設定站點網址（APP_URL），無法產生綠界回傳網址。");
  }
  const returnUrl = `${appUrl}/api/ecpay/callback`;
  const orderResultUrl = `${appUrl}/api/ecpay/result`;
  const clientBackUrl = `${appUrl}/member`;

  const ecpayParams: Record<string, string> = {
    MerchantID: creds.merchantId,
    MerchantTradeNo: tradeNo,
    MerchantTradeDate: MerchantTradeDate,
    PaymentType: "aio",
    TotalAmount: String(amount),
    TradeDesc: "Course_Booking",
    ItemName: "課程預約",
    ReturnURL: returnUrl,
    OrderResultURL: orderResultUrl,
    ClientBackURL: clientBackUrl,
    ChoosePayment: "ALL",
    EncryptType: "1",
  };

  const missing = ECPAY_SIGN_KEYS.filter((k) => !ecpayParams[k] || String(ecpayParams[k]).trim() === "");
  if (missing.length > 0) {
    console.error("[ECPay checkout] 缺少必填參數:", missing);
    return htmlErrorPage("參數錯誤", `綠界必填欄位遺漏: ${missing.join(", ")}`);
  }

  ecpayParams.CheckMacValue = ecpayCheckMacValue(ecpayParams, creds.hashKey, creds.hashIv, { debug: true });

  const actionUrl = getEcpayActionUrl();
  console.log("[ECPay checkout] payment provider: ecpay");
  console.log("[ECPay checkout] APP_URL:", appUrl);
  console.log("[ECPay checkout] MerchantTradeNo:", tradeNo);
  console.log("[ECPay checkout] ReturnURL:", returnUrl);
  console.log("[ECPay checkout] OrderResultURL:", orderResultUrl);
  console.log("[ECPay checkout] ClientBackURL:", clientBackUrl);
  console.log("[ECPay checkout] actionUrl:", actionUrl);
  console.log(
    "[ECPay checkout] submittedFormFields:",
    ECPAY_SIGN_KEYS.map((k) => `${k}=${ecpayParams[k]?.slice?.(0, 40) ?? ecpayParams[k]}${(ecpayParams[k]?.length ?? 0) > 40 ? "..." : ""}`)
  );
  console.log("[ECPay checkout] CheckMacValue (前 8 字元):", (ecpayParams.CheckMacValue ?? "").slice(0, 8) + "...");

  const formFields = Object.entries(ecpayParams)
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
