import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentLogRow = {
  merchant_id?: string | null;
  order_id?: string | null;
  transaction_id?: string | null;
  api_type: "request" | "confirm";
  request_body?: string | null;
  response_body?: string | null;
  return_code?: string | null;
  return_message?: string | null;
};

/**
 * 寫入 payment_logs 表，記錄 LINE Pay 請求/回應。
 * 若 payment_logs 表不存在，insert 會失敗，不影響主流程（僅 catch 並 console.error）。
 */
export async function logPaymentApi(
  supabase: SupabaseClient,
  row: PaymentLogRow
): Promise<void> {
  try {
    const { error } = await supabase.from("payment_logs").insert({
      merchant_id: row.merchant_id ?? null,
      order_id: row.order_id ?? null,
      transaction_id: row.transaction_id ?? null,
      api_type: row.api_type,
      request_body: row.request_body ?? null,
      response_body: row.response_body ?? null,
      return_code: row.return_code ?? null,
      return_message: row.return_message ?? null,
    });
    if (error) {
      console.error("[payment_logs] 寫入失敗:", error.message);
    }
  } catch (e) {
    console.error("[payment_logs] 寫入異常:", e);
  }
}
