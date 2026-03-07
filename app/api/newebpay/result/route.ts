import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/appUrl";
import { newebpayAesDecrypt, newebpayTradeSha } from "@/lib/payment-utils";
import { getNewebpayCreds } from "@/lib/newebpay/config";

/**
 * 藍新付款完成後前台導回（ReturnURL）。接收 POST 表單 TradeInfo / TradeSha，
 * 驗證並解密後 redirect 到結果頁 /payment/newebpay/result?orderNo=xxx。
 * 不讓 POST 打到 page route，避免 500。
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const tradeInfoEnc = (formData.get("TradeInfo") as string) ?? "";
  const tradeShaReceived = (formData.get("TradeSha") as string) ?? "";

  const rawKeys: string[] = [];
  formData.forEach((_, key) => rawKeys.push(key));
  console.log("[NewebPay result] POST received, raw body keys:", rawKeys);
  console.log("[NewebPay result] TradeInfo length:", tradeInfoEnc.length, "TradeSha length:", tradeShaReceived.length);

  const appUrl = getAppUrl();
  const resultPage = appUrl ? `${appUrl}/payment/newebpay/result` : "/payment/newebpay/result";
  const failUrl = `${resultPage}?error=return`;

  const creds = getNewebpayCreds();
  if (!creds) {
    console.error("[NewebPay result] 藍新金流未設定");
    return NextResponse.redirect(failUrl);
  }

  const expectedSha = newebpayTradeSha(tradeInfoEnc, creds.hashKey, creds.hashIv);
  if (tradeShaReceived.toUpperCase() !== expectedSha) {
    console.log("[NewebPay result] TradeSha 驗證失敗");
    return NextResponse.redirect(failUrl);
  }

  let decrypted: string;
  try {
    decrypted = newebpayAesDecrypt(tradeInfoEnc, creds.hashKey, creds.hashIv);
  } catch (e) {
    console.error("[NewebPay result] 解密失敗", e);
    return NextResponse.redirect(failUrl);
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
