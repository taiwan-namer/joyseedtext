import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { newebpayAesDecrypt, newebpayTradeSha } from "@/lib/payment-utils";

function getNewebpayCreds() {
  const key = process.env.NEWEBPAY_HASH_KEY?.trim();
  const iv = process.env.NEWEBPAY_HASH_IV?.trim();
  if (!key || !iv) return null;
  return { hashKey: key, hashIv: iv };
}

/**
 * 藍新以 POST 背景通知（NotifyURL），Body 為 JSON: { TradeInfo, TradeSha }。
 * 解密 TradeInfo 後驗證 TradeSha，成功則更新訂單為 paid 並寫入 newebpay_trade_no。
 */
export async function POST(request: NextRequest) {
  let body: { TradeInfo?: string; TradeSha?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tradeInfoEnc = body.TradeInfo ?? "";
  const tradeShaReceived = body.TradeSha ?? "";

  const creds = getNewebpayCreds();
  if (!creds) {
    return NextResponse.json({ error: "藍新金流未設定" }, { status: 500 });
  }

  const expectedSha = newebpayTradeSha(tradeInfoEnc, creds.hashKey, creds.hashIv);
  if (tradeShaReceived.toUpperCase() !== expectedSha) {
    return NextResponse.json({ error: "TradeSha 驗證失敗" }, { status: 400 });
  }

  let decrypted: string;
  try {
    decrypted = newebpayAesDecrypt(tradeInfoEnc, creds.hashKey, creds.hashIv);
  } catch (e) {
    console.error("[NewebPay callback] 解密失敗:", e);
    return NextResponse.json({ error: "解密失敗" }, { status: 400 });
  }

  const params = new URLSearchParams(decrypted);
  const status = params.get("Status");
  const tradeNo = params.get("TradeNo") ?? "";
  const merchantOrderNo = params.get("MerchantOrderNo") ?? "";

  if (status !== "SUCCESS") {
    return NextResponse.json({ message: "payment not success" });
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("bookings")
    .update({
      status: "paid",
      newebpay_trade_no: tradeNo,
    })
    .eq("newebpay_merchant_order_no", merchantOrderNo)
    .eq("status", "unpaid")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[NewebPay callback] 更新訂單失敗:", error);
    return NextResponse.json({ error: "更新訂單失敗" }, { status: 500 });
  }

  if (data) {
    revalidatePath("/member");
  }

  return NextResponse.json({ message: "OK" });
}
