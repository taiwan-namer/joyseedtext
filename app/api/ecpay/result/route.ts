import { NextRequest, NextResponse } from "next/server";
import { applyEcpayPaymentNotification } from "@/lib/ecpay/applyPaymentNotification";

export const dynamic = "force-dynamic";

/**
 * 綠界 OrderResultURL：瀏覽器 POST 付款結果至此。
 * 須與 ReturnURL 做**相同**建單／更新邏輯；若僅 redirect 而背景通知未到，pending 永在 → 結果頁永遠「處理中」。
 *
 * 導向結果頁一律用本請求 origin，避免 Preview 與 APP_URL 混用。
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const paramsRaw: Record<string, string> = {};
  formData.forEach((value, key) => {
    const raw = typeof value === "string" ? value : value instanceof File ? value.name : String(value);
    paramsRaw[key] = raw;
  });

  const paramsTrimmed: Record<string, string> = {};
  for (const k of Object.keys(paramsRaw)) {
    paramsTrimmed[k] = paramsRaw[k].trim();
  }
  const merchantTradeNo = paramsTrimmed.MerchantTradeNo ?? "";
  const rtnCode = paramsTrimmed.RtnCode ?? "";

  console.log("[ECPay result route] POST OrderResultURL MerchantTradeNo:", merchantTradeNo, "RtnCode:", rtnCode);

  const outcome = await applyEcpayPaymentNotification(paramsRaw);
  console.log("[ECPay result route] apply outcome:", outcome.status);

  const origin = request.nextUrl.origin.replace(/\/+$/, "");
  const resultPage = `${origin}/payment/ecpay/result`;
  const q = new URLSearchParams();
  if (merchantTradeNo) q.set("MerchantTradeNo", merchantTradeNo);
  if (outcome.status === "checkmac_invalid") q.set("ecpay_err", "checkmac");
  if (outcome.status === "rpc_failed" || outcome.status === "update_booking_failed") q.set("ecpay_err", "sync");

  const redirectTarget = q.toString() ? `${resultPage}?${q.toString()}` : resultPage;
  return NextResponse.redirect(redirectTarget, 302);
}
