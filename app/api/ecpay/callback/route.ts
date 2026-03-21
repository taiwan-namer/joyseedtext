import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { ecpayCheckMacValueFromReceived } from "@/lib/ecpay/checkmac";
import { ensureCapacityAndMarkPaid } from "@/lib/bookingPayment";
import { issueInvoice } from "@/lib/invoice/service";
import { bookingsVisibleToMerchantOrFilter } from "@/lib/bookingsMerchantFilter";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

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

  const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
  if (!merchantId) {
    console.error("[ECPay callback] 未設定 NEXT_PUBLIC_CLIENT_ID");
    return new NextResponse("0|未設定 NEXT_PUBLIC_CLIENT_ID", { status: 500, headers: PLAIN_HEADERS });
  }

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

  const receivedCheckMac = paramsRaw.CheckMacValue ?? "";
  const merchantTradeNo = paramsTrimmed.MerchantTradeNo ?? "";
  const rtnCode = paramsTrimmed.RtnCode ?? "";
  const tradeAmt = paramsTrimmed.TradeAmt ?? "";
  const tradeNo = paramsTrimmed.TradeNo ?? "";

  console.log("[ECPay callback] raw parsed body keys:", Object.keys(paramsRaw).sort());
  console.log("[ECPay callback] MerchantTradeNo:", merchantTradeNo, "RtnCode:", rtnCode, "TradeAmt:", tradeAmt);
  console.log("[ECPay callback] received CheckMacValue (前 12 字元):", receivedCheckMac.slice(0, 12) + "...");

  const creds = getEcpayCreds();
  if (!creds) {
    console.error("[ECPay callback] 綠界金流未設定");
    return new NextResponse("0|綠界金流未設定", { status: 500, headers: PLAIN_HEADERS });
  }

  const generatedCheckMac = ecpayCheckMacValueFromReceived(paramsRaw, creds.hashKey, creds.hashIv);
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
    .select("id, class_id, merchant_id, slot_date, slot_time, status")
    .eq("ecpay_merchant_trade_no", merchantTradeNo)
    .or(bookingsVisibleToMerchantOrFilter(merchantId))
    .maybeSingle();

  if (!fetchError && booking) {
    const status = (booking as { status?: string }).status ?? "";
    if (status === "paid" || status === "completed") {
      console.log("[ECPay callback] 訂單已為 paid/completed，冪等直接回 1|OK bookingId:", (booking as { id: string }).id);
      revalidatePath("/member");
      return new NextResponse(PLAIN_OK, { headers: PLAIN_HEADERS });
    }
    if (status === "unpaid") {
      bookingRow = {
        id: (booking as { id: string }).id,
        class_id: (booking as { class_id?: string }).class_id ?? "",
        merchant_id: (booking as { merchant_id: string }).merchant_id,
        slot_date: (booking as { slot_date?: string | null }).slot_date ?? null,
        slot_time: (booking as { slot_time?: string | null }).slot_time ?? null,
      };
    }
  } else if (!booking) {
    console.log("[ECPay callback] 無 booking 對應 ecpay_merchant_trade_no:", JSON.stringify(merchantTradeNo), "→ 改查 pending_payments");
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
    const invoiceResult = await issueInvoice(supabase, bookingRow.id, bookingRow.merchant_id);
    if (!invoiceResult.ok) {
      console.error("[ECPay callback] 發票開立失敗（不影響付款結果）bookingId:", bookingRow.id, "error:", invoiceResult.error);
      const { error: upErr } = await supabase
        .from("bookings")
        .update({ invoice_status: "failed" })
        .eq("id", bookingRow.id)
        .eq("merchant_id", bookingRow.merchant_id);
      if (upErr) {
        /* invoice_status 欄位可能尚未 migration */
      }
    } else {
      const { error: upErr } = await supabase
        .from("bookings")
        .update({ invoice_status: "issued" })
        .eq("id", bookingRow.id)
        .eq("merchant_id", bookingRow.merchant_id);
      if (upErr) {
        /* invoice_status 欄位可能尚未 migration */
      }
    }
  } else {
    const { data: pending, error: pendingErr } = await supabase
      .from("pending_payments")
      .select("id")
      .eq("payment_method", "ecpay")
      .eq("gateway_key", merchantTradeNo)
      .eq("merchant_id", merchantId)
      .maybeSingle();

    console.log("[ECPay callback] pending lookup gateway_key (trimmed):", JSON.stringify(merchantTradeNo), "length:", merchantTradeNo.length, "pending found:", !!pending, "pendingErr:", pendingErr?.message ?? null);

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
      .update({ ecpay_merchant_trade_no: merchantTradeNo, ecpay_trade_no: tradeNo })
      .eq("id", res.booking_id);
    console.log("[ECPay callback] 從 pending 建立訂單成功 bookingId:", res.booking_id, "update result: ok");
    const { data: createdBooking } = await supabase
      .from("bookings")
      .select("merchant_id")
      .eq("id", res.booking_id)
      .single();
    const bookingOwnerMerchant = (createdBooking as { merchant_id?: string } | null)?.merchant_id ?? merchantId;
    const invoiceResult = await issueInvoice(supabase, res.booking_id, bookingOwnerMerchant);
    if (!invoiceResult.ok) {
      console.error("[ECPay callback] 發票開立失敗（不影響付款結果）bookingId:", res.booking_id, "error:", invoiceResult.error);
      await supabase.from("bookings").update({ invoice_status: "failed" }).eq("id", res.booking_id);
    } else {
      await supabase.from("bookings").update({ invoice_status: "issued" }).eq("id", res.booking_id);
    }
  }

  revalidatePath("/member");
  return new NextResponse(PLAIN_OK, { headers: PLAIN_HEADERS });
}
