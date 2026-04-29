import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attachOrdersArraysToBookingRaws,
  buildReconciliationLines,
  fetchOrderRowsForReconciliation,
  groupOrderRowsByBookingId,
  normalizeReconciliationBookingRows,
  sumReconciliationTotals,
  type ReconciliationLine,
} from "@/lib/reconciliationFromBookings";
import { applyAdminBookingsAccessToQuery, getAdminBookingsAccessFilter } from "@/lib/bookingsMerchantFilter";

export type AdminReconciliationTotals = ReturnType<typeof sumReconciliationTotals>;

export type AdminReconciliationFetchResult = {
  lines: ReconciliationLine[];
  linesHq: ReconciliationLine[];
  linesLocal: ReconciliationLine[];
  totals: AdminReconciliationTotals;
  totalsHq: AdminReconciliationTotals;
  totalsLocal: AdminReconciliationTotals;
};

/** 分站後台：與 /api/admin/reconciliation 相同的對帳明細資料（可查詢區間／選填課程） */
export async function fetchAdminReconciliationResult(
  supabase: SupabaseClient,
  args: {
    startISO: string;
    endNextISO: string;
    branchMerchantId: string;
    class_id?: string | null;
  }
): Promise<AdminReconciliationFetchResult> {
  const { startISO, endNextISO, branchMerchantId, class_id } = args;

  const { data: rateRows } = await supabase
    .from("store_settings")
    .select("merchant_id, commission_rate_percent, branch_site_rate_percent, site_name");

  const commissionByMerchant = new Map<string, number>();
  const branchSiteRateByMerchant = new Map<string, number>();
  const labelByMerchant = new Map<string, string>();

  for (const r of rateRows ?? []) {
    const row = r as {
      merchant_id?: string;
      commission_rate_percent?: unknown;
      branch_site_rate_percent?: unknown;
      site_name?: string | null;
    };
    const mid = String(row.merchant_id ?? "").trim();
    if (!mid) continue;
    const rate =
      typeof row.commission_rate_percent === "number"
        ? row.commission_rate_percent
        : Number(row.commission_rate_percent);
    commissionByMerchant.set(mid, Number.isFinite(rate) ? rate : 0);
    const branchRate =
      typeof row.branch_site_rate_percent === "number"
        ? row.branch_site_rate_percent
        : Number(row.branch_site_rate_percent);
    branchSiteRateByMerchant.set(mid, Number.isFinite(branchRate) ? branchRate : 0);
    labelByMerchant.set(mid, String(row.site_name ?? "").trim() || mid);
  }

  const access = await getAdminBookingsAccessFilter(supabase);
  if (!access) {
    throw new Error("無法解析訂單可見範圍");
  }

  let query = supabase
    .from("bookings")
    .select(
      "id, created_at, order_amount, metadata, status, merchant_id, sold_via_merchant_id, class_creator_merchant_id, classes ( title, price, merchant_id )"
    )
    .in("status", ["paid", "completed"])
    .gte("created_at", startISO)
    .lt("created_at", endNextISO);

  if (class_id) {
    query = query.eq("class_id", class_id);
  }

  query = applyAdminBookingsAccessToQuery(query, access);

  const { data: rawRows, error } = await query;
  if (error) throw new Error(error.message);

  const bookingIds = (rawRows ?? [])
    .map((row) => {
      if (!row || typeof row !== "object") return "";
      return String((row as Record<string, unknown>).id ?? "").trim();
    })
    .filter(Boolean);

  const orderRows = await fetchOrderRowsForReconciliation(supabase, bookingIds);
  const byBooking = groupOrderRowsByBookingId(orderRows);
  const mergedBookings = attachOrdersArraysToBookingRaws(rawRows ?? [], byBooking);

  const rows = normalizeReconciliationBookingRows(mergedBookings);
  const lines = buildReconciliationLines(
    rows,
    commissionByMerchant,
    branchSiteRateByMerchant,
    labelByMerchant,
    branchMerchantId
  );

  const linesHq = lines.filter((l) => l.purchase_channel === "hq");
  const linesLocal = lines.filter((l) => l.purchase_channel === "local");

  return {
    lines,
    linesHq,
    linesLocal,
    totals: sumReconciliationTotals(lines),
    totalsHq: sumReconciliationTotals(linesHq),
    totalsLocal: sumReconciliationTotals(linesLocal),
  };
}
