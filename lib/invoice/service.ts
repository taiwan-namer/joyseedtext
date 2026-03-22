/**
 * 發票開立中介層：依訂單編號與後台「發票廠商」設定開立發票。
 * 金流 callback 付款成功後呼叫，發票失敗不影響 callback 回傳，僅 log。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStoreSettingsForMerchant } from "@/app/actions/storeSettingsActions";
import { buildEcpayItemsFromStore, issueEcpayInvoice } from "@/lib/invoice/ecpay-issue";
import { issueEzpayInvoice } from "@/lib/invoice/ezpay-issue";

export type IssueInvoiceResult =
  | { ok: true; raw?: string; invoiceNo?: string }
  | { ok: false; error: string };

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * 依訂單 ID 開立電子發票（使用後台設定的品項與綠界／ezPay API）。
 *
 * **與 `ecpay_payment_type` 無關**：該欄位僅來自「綠界收款」付款通知，供綠界**退刷**判斷是否信用卡。
 * 藍新付款時不會、也不需寫入 `ecpay_payment_type`。綠界 B2C 發票開立參數不含 PaymentType。
 *
 * **RelateNumber**：優先 `ecpay_merchant_trade_no`，否則 `newebpay_merchant_order_no`，再否則訂單 UUID
 *（藍新付 + 綠界發票時用藍新訂單編號即可）。
 */
export async function issueInvoice(
  supabase: SupabaseClient,
  bookingId: string,
  merchantId?: string
): Promise<IssueInvoiceResult> {
  const safeMerchantId = (merchantId ?? envTrim("NEXT_PUBLIC_CLIENT_ID")).trim();
  if (!safeMerchantId) {
    return { ok: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
  }
  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, member_email, parent_name, parent_phone, order_amount, ecpay_merchant_trade_no, newebpay_merchant_order_no")
    .eq("id", bookingId)
    .eq("merchant_id", safeMerchantId)
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

  const store = await getStoreSettingsForMerchant(safeMerchantId);
  const provider = store.invoiceProvider === "ezpay" ? "ezpay" : "ecpay";

  const invoiceFail = async () => {
    await supabase
      .from("bookings")
      .update({ invoice_status: "failed" })
      .eq("id", bookingId)
      .eq("merchant_id", safeMerchantId);
  };

  const invoiceIssued = async (patch: { invoice_no?: string | null }) => {
    const row: { invoice_status: string; invoice_no?: string | null } = { invoice_status: "issued" };
    if (patch.invoice_no != null && String(patch.invoice_no).trim() !== "") {
      row.invoice_no = String(patch.invoice_no).trim();
    }
    await supabase.from("bookings").update(row).eq("id", bookingId).eq("merchant_id", safeMerchantId);
  };

  if (provider === "ezpay") {
    const result = await issueEzpayInvoice({
      relateNumber,
      customerName,
      customerAddr,
      customerPhone,
      customerEmail,
      salesAmount: amount,
    });
    if (!result.ok) {
      await invoiceFail();
      return result;
    }
    await invoiceIssued({});
    return { ok: true, raw: result.raw };
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

  if (!result.ok) {
    await invoiceFail();
    return { ok: false, error: result.error };
  }

  await invoiceIssued({ invoice_no: result.invoiceNo ?? null });
  return { ok: true, raw: result.raw, invoiceNo: result.invoiceNo };
}
