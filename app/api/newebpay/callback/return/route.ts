import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { newebpayAesDecrypt, newebpayTradeSha } from "@/lib/payment-utils";
import { getAppUrl } from "@/lib/appUrl";
import { getNewebpayCreds } from "@/lib/newebpay/config";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * 藍新付款完成後導回商店（ReturnURL）。接收 POST 表單 TradeInfo / TradeSha，
 * 驗證並解密後依 MerchantOrderNo 查詢對應訂單，導向結果頁或報名成功頁。絕不導向首頁 /。
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const tradeInfoEnc = (formData.get("TradeInfo") as string) ?? "";
  const tradeShaReceived = (formData.get("TradeSha") as string) ?? "";

  const appUrl = getAppUrl();
  const resultPage = appUrl ? `${appUrl}/payment/newebpay/result` : "/payment/newebpay/result";
  const failUrl = `${resultPage}?error=return`;
  const successPage = appUrl ? `${appUrl}/booking/success` : "/booking/success";

  const creds = getNewebpayCreds();
  if (!creds) {
    return NextResponse.redirect(failUrl);
  }

  const expectedSha = newebpayTradeSha(tradeInfoEnc, creds.hashKey, creds.hashIv);
  if (tradeShaReceived.toUpperCase() !== expectedSha) {
    return NextResponse.redirect(failUrl);
  }

  let decrypted: string;
  try {
    decrypted = newebpayAesDecrypt(tradeInfoEnc, creds.hashKey, creds.hashIv);
  } catch {
    return NextResponse.redirect(failUrl);
  }

  const params = new URLSearchParams(decrypted);
  const merchantOrderNo = params.get("MerchantOrderNo") ?? "";

  const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
  if (!merchantId) {
    return NextResponse.redirect(failUrl);
  }

  const supabase = createServerSupabase();
  const { data: row } = await supabase
    .from("bookings")
    .select("id")
    .eq("newebpay_merchant_order_no", merchantOrderNo)
    .eq("merchant_id", merchantId)
    .maybeSingle();

  const bookingId = row ? (row as { id: string }).id : merchantOrderNo;
  const successUrl = `${successPage}?bookingId=${encodeURIComponent(bookingId)}`;
  return NextResponse.redirect(successUrl);
}
