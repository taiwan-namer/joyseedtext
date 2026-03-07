import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { ecpayVerifyCheckMacValue } from "@/lib/payment-utils";
import { ensureCapacityAndMarkPaid } from "@/lib/bookingPayment";

function getEcpayCreds() {
  const key = process.env.ECPAY_HASH_KEY?.trim();
  const iv = process.env.ECPAY_HASH_IV?.trim();
  if (!key || !iv) return null;
  return { hashKey: key, hashIv: iv };
}

/**
 * 綠界以 POST 背景通知付款結果，驗證 CheckMacValue 後更新訂單為 paid 並寫入 ecpay_trade_no。
 * 回傳 1|OK 綠界才會視為成功。
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = typeof value === "string" ? value : value instanceof File ? value.name : String(value);
  });

  const creds = getEcpayCreds();
  if (!creds) {
    return new NextResponse("0|綠界金流未設定", { status: 500 });
  }

  if (!ecpayVerifyCheckMacValue(params, creds.hashKey, creds.hashIv)) {
    return new NextResponse("0|CheckMacValue 驗證失敗", { status: 400 });
  }

  const rtnCode = params.RtnCode;
  const tradeNo = params.TradeNo ?? "";
  const merchantTradeNo = params.MerchantTradeNo ?? "";

  if (rtnCode !== "1") {
    return new NextResponse("1|OK");
  }

  const supabase = createServerSupabase();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, class_id, merchant_id, slot_date, slot_time")
    .eq("ecpay_merchant_trade_no", merchantTradeNo)
    .eq("status", "unpaid")
    .maybeSingle();

  if (fetchError || !booking) {
    return new NextResponse("1|OK");
  }

  const bookingRow = {
    id: booking.id,
    class_id: booking.class_id ?? "",
    merchant_id: booking.merchant_id,
    slot_date: booking.slot_date ?? null,
    slot_time: booking.slot_time ?? null,
  };
  const result = await ensureCapacityAndMarkPaid(supabase, bookingRow, {
    status: "paid",
    ecpay_trade_no: tradeNo,
  });

  if (!result.ok) {
    console.error("[ECPay callback]", result.error);
    return new NextResponse("0|更新訂單失敗", { status: 500 });
  }

  revalidatePath("/member");
  return new NextResponse("1|OK", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
