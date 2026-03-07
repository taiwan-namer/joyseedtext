import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/appUrl";
import { newebpayAesDecrypt, newebpayTradeSha } from "@/lib/payment-utils";
import { getNewebpayCreds } from "@/lib/newebpay/config";

function isHexString(s: string): boolean {
  return /^[0-9a-fA-F]*$/.test(s);
}

/**
 * 藍新付款完成後前台導回（ReturnURL）。
 * 藍新依 RespondType 可能回傳 application/json 或 application/x-www-form-urlencoded，兩者皆支援。
 * 不讓 POST 打到 page route，避免 500。
 */
export async function POST(request: NextRequest) {
  const appUrl = getAppUrl();
  const resultPage = appUrl ? `${appUrl}/payment/newebpay/result` : "/payment/newebpay/result";
  const failUrl = `${resultPage}?error=return`;

  function redirectToFail() {
    return NextResponse.redirect(failUrl, 302);
  }

  const contentType = request.headers.get("content-type") ?? "";
  console.log("[NewebPay result] raw request content-type:", contentType);

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (e) {
    console.error("[NewebPay result] 讀取 body 失敗", e);
    return redirectToFail();
  }

  console.log("[NewebPay result] raw body length:", rawBody.length, "body preview (前 120 字元):", rawBody.slice(0, 120));

  let tradeInfoEnc: string;
  let tradeShaReceived: string;
  const parsedKeys: string[] = [];

  if (contentType.includes("application/json")) {
    try {
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      parsedKeys.push(...Object.keys(body));
      tradeInfoEnc = typeof body.TradeInfo === "string" ? body.TradeInfo : "";
      tradeShaReceived = typeof body.TradeSha === "string" ? body.TradeSha : "";
      if (!tradeInfoEnc && body.Result && typeof body.Result === "object") {
        const r = body.Result as Record<string, unknown>;
        if (typeof r.TradeInfo === "string") tradeInfoEnc = r.TradeInfo;
        if (typeof r.TradeSha === "string") tradeShaReceived = r.TradeSha;
      }
      if (!tradeInfoEnc && body.data && typeof body.data === "object") {
        const d = body.data as Record<string, unknown>;
        if (typeof d.TradeInfo === "string") tradeInfoEnc = d.TradeInfo;
        if (typeof d.TradeSha === "string") tradeShaReceived = d.TradeSha;
      }
      console.log("[NewebPay result] parsed as JSON, keys:", parsedKeys);
    } catch (e) {
      console.error("[NewebPay result] JSON parse 失敗", e);
      return redirectToFail();
    }
  } else {
    const params = new URLSearchParams(rawBody);
    params.forEach((_, key) => parsedKeys.push(key));
    tradeInfoEnc = params.get("TradeInfo") ?? "";
    tradeShaReceived = params.get("TradeSha") ?? "";
    console.log("[NewebPay result] parsed as form, keys:", parsedKeys);
  }

  console.log("[NewebPay result] actual encrypted field used: TradeInfo, length:", tradeInfoEnc.length);
  console.log("[NewebPay result] TradeSha length:", tradeShaReceived.length);
  if (tradeInfoEnc.length > 0) {
    console.log("[NewebPay result] TradeInfo is hex:", isHexString(tradeInfoEnc), "first 20 chars:", tradeInfoEnc.slice(0, 20));
  }

  if (!tradeInfoEnc || !tradeShaReceived) {
    console.log("[NewebPay result] TradeInfo 或 TradeSha 為空，導向失敗頁");
    return redirectToFail();
  }

  const creds = getNewebpayCreds();
  if (!creds) {
    console.error("[NewebPay result] 藍新金流未設定");
    return redirectToFail();
  }

  const expectedSha = newebpayTradeSha(tradeInfoEnc, creds.hashKey, creds.hashIv);
  if (tradeShaReceived.toUpperCase() !== expectedSha) {
    console.log("[NewebPay result] TradeSha 驗證失敗");
    return redirectToFail();
  }

  let decrypted: string;
  try {
    decrypted = newebpayAesDecrypt(tradeInfoEnc, creds.hashKey, creds.hashIv);
    console.log("[NewebPay result] decrypt success, decrypted length:", decrypted.length);
  } catch (e) {
    console.error("[NewebPay result] decrypt failure", e);
    return redirectToFail();
  }

  const params = new URLSearchParams(decrypted);
  const merchantOrderNo = params.get("MerchantOrderNo") ?? "";
  const status = params.get("Status") ?? "";

  console.log("[NewebPay result] MerchantOrderNo:", merchantOrderNo, "Status:", status);

  const redirectTarget = merchantOrderNo
    ? `${resultPage}?orderNo=${encodeURIComponent(merchantOrderNo)}`
    : resultPage;
  console.log("[NewebPay result] redirect target:", redirectTarget);

  return NextResponse.redirect(redirectTarget, 302);
}
