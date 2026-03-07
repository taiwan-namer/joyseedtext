import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { ecpayVerifyCheckMacValue } from "@/lib/payment-utils";

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
  const { data, error } = await supabase
    .from("bookings")
    .update({
      status: "paid",
      ecpay_trade_no: tradeNo,
    })
    .eq("ecpay_merchant_trade_no", merchantTradeNo)
    .eq("status", "unpaid")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[ECPay callback] 更新訂單失敗:", error);
    return new NextResponse("0|更新訂單失敗", { status: 500 });
  }
  if (!data) {
    return new NextResponse("1|OK");
  }

  revalidatePath("/member");
  return new NextResponse("1|OK", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
