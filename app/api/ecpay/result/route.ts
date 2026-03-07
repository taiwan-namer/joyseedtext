import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/appUrl";

/**
 * 綠界 OrderResultURL 專用：接收綠界 POST（付款完成後導回），不讓 POST 打到 page 造成 500。
 * 解析後 redirect 到結果頁 GET /payment/ecpay/result?MerchantTradeNo=xxx
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = typeof value === "string" ? value.trim() : value instanceof File ? value.name : String(value);
  });

  const merchantTradeNo = params.MerchantTradeNo ?? "";
  const rtnCode = params.RtnCode ?? "";
  const tradeAmt = params.TradeAmt ?? "";

  console.log("[ECPay result route] POST received, raw keys:", Object.keys(params));
  console.log("[ECPay result route] MerchantTradeNo:", merchantTradeNo, "RtnCode:", rtnCode, "TradeAmt:", tradeAmt);

  const appUrl = getAppUrl();
  const resultPage = appUrl ? `${appUrl}/payment/ecpay/result` : "/payment/ecpay/result";
  const redirectTarget = merchantTradeNo
    ? `${resultPage}?MerchantTradeNo=${encodeURIComponent(merchantTradeNo)}`
    : resultPage;

  console.log("[ECPay result route] redirect target:", redirectTarget);

  return NextResponse.redirect(redirectTarget, 302);
}
