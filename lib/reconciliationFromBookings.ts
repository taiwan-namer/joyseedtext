import type { SupabaseClient } from "@supabase/supabase-js";
import { parseBookingAmountsForAdmin } from "@/lib/bookingAdminAmounts";
import { commissionFromCourseAmount, parseCommissionRate } from "@/lib/commission";
import { classifyPurchaseChannelForBranchAdmin } from "@/lib/purchaseChannelForBranch";

/** 對帳：`orders.booking_id` 查詢欄位（與 finalize_order_after_booking_paid 寫入欄位對齊） */
export const RECON_ORDERS_FOR_BOOKING_FIELDS =
  "id, booking_id, payment_status, accounting_status, recognized_at, total_amount, peace_addon_amount, final_course_amount, commission_amount, vendor_net_amount, applied_commission_rate_percent, is_trial_first_purchase, created_at";

export type ReconciliationBookingRow = {
  id: string;
  created_at: string;
  /** 訂單結算店（bookings.merchant_id） */
  booking_merchant_id: string | null;
  sold_via_merchant_id: string | null;
  order_amount: number | null;
  metadata: unknown;
  status: string;
  classes: {
    title: string | null;
    price: number | null;
    merchant_id: string | null;
  } | null;
  attached_order: AttachedOrderSnapshot | null;
};

export type AttachedOrderSnapshot = {
  id: string;
  payment_status: string;
  accounting_status: string | null;
  recognized_at: string | null;
  total_amount: number | null;
  peace_addon_amount: number;
  final_course_amount: number | null;
  commission_amount: number;
  vendor_net_amount: number;
  applied_commission_rate_percent: number | null;
  is_trial_first_purchase: boolean;
  created_at: string;
};

function asInt(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function asOptionalInt(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

export function parseAttachedOrderRecord(raw: Record<string, unknown>): AttachedOrderSnapshot | null {
  const id = raw.id != null ? String(raw.id).trim() : "";
  if (!id) return null;
  return {
    id,
    payment_status: String(raw.payment_status ?? ""),
    accounting_status: raw.accounting_status != null ? String(raw.accounting_status) : null,
    recognized_at: raw.recognized_at != null ? String(raw.recognized_at) : null,
    total_amount: asOptionalInt(raw.total_amount),
    peace_addon_amount: asInt(raw.peace_addon_amount, 0),
    final_course_amount: asOptionalInt(raw.final_course_amount),
    commission_amount: asInt(raw.commission_amount, 0),
    vendor_net_amount: asInt(raw.vendor_net_amount, 0),
    applied_commission_rate_percent:
      raw.applied_commission_rate_percent == null
        ? null
        : (() => {
            const n =
              typeof raw.applied_commission_rate_percent === "number"
                ? raw.applied_commission_rate_percent
                : Number(raw.applied_commission_rate_percent);
            return Number.isFinite(n) ? n : null;
          })(),
    is_trial_first_purchase:
      raw.is_trial_first_purchase === true ||
      raw.is_trial_first_purchase === "true" ||
      raw.is_trial_first_purchase === 1,
    created_at: String(raw.created_at ?? ""),
  };
}

export function pickEmbeddedOrderForReconciliation(embed: unknown): AttachedOrderSnapshot | null {
  const candidates: AttachedOrderSnapshot[] = [];
  if (Array.isArray(embed)) {
    for (const el of embed) {
      if (el && typeof el === "object" && !Array.isArray(el)) {
        const p = parseAttachedOrderRecord(el as Record<string, unknown>);
        if (p) candidates.push(p);
      }
    }
  } else if (embed && typeof embed === "object" && !Array.isArray(embed)) {
    const p = parseAttachedOrderRecord(embed as Record<string, unknown>);
    if (p) candidates.push(p);
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const recA =
      a.accounting_status === "recognized" || (a.recognized_at != null && String(a.recognized_at).trim() !== "")
        ? 1
        : 0;
    const recB =
      b.accounting_status === "recognized" || (b.recognized_at != null && String(b.recognized_at).trim() !== "")
        ? 1
        : 0;
    if (recB !== recA) return recB - recA;
    const ta = Date.parse(a.created_at);
    const tb = Date.parse(b.created_at);
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
  return candidates[0];
}

export function groupOrderRowsByBookingId(rows: Record<string, unknown>[]): Map<string, unknown[]> {
  const m = new Map<string, unknown[]>();
  for (const raw of rows) {
    const bid = raw.booking_id != null ? String(raw.booking_id).trim() : "";
    if (!bid) continue;
    let arr = m.get(bid);
    if (!arr) {
      arr = [];
      m.set(bid, arr);
    }
    arr.push(raw);
  }
  return m;
}

export function attachOrdersArraysToBookingRaws(
  rawBookings: unknown[],
  byBookingId: Map<string, unknown[]>
): unknown[] {
  return rawBookings.map((b) => {
    if (!b || typeof b !== "object") return b;
    const row = b as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    return { ...row, orders: id ? (byBookingId.get(id) ?? []) : [] };
  });
}

export async function fetchOrderRowsForReconciliation(
  supabase: SupabaseClient,
  bookingIds: string[]
): Promise<Record<string, unknown>[]> {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of bookingIds) {
    const t = String(id).trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    ids.push(t);
  }
  if (ids.length === 0) return [];
  const chunkSize = 200;
  const all: Record<string, unknown>[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("orders")
      .select(RECON_ORDERS_FOR_BOOKING_FIELDS)
      .in("booking_id", chunk);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      if (r && typeof r === "object") all.push(r as Record<string, unknown>);
    }
  }
  return all;
}

export function orderSnapshotIsAuthoritative(o: AttachedOrderSnapshot | null): boolean {
  if (!o || o.payment_status !== "paid") return false;
  if ((o.accounting_status ?? "").toLowerCase() === "recognized") return true;
  if (o.recognized_at != null && String(o.recognized_at).trim() !== "") return true;
  return false;
}

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
    const bookingMidRaw = row.merchant_id;
    const booking_merchant_id =
      bookingMidRaw != null && String(bookingMidRaw).trim() !== "" ? String(bookingMidRaw).trim() : null;

    const embedOrders = row.orders ?? row.orders_fkey ?? row.order;
    const attached_order = pickEmbeddedOrderForReconciliation(embedOrders);

    out.push({
      id: String(row.id ?? ""),
      created_at: String(row.created_at ?? ""),
      booking_merchant_id,
      sold_via_merchant_id:
        row.sold_via_merchant_id != null && String(row.sold_via_merchant_id).trim() !== ""
          ? String(row.sold_via_merchant_id).trim()
          : null,
      order_amount: row.order_amount != null && Number.isFinite(Number(row.order_amount)) ? Number(row.order_amount) : null,
      metadata: row.metadata,
      status: String(row.status ?? ""),
      classes,
      attached_order,
    });
  }
  return out;
}

function coerceBookingMetadata(metadata: unknown): Record<string, unknown> | null {
  if (metadata == null) return null;
  if (typeof metadata === "string") {
    try {
      const p = JSON.parse(metadata) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      return null;
    }
    return null;
  }
  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return null;
}

function deriveTrialFirstFromMetadata(metadata: unknown): boolean {
  const m = coerceBookingMetadata(metadata);
  if (!m) return false;
  if (m.trial_discount_enabled === true) {
    const amt = Number(m.trial_discount_amount);
    return Number.isFinite(amt) && amt > 0;
  }
  const amt = Number(m.trial_discount_amount);
  return Number.isFinite(amt) && amt > 0;
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
  /** 客付總額 − 平台服務費（≥0）；平台服務費仍依課程金額×抽成% */
  course_net_after_commission: number;
  is_trial_first_purchase: boolean;
  purchase_channel: "hq" | "local";
};

type LineCore = Omit<ReconciliationLine, "purchase_channel">;

function buildLineFromOrderSnapshot(params: {
  row: ReconciliationBookingRow;
  supplierMid: string;
  supplierLabel: string;
  title: string;
  o: AttachedOrderSnapshot;
}): LineCore {
  const { row, supplierMid, supplierLabel, title, o } = params;
  const peace = Math.max(0, o.peace_addon_amount);
  const finalCourse = Math.max(0, o.final_course_amount ?? 0);
  const sumParts = finalCourse + peace;

  const bookingPaid =
    row.order_amount != null && Number.isFinite(Number(row.order_amount)) && Number(row.order_amount) >= 0
      ? Math.round(Number(row.order_amount))
      : null;

  let orderTotal: number;
  if (bookingPaid != null && bookingPaid > 0) {
    orderTotal = bookingPaid;
  } else if (o.total_amount != null && Number.isFinite(Number(o.total_amount))) {
    orderTotal = Math.max(0, Math.round(Number(o.total_amount)));
    if (sumParts > 0 && Math.abs(orderTotal - sumParts) <= 1) {
      orderTotal = sumParts;
    } else if (sumParts > 0 && orderTotal > sumParts + 1) {
      orderTotal = sumParts;
    }
  } else {
    orderTotal = sumParts;
  }
  const rate = parseCommissionRate(o.applied_commission_rate_percent ?? 0);
  const commissionAmt = Math.max(0, o.commission_amount);
  const courseNet = Math.max(0, orderTotal - commissionAmt);

  return {
    booking_id: row.id,
    created_at: row.created_at,
    supplier_merchant_id: supplierMid,
    supplier_label: supplierLabel,
    class_title: title,
    order_total: orderTotal,
    course_amount: finalCourse,
    peace_addon_amount: peace,
    commission_rate_percent: rate,
    commission_amount: commissionAmt,
    course_net_after_commission: courseNet,
    is_trial_first_purchase: o.is_trial_first_purchase === true,
  };
}

function purchaseChannelForRow(branchMerchantId: string, r: ReconciliationBookingRow) {
  return classifyPurchaseChannelForBranchAdmin(branchMerchantId, {
    merchant_id: r.booking_merchant_id,
    sold_via_merchant_id: r.sold_via_merchant_id,
  });
}

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
      cls?.merchant_id != null && String(cls.merchant_id).trim() ? String(cls.merchant_id).trim() : "";
    if (!supplierMid) continue;

    const supplierLabel = labelByMerchant.get(supplierMid) || supplierMid;
    const title = (cls?.title && String(cls.title).trim()) || "—";
    const purchase_channel = purchaseChannelForRow(branchMerchantId, r);
    const rawRate =
      purchase_channel === "hq"
        ? commissionByMerchant.get(supplierMid) ?? 0
        : branchSiteRateByMerchant.get(supplierMid) ?? 0;

    const o = r.attached_order;
    if (o && orderSnapshotIsAuthoritative(o)) {
      out.push({
        ...buildLineFromOrderSnapshot({ row: r, supplierMid, supplierLabel, title, o }),
        purchase_channel,
      });
      continue;
    }

    const amounts = parseBookingAmountsForAdmin(
      r.order_amount,
      r.metadata,
      cls?.price != null ? Number(cls.price) : null
    );
    const rate = parseCommissionRate(rawRate);
    const commissionAmt = commissionFromCourseAmount(amounts.courseAmount, rate);
    const courseNet = Math.max(0, amounts.orderTotal - commissionAmt);
    const trialFirst = (o?.is_trial_first_purchase === true) || deriveTrialFirstFromMetadata(r.metadata);

    out.push({
      booking_id: r.id,
      created_at: r.created_at,
      supplier_merchant_id: supplierMid,
      supplier_label: supplierLabel,
      class_title: title,
      order_total: amounts.orderTotal,
      course_amount: amounts.courseAmount,
      peace_addon_amount: amounts.peaceAddonAmount,
      commission_rate_percent: rate,
      commission_amount: commissionAmt,
      course_net_after_commission: courseNet,
      is_trial_first_purchase: trialFirst,
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
