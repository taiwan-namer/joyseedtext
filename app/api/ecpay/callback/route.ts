import { NextRequest, NextResponse } from "next/server";
import { applyEcpayPaymentNotification } from "@/lib/ecpay/applyPaymentNotification";

const PLAIN_OK = "1|OK";
const PLAIN_HEADERS = { "Content-Type": "text/plain; charset=utf-8" };

/**
 * 綠界以 POST 背景通知付款結果（ReturnURL）。
 * 邏輯與 OrderResultURL（/api/ecpay/result）共用，避免僅瀏覽器導回時 pending 未清。
 */
export async function POST(request: NextRequest) {
  console.log("[ECPay callback] route hit (ReturnURL)");

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
  console.log("[ECPay callback] MerchantTradeNo:", paramsTrimmed.MerchantTradeNo ?? "", "RtnCode:", paramsTrimmed.RtnCode ?? "");

  const outcome = await applyEcpayPaymentNotification(paramsRaw);
  console.log("[ECPay callback] outcome:", outcome.status);

  switch (outcome.status) {
    case "checkmac_invalid":
      return new NextResponse("0|CheckMacValue 驗證失敗", { status: 400, headers: PLAIN_HEADERS });
    case "missing_client_id":
      return new NextResponse("0|未設定 NEXT_PUBLIC_CLIENT_ID", { status: 500, headers: PLAIN_HEADERS });
    case "missing_creds":
      return new NextResponse("0|綠界金流未設定", { status: 500, headers: PLAIN_HEADERS });
    case "update_booking_failed":
      return new NextResponse("0|更新訂單失敗", { status: 500, headers: PLAIN_HEADERS });
    case "rpc_failed":
      return new NextResponse("0|建立訂單失敗", { status: 500, headers: PLAIN_HEADERS });
    case "rtn_not_success":
    case "success":
    default:
      return new NextResponse(PLAIN_OK, { headers: PLAIN_HEADERS });
  }
}
