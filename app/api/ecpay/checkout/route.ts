import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { ecpayCheckMacValue } from "@/lib/payment-utils";

const ECPAY_STAGE_URL = "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5";

function getEcpayCreds() {
  const id = process.env.ECPAY_MERCHANT_ID?.trim();
  const key = process.env.ECPAY_HASH_KEY?.trim();
  const iv = process.env.ECPAY_HASH_IV?.trim();
  if (!id || !key || !iv) return null;
  return { merchantId: id, hashKey: key, hashIv: iv };
}

/**
 * GET /api/ecpay/checkout?bookingId=xxx
 * 依 bookingId 取得訂單，組綠界參數並回傳自動 POST 表單（前端導向此 URL 即可送出至綠界）。
 */
export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get("bookingId");
  if (!bookingId) {
    return NextResponse.json({ error: "缺少 bookingId" }, { status: 400 });
  }

  const creds = getEcpayCreds();
  if (!creds) {
    return NextResponse.json({ error: "綠界金流未設定（ECPAY_MERCHANT_ID / HASH_KEY / HASH_IV）" }, { status: 500 });
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
  if (booking.payment_method !== "ecpay") {
    return NextResponse.json({ error: "此訂單非綠界付款" }, { status: 400 });
  }
  if (booking.status !== "unpaid") {
    return NextResponse.json({ error: "訂單狀態不允許付款" }, { status: 400 });
  }

  const amount = Math.max(0, Number(booking.order_amount) ?? 0);
  if (amount <= 0) {
    return NextResponse.json({ error: "訂單金額異常" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "";
  const returnUrl = `${baseUrl}/api/ecpay/callback`;

  const tradeNo = bookingId.replace(/-/g, "").slice(0, 20);
  const tradeDate = new Date().toLocaleString("sv-SE").replace("T", " ").slice(0, 19);

  await supabase
    .from("bookings")
    .update({ ecpay_merchant_trade_no: tradeNo })
    .eq("id", bookingId)
    .eq("status", "unpaid");

  const params: Record<string, string> = {
    MerchantID: creds.merchantId,
    MerchantTradeNo: tradeNo,
    MerchantTradeDate: tradeDate,
    PaymentType: "aio",
    TotalAmount: String(amount),
    TradeDesc: "課程報名",
    ItemName: "課程報名",
    ReturnURL: returnUrl,
    ChoosePayment: "Credit",
    EncryptType: "1",
  };

  params.CheckMacValue = ecpayCheckMacValue(params, creds.hashKey, creds.hashIv);

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>導向綠界付款</title></head>
<body>
<form id="ecpayForm" method="POST" action="${ECPAY_STAGE_URL}">
${Object.entries(params).map(([k, v]) => `  <input type="hidden" name="${k}" value="${v.replace(/"/g, "&quot;")}" />`).join("\n")}
</form>
<script>document.getElementById("ecpayForm").submit();</script>
<p>正在導向綠界付款頁…</p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
