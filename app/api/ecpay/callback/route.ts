import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { ecpayCheckMacValueFromReceived } from "@/lib/ecpay/checkmac";
import { ensureCapacityAndMarkPaid } from "@/lib/bookingPayment";

function getEcpayCreds() {
  const key = process.env.ECPAY_HASH_KEY?.trim();
  const iv = process.env.ECPAY_HASH_IV?.trim();
  if (!key || !iv) return null;
  return { hashKey: key, hashIv: iv };
}

const PLAIN_OK = "1|OK";
const PLAIN_HEADERS = { "Content-Type": "text/plain; charset=utf-8" };

/**
 * 綠界以 POST 背景通知付款結果（ReturnURL）。
 * 以「綠界回傳的完整參數」驗證 CheckMacValue，成功則更新訂單並回傳 1|OK。
 */
export async function POST(request: NextRequest) {
  console.log("[ECPay callback] route hit (ReturnURL)");

  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    const raw = typeof value === "string" ? value : value instanceof File ? value.name : String(value);
    params[key] = raw.trim();
  });

  const receivedCheckMac = params.CheckMacValue ?? "";
  const merchantTradeNo = params.MerchantTradeNo ?? "";
  const rtnCode = params.RtnCode ?? "";
  const tradeAmt = params.TradeAmt ?? "";
  const tradeNo = params.TradeNo ?? "";

  console.log("[ECPay callback] raw parsed body keys:", Object.keys(params).sort());
  console.log("[ECPay callback] MerchantTradeNo:", merchantTradeNo, "RtnCode:", rtnCode, "TradeAmt:", tradeAmt);
  console.log("[ECPay callback] received CheckMacValue (前 12 字元):", receivedCheckMac.slice(0, 12) + "...");

  const creds = getEcpayCreds();
  if (!creds) {
    console.error("[ECPay callback] 綠界金流未設定");
    return new NextResponse("0|綠界金流未設定", { status: 500, headers: PLAIN_HEADERS });
  }

  const generatedCheckMac = ecpayCheckMacValueFromReceived(params, creds.hashKey, creds.hashIv);
  const checkMacValid = receivedCheckMac.toUpperCase() === generatedCheckMac;

  console.log("[ECPay callback] generated CheckMacValue (前 12 字元):", generatedCheckMac.slice(0, 12) + "...");
  console.log("[ECPay callback] verify result:", checkMacValid ? "成功" : "失敗");

  if (!checkMacValid) {
    return new NextResponse("0|CheckMacValue 驗證失敗", { status: 400, headers: PLAIN_HEADERS });
  }

  if (rtnCode !== "1") {
    console.log("[ECPay callback] 非成功狀態 RtnCode:", rtnCode, "仍回傳 1|OK 避免重試");
    return new NextResponse(PLAIN_OK, { headers: PLAIN_HEADERS });
  }

  const supabase = createServerSupabase();
  let bookingRow: { id: string; class_id: string; merchant_id: string; slot_date: string | null; slot_time: string | null } | null = null;

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, class_id, merchant_id, slot_date, slot_time")
    .eq("ecpay_merchant_trade_no", merchantTradeNo)
    .eq("status", "unpaid")
    .maybeSingle();

  if (!fetchError && booking) {
    bookingRow = {
      id: (booking as { id: string }).id,
      class_id: (booking as { class_id?: string }).class_id ?? "",
      merchant_id: (booking as { merchant_id: string }).merchant_id,
      slot_date: (booking as { slot_date?: string | null }).slot_date ?? null,
      slot_time: (booking as { slot_time?: string | null }).slot_time ?? null,
    };
  }

  if (bookingRow) {
    const result = await ensureCapacityAndMarkPaid(supabase, bookingRow, {
      ecpay_trade_no: tradeNo,
    });
    if (!result.ok) {
      console.error("[ECPay callback] 更新訂單失敗", result.error);
      return new NextResponse("0|更新訂單失敗", { status: 500, headers: PLAIN_HEADERS });
    }
    console.log("[ECPay callback] 訂單已更新為 paid bookingId:", bookingRow.id, "update result: ok");
  } else {
    const { data: pending, error: pendingErr } = await supabase
      .from("pending_payments")
      .select("id")
      .eq("payment_method", "ecpay")
      .eq("gateway_key", merchantTradeNo)
      .maybeSingle();

    if (pendingErr || !pending) {
      console.log("[ECPay callback] 無對應 pending 仍回傳 1|OK");
      return new NextResponse(PLAIN_OK, { headers: PLAIN_HEADERS });
    }

    const { data: rpcResult, error: rpcErr } = await supabase.rpc("create_booking_from_pending", {
      p_pending_id: (pending as { id: string }).id,
    });
    if (rpcErr) {
      console.error("[ECPay callback] create_booking_from_pending", rpcErr);
      return new NextResponse("0|建立訂單失敗", { status: 500, headers: PLAIN_HEADERS });
    }
    const res = rpcResult as { ok?: boolean; booking_id?: string } | null;
    if (!res?.ok || !res.booking_id) {
      return new NextResponse(PLAIN_OK, { headers: PLAIN_HEADERS });
    }
    await supabase
      .from("bookings")
      .update({ ecpay_trade_no: tradeNo })
      .eq("id", res.booking_id);
    console.log("[ECPay callback] 從 pending 建立訂單成功 bookingId:", res.booking_id, "update result: ok");
  }

  revalidatePath("/member");
  return new NextResponse(PLAIN_OK, { headers: PLAIN_HEADERS });
}
