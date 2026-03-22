import { NextRequest, NextResponse } from "next/server";
import { resolvePublicBaseUrl } from "@/lib/appUrl";
import { newebpayAesDecrypt, newebpayVerifyTradeSha } from "@/lib/payment-utils";
import { getNewebpayCreds, getNewebpayCredsForLog } from "@/lib/newebpay/config";
import { parseNewebpayIncomingPost } from "@/lib/newebpay/parseIncomingPost";

function isHexString(s: string): boolean {
  return /^[0-9a-fA-F]*$/.test(s);
}

/**
 * 藍新付款完成後前台導回（ReturnURL）。
 * 優先從原始 payload 取得 MerchantOrderNo；decrypt 失敗不寫 error，導向結果頁或 state=pending。
 */
export async function POST(request: NextRequest) {
  const appUrl = resolvePublicBaseUrl(request.nextUrl.origin);
  const resultPage = appUrl ? `${appUrl}/payment/newebpay/result` : "/payment/newebpay/result";

  let parsed: Awaited<ReturnType<typeof parseNewebpayIncomingPost>>;
  try {
    parsed = await parseNewebpayIncomingPost(request);
  } catch (e) {
    console.error("[NewebPay result] 讀取／解析 body 失敗", e);
    return NextResponse.redirect(`${resultPage}?state=pending`, 302);
  }

  const { rawBody, contentType, parsedKeys, parsedObject, rawJsonBody, tradePairs } = parsed;

  console.log("[NewebPay result] request content-type:", contentType);
  console.log("[NewebPay result] raw body length:", rawBody.length);
  if (rawBody.length > 0) {
    console.log("[NewebPay result] raw body text (full):", rawBody);
  }
  console.log("[NewebPay result] trade pair candidates:", tradePairs.map((p) => p.source));

  console.log("[NewebPay result] parsed form keys:", parsedKeys);
  console.log("[NewebPay result] parsed form object (each key -> value length):", Object.fromEntries(parsedKeys.map((k) => [k, (parsedObject[k] ?? "").length])));

  const getStr = (key: string): string => (parsedObject[key] ?? parsedObject[key.toLowerCase()] ?? "").trim();
  let merchantOrderNoFromPlain = getStr("MerchantOrderNo") || getStr("OrderNo");
  if (!merchantOrderNoFromPlain && rawJsonBody) {
    const body = rawJsonBody;
    if (typeof body.MerchantOrderNo === "string") merchantOrderNoFromPlain = body.MerchantOrderNo.trim();
    if (!merchantOrderNoFromPlain && body.data && typeof body.data === "object") {
      const d = body.data as Record<string, unknown>;
      if (typeof d.MerchantOrderNo === "string") merchantOrderNoFromPlain = d.MerchantOrderNo.trim();
    }
    if (!merchantOrderNoFromPlain && body.Result && typeof body.Result === "object") {
      const r = body.Result as Record<string, unknown>;
      if (typeof r.MerchantOrderNo === "string") merchantOrderNoFromPlain = r.MerchantOrderNo.trim();
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

  const creds = getNewebpayCreds();
  if (tradePairs.length > 0 && creds) {
    for (const c of tradePairs) {
      console.log(
        "[NewebPay result] 嘗試候選",
        c.source,
        "TradeInfo len:",
        c.tradeInfo.length,
        "preview:",
        c.tradeInfo.slice(0, 32),
        "isHex:",
        isHexString(c.tradeInfo)
      );
      const shaCheck = newebpayVerifyTradeSha(c.tradeSha, c.tradeInfo, creds.hashKey, creds.hashIv);
      if (!shaCheck.ok) {
        console.log("[NewebPay result] 候選", c.source, "TradeSha 驗證失敗，試下一組");
        continue;
      }
      console.log("[NewebPay result] 候選", c.source, "TradeSha 成功，變體:", shaCheck.matchedVariant);
      try {
        const decrypted = newebpayAesDecrypt(c.tradeInfo, creds.hashKey, creds.hashIv);
        const params = new URLSearchParams(decrypted);
        const fromDecrypt = params.get("MerchantOrderNo") ?? "";
        if (fromDecrypt.trim()) orderNoForRedirect = orderNoForRedirect || fromDecrypt.trim();
        console.log(
          "[NewebPay result] decrypt success, source:",
          c.source,
          "MerchantOrderNo from decrypt:",
          fromDecrypt.trim()
        );
        break;
      } catch (e) {
        console.error(
          "[NewebPay result] 候選",
          c.source,
          "解密失敗, input length:",
          c.tradeInfo.length,
          "isHex:",
          isHexString(c.tradeInfo),
          e
        );
      }
    }
  } else if (tradePairs.length === 0) {
    console.log("[NewebPay result] 無 TradeInfo／TradeSha 候選，不嘗試 decrypt");
  }

  const redirectTarget = orderNoForRedirect
    ? `${resultPage}?orderNo=${encodeURIComponent(orderNoForRedirect)}`
    : `${resultPage}?state=pending`;
  console.log("[NewebPay result] redirect target:", redirectTarget);

  return NextResponse.redirect(redirectTarget, 302);
}
