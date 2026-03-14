/**
 * 發票開立中介層：依訂單編號與後台「發票廠商」設定開立發票。
 * 金流 callback 付款成功後呼叫，發票失敗不影響 callback 回傳，僅 log。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoreSettings } from "@/app/actions/storeSettingsActions";
import { buildEcpayItemsFromStore, issueEcpayInvoice } from "@/lib/invoice/ecpay-issue";
import { issueEzpayInvoice } from "@/lib/invoice/ezpay-issue";

export type IssueInvoiceResult =
  | { ok: true; raw?: string }
  | { ok: false; error: string };

/**
 * 依訂單 ID 開立電子發票（使用後台設定的品項與綠界發票 API）。
 * 若發票金鑰未設定、訂單無金額或開立失敗，回傳 { ok: false }，不拋錯。
 */
export async function issueInvoice(
  supabase: SupabaseClient,
  bookingId: string
): Promise<IssueInvoiceResult> {
  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, member_email, parent_name, parent_phone, order_amount, ecpay_merchant_trade_no, newebpay_merchant_order_no")
    .eq("id", bookingId)
    .maybeSingle();

  if (fetchErr || !booking) {
    return { ok: false, error: fetchErr?.message ?? "訂單不存在" };
  }

  const row = booking as {
    member_email?: string | null;
    parent_name?: string | null;
    parent_phone?: string | null;
    order_amount?: number | null;
    ecpay_merchant_trade_no?: string | null;
    newebpay_merchant_order_no?: string | null;
  };

  const amount = typeof row.order_amount === "number" && row.order_amount > 0 ? row.order_amount : null;
  if (amount == null || amount <= 0) {
    return { ok: false, error: "訂單無金額，略過開立發票" };
  }

  const relateNumber =
    (row.ecpay_merchant_trade_no ?? row.newebpay_merchant_order_no ?? bookingId) as string;
  const customerName = (row.parent_name ?? "顧客").toString().trim().slice(0, 60) || "顧客";
  const customerEmail = (row.member_email ?? "").toString().trim().slice(0, 80) || "noreply@example.com";
  const customerPhone = (row.parent_phone ?? "").toString().trim().slice(0, 20);
  const customerAddr = " "; // 不列印時可留空；綠界 B2C 不列印時未強制

  const store = await getStoreSettings();
  const provider = store.invoiceProvider === "ezpay" ? "ezpay" : "ecpay";

  if (provider === "ezpay") {
    const result = await issueEzpayInvoice({
      relateNumber,
      customerName,
      customerAddr,
      customerPhone,
      customerEmail,
      salesAmount: amount,
    });
    return result;
  }

  const { items: ecpayItems, salesAmount } = await buildEcpayItemsFromStore(amount);

  const result = await issueEcpayInvoice({
    relateNumber,
    customerName,
    customerAddr,
    customerPhone,
    customerEmail,
    salesAmount,
    ecpayItems,
  });

  return result;
}
