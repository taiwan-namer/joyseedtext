import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
import { getNewebpayConfig } from "@/lib/newebpay/config";
import { newebpayEncryptTradeInfo, newebpayGetTradeSha } from "@/lib/newebpay/encrypt";

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

function maskKey(s: string, head = 2, tail = 2): string {
  if (s.length <= head + tail) return "***";
  return s.slice(0, head) + "***" + s.slice(-tail);
}

/**
 * GET /api/newebpay/checkout?pendingId=xxx 或 ?bookingId=xxx（舊流程相容）
 * 依 pendingId 從 pending_payments 取得待付款，組藍新參數並回傳自動 POST 表單。
 * 所有藍新設定僅從 lib/newebpay/config 取得，確保 actionUrl 與 MerchantID/HashKey/HashIV 同環境。
 */
export async function GET(request: NextRequest) {
  const pendingId = request.nextUrl.searchParams.get("pendingId");
  const bookingIdLegacy = request.nextUrl.searchParams.get("bookingId");
  if (!pendingId && !bookingIdLegacy) {
    return htmlErrorPage("參數錯誤", "缺少 pendingId，請從結帳流程重新進入。");
  }

  const config = getNewebpayConfig();
  if (!config) {
    return htmlErrorPage("金流未設定", "藍新金流未設定（請設定 NEWEBPAY_MERCHANT_ID、NEWEBPAY_HASH_KEY、NEWEBPAY_HASH_IV）。");
  }

  const supabase = createServerSupabase();
  let amount: number;
  let merchantOrderNo: string;

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
    merchantOrderNo = String((pending as { gateway_key?: string }).gateway_key ?? "").trim().slice(0, 30);
    if (amount <= 0 || !merchantOrderNo) {
      return htmlErrorPage("資料異常", "待付款金額或編號有誤，請重新下單。（gateway_key 為空時請從結帳頁重新選擇藍新付款）");
    }
    console.log("[NewebPay checkout] pending flow gateway_key from DB:", JSON.stringify(merchantOrderNo), "length:", merchantOrderNo.length);
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

  const appUrl = getAppUrl();
  if (!appUrl) {
    console.error("[NewebPay checkout] 未設定 APP_URL 或 NEXT_PUBLIC_BASE_URL，無法產生回傳網址");
    return htmlErrorPage("設定錯誤", "未設定站點網址（APP_URL），無法產生藍新回傳網址。");
  }

  // ReturnURL 必須指向 API route，不可指向 /payment/newebpay/result page（POST 會觸發 500）
  const returnUrl = `${appUrl}/api/newebpay/result`;
  const notifyUrl = `${appUrl}/api/newebpay/callback`;
  const clientBackUrl = `${appUrl}/api/newebpay/back`;

  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const amt = Math.round(amount);
  const rawData = [
    `MerchantID=${config.merchantId}`,
    `RespondType=${config.respondType}`,
    `TimeStamp=${timeStamp}`,
    `Version=${config.version}`,
    `MerchantOrderNo=${merchantOrderNo}`,
    `Amt=${amt}`,
    "ItemDesc=CourseBooking",
    "LoginType=0",
    `ReturnURL=${returnUrl}`,
    `NotifyURL=${notifyUrl}`,
    `ClientBackURL=${clientBackUrl}`,
  ].join("&");

  let tradeInfoHex: string;
  try {
    tradeInfoHex = newebpayEncryptTradeInfo(rawData, config.hashKey, config.hashIv);
  } catch (e) {
    console.error("[NewebPay checkout] AES 加密失敗", e);
    return htmlErrorPage("加密錯誤", "TradeInfo 加密失敗，請確認 HashKey（32 字元）與 HashIV（16 字元）設定正確。");
  }
  const tradeSha = newebpayGetTradeSha(tradeInfoHex, config.hashKey, config.hashIv);

  console.log("[NewebPay checkout] ReturnURL:", returnUrl);
  console.log("[NewebPay checkout] NotifyURL:", notifyUrl);
  console.log("[NewebPay checkout] ClientBackURL:", clientBackUrl);
  console.log("[NewebPay checkout] MerchantOrderNo:", merchantOrderNo);
  console.log("[NewebPay checkout] actionUrl:", config.actionUrl);
  console.log("[NewebPay checkout config]", {
    actionUrl: config.actionUrl,
    environment: config.isProduction ? "production" : "stage",
    merchantId: config.merchantId,
    version: config.version,
    respondType: config.respondType,
    returnURL: returnUrl,
    notifyURL: notifyUrl,
    clientBackURL: clientBackUrl,
    merchantOrderNo,
    amt,
    hashKeyMask: maskKey(config.hashKey),
    hashIvMask: maskKey(config.hashIv),
    tradeInfoLength: tradeInfoHex.length,
    tradeShaPrefix: tradeSha.slice(0, 8) + "...",
  });

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>導向藍新付款</title>
  <style>body{font-family:system-ui,sans-serif;max-width:480px;margin:2rem auto;padding:0 1rem;text-align:center;color:#374151;}p{margin-top:1rem;}</style>
</head>
<body>
  <form method="POST" action="${escapeAttr(config.actionUrl)}">
    <input type="hidden" name="MerchantID" value="${escapeAttr(config.merchantId)}" />
    <input type="hidden" name="TradeInfo" value="${escapeAttr(tradeInfoHex)}" />
    <input type="hidden" name="TradeSha" value="${escapeAttr(tradeSha)}" />
    <input type="hidden" name="Version" value="${escapeAttr(config.version)}" />
  </form>
  <p>正在導向藍新付款頁…</p>
  <script>document.forms[0].submit();</script>
</body>
</html>`;

  const cookieValue = `newebpay_order_no=${encodeURIComponent(merchantOrderNo)}; Path=/; Max-Age=3600; SameSite=Lax`;
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": cookieValue,
    },
  });
}
