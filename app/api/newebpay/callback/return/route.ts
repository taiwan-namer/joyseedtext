import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { newebpayAesDecrypt, newebpayTradeSha } from "@/lib/payment-utils";
import { resolvePublicBaseUrl } from "@/lib/appUrl";
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

  const appUrl = resolvePublicBaseUrl(request.nextUrl.origin);
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
  const { data: rows } = await supabase
    .from("bookings")
    .select("id, merchant_id, sold_via_merchant_id")
    .eq("newebpay_merchant_order_no", merchantOrderNo);
  const list = rows ?? [];
  const row =
    list.find(
      (r) =>
        (r as { merchant_id?: string }).merchant_id === merchantId ||
        (r as { sold_via_merchant_id?: string | null }).sold_via_merchant_id === merchantId
    ) ?? (list.length === 1 ? list[0] : undefined);

  const bookingId = row ? (row as { id: string }).id : merchantOrderNo;
  const successUrl = `${successPage}?bookingId=${encodeURIComponent(bookingId)}`;
  return NextResponse.redirect(successUrl);
}
