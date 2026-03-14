import type { SupabaseClient } from "@supabase/supabase-js";

export type BookingRow = {
  id: string;
  class_id: string;
  merchant_id: string;
  slot_date: string | null;
  slot_time: string | null;
};

/**
 * 付款成功時呼叫 DB RPC confirm_booking_paid，在單一交易內：
 * 鎖訂單與課程 → 檢查名額（有場次時僅 paid/completed 計入）→ 通過才更新為 paid 並寫入交易編號；
 * 無場次則扣 classes.capacity。避免「先查再更新」的競態造成超賣。
 * updatePayload 可含 status、line_pay_transaction_id、ecpay_trade_no、newebpay_trade_no 等，RPC 會寫入對應欄位。
 */
export async function ensureCapacityAndMarkPaid(
  supabase: SupabaseClient,
  booking: BookingRow,
  updatePayload: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const extra: Record<string, string> = {};
  if (typeof updatePayload.line_pay_transaction_id === "string") {
    extra.line_pay_transaction_id = updatePayload.line_pay_transaction_id;
  }
  if (typeof updatePayload.ecpay_trade_no === "string") {
    extra.ecpay_trade_no = updatePayload.ecpay_trade_no;
  }
  if (typeof updatePayload.newebpay_trade_no === "string") {
    extra.newebpay_trade_no = updatePayload.newebpay_trade_no;
  }

  const { data, error } = await supabase.rpc("confirm_booking_paid", {
    p_booking_id: booking.id,
    p_merchant_id: booking.merchant_id,
    p_extra: extra,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result || result.ok !== true) {
    return { ok: false, error: (result?.error as string) ?? "更新失敗" };
  }

  return { ok: true };
}
