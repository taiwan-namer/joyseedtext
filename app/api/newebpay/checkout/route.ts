import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { newebpayAesEncrypt, newebpayTradeSha, newebpayQueryString } from "@/lib/payment-utils";

const NEWEBPAY_STAGE_URL = "https://ccore.newebpay.com/MPG/mpg_gateway";

function getNewebpayCreds() {
  const id = process.env.NEWEBPAY_MERCHANT_ID?.trim();
  const key = process.env.NEWEBPAY_HASH_KEY?.trim();
  const iv = process.env.NEWEBPAY_HASH_IV?.trim();
  if (!id || !key || !iv) return null;
  return { merchantId: id, hashKey: key, hashIv: iv };
}

/**
 * GET /api/newebpay/checkout?bookingId=xxx
 * 依 bookingId 取得訂單，組藍新 TradeInfo + TradeSha，回傳自動 POST 表單。
 */
export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get("bookingId");
  if (!bookingId) {
    return NextResponse.json({ error: "缺少 bookingId" }, { status: 400 });
  }

  const creds = getNewebpayCreds();
  if (!creds) {
    return NextResponse.json({ error: "藍新金流未設定（NEWEBPAY_MERCHANT_ID / HASH_KEY / HASH_IV）" }, { status: 500 });
  }

  const supabase = createServerSupabase();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, merchant_id, order_amount, status, payment_method")
    .eq("id", bookingId)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: "訂單不存在" }, { status: 404 });
  }
  if (booking.payment_method !== "newebpay") {
    return NextResponse.json({ error: "此訂單非藍新付款" }, { status: 400 });
  }
  if (booking.status !== "unpaid") {
    return NextResponse.json({ error: "訂單狀態不允許付款" }, { status: 400 });
  }

  const amount = Math.max(0, Number(booking.order_amount) ?? 0);
  if (amount <= 0) {
    return NextResponse.json({ error: "訂單金額異常" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "";
  const returnUrl = `${baseUrl}/api/newebpay/callback/return`;
  const notifyUrl = `${baseUrl}/api/newebpay/callback`;

  const merchantOrderNo = bookingId.replace(/-/g, "").slice(0, 30);
  await supabase
    .from("bookings")
    .update({ newebpay_merchant_order_no: merchantOrderNo })
    .eq("id", bookingId)
    .eq("status", "unpaid");

  const tradeInfoObj = {
    MerchantID: creds.merchantId,
    RespondType: "JSON",
    TimeStamp: String(Math.floor(Date.now() / 1000)),
    Version: "2.0",
    MerchantOrderNo: merchantOrderNo,
    Amt: amount,
    ItemDesc: "課程報名",
    ReturnURL: returnUrl,
    NotifyURL: notifyUrl,
  };

  const tradeInfoPlain = newebpayQueryString(tradeInfoObj);
  const tradeInfo = newebpayAesEncrypt(tradeInfoPlain, creds.hashKey, creds.hashIv);
  const tradeSha = newebpayTradeSha(tradeInfo, creds.hashKey, creds.hashIv);

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>導向藍新付款</title></head>
<body>
<form id="npForm" method="POST" action="${NEWEBPAY_STAGE_URL}">
  <input type="hidden" name="MerchantID" value="${creds.merchantId.replace(/"/g, "&quot;")}" />
  <input type="hidden" name="TradeInfo" value="${tradeInfo.replace(/"/g, "&quot;")}" />
  <input type="hidden" name="TradeSha" value="${tradeSha.replace(/"/g, "&quot;")}" />
  <input type="hidden" name="Version" value="2.0" />
</form>
<script>document.getElementById("npForm").submit();</script>
<p>正在導向藍新付款頁…</p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
