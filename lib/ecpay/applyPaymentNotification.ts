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

export type ApplyEcpayPaymentOutcome =
  | { status: "success" }
  | { status: "rtn_not_success" }
  | { status: "checkmac_invalid" }
  | { status: "missing_client_id" }
  | { status: "missing_creds" }
  | { status: "update_booking_failed"; detail: string }
  | { status: "rpc_failed"; detail: string };

/**
 * 綠界付款結果處理：ReturnURL（背景）與 OrderResultURL（瀏覽器 POST）共用。
 * paramsRaw 須與簽章一致，勿對全部值先 trim（與 callback 相同）。
 */
export async function applyEcpayPaymentNotification(paramsRaw: Record<string, string>): Promise<ApplyEcpayPaymentOutcome> {
  const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
  if (!merchantId) return { status: "missing_client_id" };

  const paramsTrimmed: Record<string, string> = {};
  for (const k of Object.keys(paramsRaw)) {
    paramsTrimmed[k] = paramsRaw[k].trim();
  }

  const receivedCheckMac = paramsRaw.CheckMacValue ?? "";
  const merchantTradeNo = paramsTrimmed.MerchantTradeNo ?? "";
  const rtnCode = paramsTrimmed.RtnCode ?? "";
  const tradeNo = paramsTrimmed.TradeNo ?? "";

  const creds = getEcpayCreds();
  if (!creds) return { status: "missing_creds" };

  const generatedCheckMac = ecpayCheckMacValueFromReceived(paramsRaw, creds.hashKey, creds.hashIv);
  if (receivedCheckMac.toUpperCase() !== generatedCheckMac) {
    return { status: "checkmac_invalid" };
  }

  if (rtnCode !== "1") {
    return { status: "rtn_not_success" };
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
      revalidatePath("/member");
      return { status: "success" };
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
  }

  if (bookingRow) {
    const result = await ensureCapacityAndMarkPaid(supabase, bookingRow, {
      ecpay_trade_no: tradeNo,
    });
    if (!result.ok) {
      return { status: "update_booking_failed", detail: result.error };
    }
    const invoiceResult = await issueInvoice(supabase, bookingRow.id, bookingRow.merchant_id);
    if (!invoiceResult.ok) {
      await supabase.from("bookings").update({ invoice_status: "failed" }).eq("id", bookingRow.id).eq("merchant_id", bookingRow.merchant_id);
    } else {
      await supabase.from("bookings").update({ invoice_status: "issued" }).eq("id", bookingRow.id).eq("merchant_id", bookingRow.merchant_id);
    }
    revalidatePath("/member");
    return { status: "success" };
  }

  const { data: pending, error: pendingErr } = await supabase
    .from("pending_payments")
    .select("id")
    .eq("payment_method", "ecpay")
    .eq("gateway_key", merchantTradeNo)
    .eq("merchant_id", merchantId)
    .maybeSingle();

  if (pendingErr || !pending) {
    revalidatePath("/member");
    return { status: "success" };
  }

  const { data: rpcResult, error: rpcErr } = await supabase.rpc("create_booking_from_pending", {
    p_pending_id: (pending as { id: string }).id,
  });
  if (rpcErr) {
    return { status: "rpc_failed", detail: rpcErr.message };
  }
  const res = rpcResult as { ok?: boolean; booking_id?: string; error?: string } | null;
  if (!res?.ok || !res.booking_id) {
    const detail =
      typeof res?.error === "string" && res.error.trim() !== ""
        ? res.error.trim()
        : "create_booking_from_pending 未建立訂單";
    console.error("[ECPay apply] create_booking_from_pending 失敗:", detail, res);
    return { status: "rpc_failed", detail };
  }

  await supabase
    .from("bookings")
    .update({ ecpay_merchant_trade_no: merchantTradeNo, ecpay_trade_no: tradeNo })
    .eq("id", res.booking_id);

  const { data: createdBooking } = await supabase.from("bookings").select("merchant_id").eq("id", res.booking_id).single();
  const bookingOwnerMerchant = (createdBooking as { merchant_id?: string } | null)?.merchant_id ?? merchantId;
  const invoiceResult = await issueInvoice(supabase, res.booking_id, bookingOwnerMerchant);
  if (!invoiceResult.ok) {
    await supabase.from("bookings").update({ invoice_status: "failed" }).eq("id", res.booking_id);
  } else {
    await supabase.from("bookings").update({ invoice_status: "issued" }).eq("id", res.booking_id);
  }

  revalidatePath("/member");
  return { status: "success" };
}
