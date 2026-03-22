import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { ecpayCheckMacValueFromReceived } from "@/lib/ecpay/checkmac";
import { ensureCapacityAndMarkPaid } from "@/lib/bookingPayment";
import { issueInvoice } from "@/lib/invoice/service";
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
  const paymentType = (paramsTrimmed.PaymentType ?? "").trim();

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

  // 勿使用 .eq(trade_no).or(merchant…) 鏈式寫法：PostgREST 易與預期 AND 組合不符，可能誤抓他筆訂單而略過 pending。
  const { data: tradeRows, error: fetchError } = await supabase
    .from("bookings")
    .select("id, class_id, merchant_id, slot_date, slot_time, status, sold_via_merchant_id")
    .eq("ecpay_merchant_trade_no", merchantTradeNo);

  if (fetchError) {
    console.error("[ECPay apply] bookings by MerchantTradeNo:", fetchError.message);
  }

  const rows = tradeRows ?? [];
  let booking =
    (rows.find(
      (r) =>
        (r as { merchant_id?: string }).merchant_id === merchantId ||
        (r as { sold_via_merchant_id?: string | null }).sold_via_merchant_id === merchantId
    ) as (typeof rows)[0] | undefined) ?? (rows.length === 1 ? rows[0] : undefined);

  if (booking) {
    const status = (booking as { status?: string }).status ?? "";
    if (status === "paid" || status === "completed") {
      const bid = (booking as { id: string }).id;
      const ownerMid = (booking as { merchant_id: string }).merchant_id;
      if (paymentType) {
        await supabase
          .from("bookings")
          .update({ ecpay_payment_type: paymentType })
          .eq("id", bid)
          .eq("merchant_id", ownerMid);
      }
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
    if (paymentType) {
      await supabase
        .from("bookings")
        .update({ ecpay_payment_type: paymentType })
        .eq("id", bookingRow.id)
        .eq("merchant_id", bookingRow.merchant_id);
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

  const { data: pendingRows, error: pendingErr } = await supabase
    .from("pending_payments")
    .select("id")
    .eq("payment_method", "ecpay")
    .eq("gateway_key", merchantTradeNo)
    .eq("merchant_id", merchantId)
    .limit(2);

  if (pendingErr) {
    console.error("[ECPay apply] pending_payments lookup:", pendingErr.message);
    return { status: "rpc_failed", detail: pendingErr.message };
  }
  const pending = pendingRows?.[0];
  if ((pendingRows?.length ?? 0) > 1) {
    console.warn("[ECPay apply] 多筆 pending 同 gateway_key，取第一筆:", merchantTradeNo);
  }
  if (!pending) {
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

  const { error: tradeUpErr } = await supabase
    .from("bookings")
    .update({
      ecpay_merchant_trade_no: merchantTradeNo,
      ecpay_trade_no: tradeNo,
      ...(paymentType ? { ecpay_payment_type: paymentType } : {}),
    })
    .eq("id", res.booking_id);
  if (tradeUpErr) {
    console.error("[ECPay apply] 寫入 ecpay_merchant_trade_no 失敗:", tradeUpErr.message);
    return { status: "update_booking_failed", detail: tradeUpErr.message };
  }

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
