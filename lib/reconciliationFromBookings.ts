import { parseBookingAmountsForAdmin } from "@/lib/bookingAdminAmounts";
import { commissionFromCourseAmount, parseCommissionRate } from "@/lib/commission";
import { MARKETPLACE_MERCHANT_ID } from "@/lib/constants";

export type ReconciliationBookingRow = {
  id: string;
  created_at: string;
  order_amount: number | null;
  metadata: unknown;
  status: string;
  merchant_id?: string | null;
  sold_via_merchant_id?: string | null;
  classes: {
    title: string | null;
    price: number | null;
    merchant_id: string | null;
  } | null;
};

/** PostgREST 嵌套 `classes` 可能為單一物件或單元素陣列 */
export function normalizeReconciliationBookingRows(raw: unknown[]): ReconciliationBookingRow[] {
  const out: ReconciliationBookingRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    let clsRaw = row.classes;
    if (Array.isArray(clsRaw)) clsRaw = clsRaw[0];
    let classes: ReconciliationBookingRow["classes"] = null;
    if (clsRaw && typeof clsRaw === "object" && !Array.isArray(clsRaw)) {
      const c = clsRaw as Record<string, unknown>;
      classes = {
        title: c.title != null ? String(c.title) : null,
        price: c.price != null && Number.isFinite(Number(c.price)) ? Number(c.price) : null,
        merchant_id: c.merchant_id != null ? String(c.merchant_id).trim() : null,
      };
    }
    out.push({
      id: String(row.id ?? ""),
      created_at: String(row.created_at ?? ""),
      order_amount: row.order_amount != null && Number.isFinite(Number(row.order_amount)) ? Number(row.order_amount) : null,
      metadata: row.metadata,
      status: String(row.status ?? ""),
      merchant_id: row.merchant_id != null ? String(row.merchant_id).trim() : null,
      sold_via_merchant_id:
        row.sold_via_merchant_id != null && String(row.sold_via_merchant_id).trim() !== ""
          ? String(row.sold_via_merchant_id).trim()
          : null,
      classes,
    });
  }
  return out;
}

/** 總站 marketplace 結帳 vs 本分站（或舊資料未填 sold_via 且訂單歸本店） */
export function classifyPurchaseChannelForBranchAdmin(
  branchMerchantId: string,
  row: Pick<ReconciliationBookingRow, "sold_via_merchant_id" | "merchant_id">
): "hq" | "local" {
  const hq = MARKETPLACE_MERCHANT_ID.trim();
  const sold = (row.sold_via_merchant_id ?? "").trim();
  const merchant = (row.merchant_id ?? "").trim();
  if (sold === hq) return "hq";
  if (sold === branchMerchantId) return "local";
  if (!sold) {
    return merchant === branchMerchantId ? "local" : "hq";
  }
  return "local";
}

export type ReconciliationLine = {
  booking_id: string;
  created_at: string;
  supplier_merchant_id: string;
  supplier_label: string;
  class_title: string;
  order_total: number;
  course_amount: number;
  peace_addon_amount: number;
  commission_rate_percent: number;
  commission_amount: number;
  course_net_after_commission: number;
  purchase_channel: "hq" | "local";
};

export function buildReconciliationLines(
  rows: ReconciliationBookingRow[],
  commissionByMerchant: Map<string, number>,
  branchSiteRateByMerchant: Map<string, number>,
  labelByMerchant: Map<string, string>,
  branchMerchantId: string
): ReconciliationLine[] {
  const out: ReconciliationLine[] = [];
  for (const r of rows) {
    if (r.status !== "paid" && r.status !== "completed") continue;
    const cls = r.classes;
    const supplierMid =
      cls?.merchant_id != null && String(cls.merchant_id).trim()
        ? String(cls.merchant_id).trim()
        : "";
    if (!supplierMid) continue;

    const parsed = parseBookingAmountsForAdmin(r.order_amount, r.metadata);
    const orderTotal = parsed.orderAmount ?? 0;
    const peace = parsed.peaceAddonAmount;
    const courseAmount =
      parsed.baseAmount != null ? parsed.baseAmount : Math.max(0, orderTotal - peace);

    const purchase_channel = classifyPurchaseChannelForBranchAdmin(branchMerchantId, r);
    const rawRate =
      purchase_channel === "hq"
        ? commissionByMerchant.get(supplierMid) ?? 0
        : branchSiteRateByMerchant.get(supplierMid) ?? 0;
    const rate = parseCommissionRate(rawRate);
    const commissionAmt = commissionFromCourseAmount(courseAmount, rate);
    const courseNet = Math.max(0, courseAmount - commissionAmt);

    out.push({
      booking_id: r.id,
      created_at: r.created_at,
      supplier_merchant_id: supplierMid,
      supplier_label: labelByMerchant.get(supplierMid) || supplierMid,
      class_title: (cls?.title && String(cls.title).trim()) || "—",
      order_total: orderTotal,
      course_amount: courseAmount,
      peace_addon_amount: peace,
      commission_rate_percent: rate,
      commission_amount: commissionAmt,
      course_net_after_commission: courseNet,
      purchase_channel,
    });
  }
  return out;
}

export function sumReconciliationTotals(lines: ReconciliationLine[]) {
  return lines.reduce(
    (acc, l) => {
      acc.course_amount += l.course_amount;
      acc.peace_addon += l.peace_addon_amount;
      acc.commission += l.commission_amount;
      acc.net += l.course_net_after_commission;
      acc.order_total += l.order_total;
      return acc;
    },
    { course_amount: 0, peace_addon: 0, commission: 0, net: 0, order_total: 0 }
  );
}
