import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 綠界 OrderResultURL 專用：接收綠界 POST（付款完成後導回），不讓 POST 打到 page 造成 500。
 * 解析後 redirect 到結果頁 GET /payment/ecpay/result?MerchantTradeNo=xxx
 *
 * 導向網址**必須**用本請求的 host（request.nextUrl.origin），不可用 getAppUrl()：
 * 否則 Preview／與 APP_URL 不同網域時，會把使用者導到正式站，NEXT_PUBLIC_CLIENT_ID／建置版本不一致 → 永遠「處理中」。
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

  const origin = request.nextUrl.origin.replace(/\/+$/, "");
  const resultPage = `${origin}/payment/ecpay/result`;
  const redirectTarget = merchantTradeNo
    ? `${resultPage}?MerchantTradeNo=${encodeURIComponent(merchantTradeNo)}`
    : resultPage;

  console.log("[ECPay result route] redirect target:", redirectTarget);

  return NextResponse.redirect(redirectTarget, 302);
}
