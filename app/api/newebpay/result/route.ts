import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/appUrl";
import { newebpayAesDecrypt, newebpayTradeSha } from "@/lib/payment-utils";
import { getNewebpayCreds, getNewebpayCredsForLog } from "@/lib/newebpay/config";

function isHexString(s: string): boolean {
  return /^[0-9a-fA-F]*$/.test(s);
}

/**
 * 藍新付款完成後前台導回（ReturnURL）。
 * 優先從原始 payload 取得 MerchantOrderNo；decrypt 失敗不寫 error，導向結果頁或 state=pending。
 */
export async function POST(request: NextRequest) {
  const appUrl = getAppUrl();
  const resultPage = appUrl ? `${appUrl}/payment/newebpay/result` : "/payment/newebpay/result";

  const contentType = request.headers.get("content-type") ?? "";
  console.log("[NewebPay result] request content-type:", contentType);

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (e) {
    console.error("[NewebPay result] 讀取 body 失敗", e);
    return NextResponse.redirect(`${resultPage}?state=pending`, 302);
  }

  console.log("[NewebPay result] raw body length:", rawBody.length);
  console.log("[NewebPay result] raw body text (full):", rawBody);

  const parsedKeys: string[] = [];
  const parsedObject: Record<string, string> = {};
  let tradeInfoEnc = "";
  let tradeShaReceived = "";

  if (contentType.includes("application/json")) {
    try {
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      for (const k of Object.keys(body)) {
        parsedKeys.push(k);
        const v = body[k];
        const s = v === undefined || v === null ? "" : String(v);
        parsedObject[k] = s;
      }
      tradeInfoEnc = typeof body.TradeInfo === "string" ? body.TradeInfo : (body.tradeinfo as string) ?? "";
      tradeShaReceived = typeof body.TradeSha === "string" ? body.TradeSha : (body.tradesha as string) ?? "";
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
    } catch (e) {
      console.error("[NewebPay result] JSON parse 失敗", e);
      return NextResponse.redirect(`${resultPage}?state=pending`, 302);
    }
  } else {
    const params = new URLSearchParams(rawBody);
    params.forEach((value, key) => {
      parsedKeys.push(key);
      parsedObject[key] = value;
    });
    tradeInfoEnc = params.get("TradeInfo") ?? params.get("tradeinfo") ?? "";
    tradeShaReceived = params.get("TradeSha") ?? params.get("tradesha") ?? "";
  }

  console.log("[NewebPay result] parsed form keys:", parsedKeys);
  console.log("[NewebPay result] parsed form object (each key -> value length):", Object.fromEntries(parsedKeys.map((k) => [k, (parsedObject[k] ?? "").length])));

  const getStr = (key: string): string => (parsedObject[key] ?? parsedObject[key.toLowerCase()] ?? "").trim();
  let merchantOrderNoFromPlain = getStr("MerchantOrderNo") || getStr("OrderNo");
  if (!merchantOrderNoFromPlain && contentType.includes("application/json")) {
    try {
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      if (typeof body.MerchantOrderNo === "string") merchantOrderNoFromPlain = body.MerchantOrderNo.trim();
      if (!merchantOrderNoFromPlain && body.data && typeof body.data === "object") {
        const d = body.data as Record<string, unknown>;
        if (typeof d.MerchantOrderNo === "string") merchantOrderNoFromPlain = d.MerchantOrderNo.trim();
      }
      if (!merchantOrderNoFromPlain && body.Result && typeof body.Result === "object") {
        const r = body.Result as Record<string, unknown>;
        if (typeof r.MerchantOrderNo === "string") merchantOrderNoFromPlain = r.MerchantOrderNo.trim();
      }
    } catch {
      // already parsed above
    }
  }
  const statusFromPlain = getStr("Status");
  const tradeStatusFromPlain = getStr("TradeStatus");
  const messageFromPlain = getStr("Message");
  const tradeNoFromPlain = getStr("TradeNo");
  const amtFromPlain = getStr("Amt");

  console.log("[NewebPay result] from raw payload (plain): MerchantOrderNo:", merchantOrderNoFromPlain, "OrderNo:", getStr("OrderNo"), "Status:", statusFromPlain, "TradeStatus:", tradeStatusFromPlain, "Message:", messageFromPlain, "TradeNo:", tradeNoFromPlain, "Amt:", amtFromPlain);

  const credsForLog = getNewebpayCredsForLog();
  if (credsForLog) {
    console.log("[NewebPay result] merchantId:", credsForLog.merchantId, "hashKeyMask:", credsForLog.hashKeyMask, "hashIvMask:", credsForLog.hashIvMask);
  }

  let orderNoForRedirect = merchantOrderNoFromPlain;

  if (tradeInfoEnc && tradeShaReceived) {
    console.log("[NewebPay result] field used for decrypt: TradeInfo, length:", tradeInfoEnc.length, "preview (前 32 字):", tradeInfoEnc.slice(0, 32), "isHex:", isHexString(tradeInfoEnc));

    const creds = getNewebpayCreds();
    if (creds) {
      const expectedSha = newebpayTradeSha(tradeInfoEnc, creds.hashKey, creds.hashIv);
      if (tradeShaReceived.toUpperCase() === expectedSha) {
        try {
          const decrypted = newebpayAesDecrypt(tradeInfoEnc, creds.hashKey, creds.hashIv);
          const params = new URLSearchParams(decrypted);
          const fromDecrypt = params.get("MerchantOrderNo") ?? "";
          if (fromDecrypt.trim()) orderNoForRedirect = orderNoForRedirect || fromDecrypt.trim();
          console.log("[NewebPay result] decrypt success, MerchantOrderNo from decrypt:", fromDecrypt.trim());
        } catch (e) {
          console.error("[NewebPay result] decrypt failure, input length:", tradeInfoEnc.length, "isHex:", isHexString(tradeInfoEnc), e);
        }
      } else {
        console.log("[NewebPay result] TradeSha 驗證失敗，略過 decrypt");
      }
    }
  } else {
    console.log("[NewebPay result] TradeInfo 或 TradeSha 為空，不嘗試 decrypt");
  }

  const redirectTarget = orderNoForRedirect
    ? `${resultPage}?orderNo=${encodeURIComponent(orderNoForRedirect)}`
    : `${resultPage}?state=pending`;
  console.log("[NewebPay result] redirect target:", redirectTarget);

  return NextResponse.redirect(redirectTarget, 302);
}
