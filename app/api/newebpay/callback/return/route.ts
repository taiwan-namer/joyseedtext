import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { newebpayAesDecrypt, newebpayTradeSha } from "@/lib/payment-utils";

function getNewebpayCreds() {
  const key = process.env.NEWEBPAY_HASH_KEY?.trim();
  const iv = process.env.NEWEBPAY_HASH_IV?.trim();
  if (!key || !iv) return null;
  return { hashKey: key, hashIv: iv };
}

/**
 * 藍新付款完成後導回商店（ReturnURL）。接收 POST 表單 TradeInfo / TradeSha，
 * 驗證並解密後依 MerchantOrderNo 查詢對應訂單 id，導向報名成功頁。
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const tradeInfoEnc = (formData.get("TradeInfo") as string) ?? "";
  const tradeShaReceived = (formData.get("TradeSha") as string) ?? "";

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "";
  const failUrl = `${baseUrl}/?error=newebpay_return`;

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

  const supabase = createServerSupabase();
  const { data: row } = await supabase
    .from("bookings")
    .select("id")
    .eq("newebpay_merchant_order_no", merchantOrderNo)
    .maybeSingle();

  const bookingId = row ? (row as { id: string }).id : merchantOrderNo;
  const successUrl = `${baseUrl}/booking/success?bookingId=${encodeURIComponent(bookingId)}`;
  return NextResponse.redirect(successUrl);
}
