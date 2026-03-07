import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/appUrl";
import { newebpayAesDecrypt, newebpayTradeSha } from "@/lib/payment-utils";
import { getNewebpayCreds, getNewebpayCredsForLog } from "@/lib/newebpay/config";

function isHexString(s: string): boolean {
  return /^[0-9a-fA-F]*$/.test(s);
}

function maskForLog(obj: Record<string, unknown>, maxLen = 80): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const s = v === undefined || v === null ? "" : String(v);
    out[k] = s.length > maxLen ? s.slice(0, maxLen) + "..." : s;
  }
  return out;
}

/**
 * 藍新付款完成後前台導回（ReturnURL）。
 * 依實際 content-type 解析；解密失敗時不帶 error=return，交給 callback 為準。
 */
export async function POST(request: NextRequest) {
  const appUrl = getAppUrl();
  const resultPage = appUrl ? `${appUrl}/payment/newebpay/result` : "/payment/newebpay/result";

  const contentType = request.headers.get("content-type") ?? "";
  console.log("[NewebPay result] raw request content-type:", contentType);

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (e) {
    console.error("[NewebPay result] 讀取 body 失敗", e);
    return NextResponse.redirect(resultPage, 302);
  }

  console.log("[NewebPay result] raw body length:", rawBody.length);
  console.log("[NewebPay result] raw body preview (前 200 字元):", rawBody.slice(0, 200));

  const parsedKeys: string[] = [];
  const parsedObject: Record<string, unknown> = {};
  let tradeInfoEnc: string = "";
  let tradeShaReceived: string = "";

  if (contentType.includes("application/json")) {
    try {
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      for (const k of Object.keys(body)) parsedKeys.push(k);
      for (const [k, v] of Object.entries(body)) parsedObject[k] = v;
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
      console.log("[NewebPay result] parsed object (masked):", maskForLog(parsedObject));
    } catch (e) {
      console.error("[NewebPay result] JSON parse 失敗", e);
      return NextResponse.redirect(resultPage, 302);
    }
  } else {
    const params = new URLSearchParams(rawBody);
    params.forEach((value, key) => {
      parsedKeys.push(key);
      parsedObject[key] = value;
    });
    tradeInfoEnc = params.get("TradeInfo") ?? params.get("tradeinfo") ?? "";
    tradeShaReceived = params.get("TradeSha") ?? params.get("tradesha") ?? "";
    console.log("[NewebPay result] parsed as form, keys:", parsedKeys);
    console.log("[NewebPay result] parsed object (masked):", maskForLog(parsedObject));
  }

  console.log("[NewebPay result] actual encrypted field used for decrypt: TradeInfo, length:", tradeInfoEnc.length);
  console.log("[NewebPay result] TradeSha length:", tradeShaReceived.length);
  if (tradeInfoEnc.length > 0) {
    console.log("[NewebPay result] TradeInfo is hex:", isHexString(tradeInfoEnc), "first 24 chars:", tradeInfoEnc.slice(0, 24));
  }

  const credsForLog = getNewebpayCredsForLog();
  if (credsForLog) {
    console.log("[NewebPay result] merchantId:", credsForLog.merchantId, "hashKeyMask:", credsForLog.hashKeyMask, "hashIvMask:", credsForLog.hashIvMask);
  }

  const creds = getNewebpayCreds();
  if (!creds) {
    console.error("[NewebPay result] 藍新金流未設定");
    return NextResponse.redirect(resultPage, 302);
  }

  let merchantOrderNoFromPlain = "";
  if (typeof parsedObject.MerchantOrderNo === "string") merchantOrderNoFromPlain = parsedObject.MerchantOrderNo.trim();
  if (!tradeInfoEnc || !tradeShaReceived) {
    console.log("[NewebPay result] TradeInfo 或 TradeSha 為空，導向結果頁（不帶 error）");
    const url = merchantOrderNoFromPlain ? `${resultPage}?orderNo=${encodeURIComponent(merchantOrderNoFromPlain)}` : resultPage;
    return NextResponse.redirect(url, 302);
  }

  const expectedSha = newebpayTradeSha(tradeInfoEnc, creds.hashKey, creds.hashIv);
  if (tradeShaReceived.toUpperCase() !== expectedSha) {
    console.log("[NewebPay result] TradeSha 驗證失敗，導向結果頁（不帶 error）");
    const url = merchantOrderNoFromPlain ? `${resultPage}?orderNo=${encodeURIComponent(merchantOrderNoFromPlain)}` : resultPage;
    return NextResponse.redirect(url, 302);
  }

  let decrypted: string;
  try {
    decrypted = newebpayAesDecrypt(tradeInfoEnc, creds.hashKey, creds.hashIv);
    console.log("[NewebPay result] decrypt success, decrypted length:", decrypted.length);
  } catch (e) {
    console.error("[NewebPay result] decrypt failure (input length:", tradeInfoEnc.length, "isHex:", isHexString(tradeInfoEnc), ")", e);
    const url = merchantOrderNoFromPlain ? `${resultPage}?orderNo=${encodeURIComponent(merchantOrderNoFromPlain)}` : resultPage;
    return NextResponse.redirect(url, 302);
  }

  const params = new URLSearchParams(decrypted);
  const merchantOrderNo = params.get("MerchantOrderNo") ?? merchantOrderNoFromPlain ?? "";
  const status = params.get("Status") ?? "";

  console.log("[NewebPay result] MerchantOrderNo:", merchantOrderNo, "Status:", status);

  const redirectTarget = merchantOrderNo
    ? `${resultPage}?orderNo=${encodeURIComponent(merchantOrderNo)}`
    : resultPage;
  console.log("[NewebPay result] redirect target:", redirectTarget);

  return NextResponse.redirect(redirectTarget, 302);
}
