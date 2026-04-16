import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import {
  buildReconciliationLines,
  normalizeReconciliationBookingRows,
  sumReconciliationTotals,
} from "@/lib/reconciliationFromBookings";
import { getAdminBookingsAccessFilter, applyAdminBookingsAccessToQuery } from "@/lib/bookingsMerchantFilter";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * GET /api/admin/reconciliation?start_date=&end_date=
 * 分站後台：與訂單列表相同可見範圍；回傳明細並分「總站購買」／「本站購買」（sold_via_merchant_id）。
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAdminSession();
    const branchMerchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!branchMerchantId) {
      return NextResponse.json({ error: "未設定店家" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date")?.trim();
    const endDate = searchParams.get("end_date")?.trim();

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "請提供 start_date 與 end_date" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return NextResponse.json({ error: "日期無效" }, { status: 400 });
    }

    const startISO = start.toISOString().slice(0, 10) + "T00:00:00.000Z";
    const endNext = new Date(end);
    endNext.setUTCDate(endNext.getUTCDate() + 1);
    const endNextISO = endNext.toISOString();

    const supabase = createServerSupabase();

    const { data: rateRows } = await supabase
      .from("store_settings")
      .select("merchant_id, commission_rate_percent, site_name");
    const commissionByMerchant = new Map<string, number>();
    const labelByMerchant = new Map<string, string>();
    for (const r of rateRows ?? []) {
      const row = r as { merchant_id?: string; commission_rate_percent?: unknown; site_name?: string | null };
      const mid = String(row.merchant_id ?? "").trim();
      if (!mid) continue;
      const rate =
        typeof row.commission_rate_percent === "number"
          ? row.commission_rate_percent
          : Number(row.commission_rate_percent);
      commissionByMerchant.set(mid, Number.isFinite(rate) ? rate : 0);
      labelByMerchant.set(mid, String(row.site_name ?? "").trim() || mid);
    }

    const access = await getAdminBookingsAccessFilter(supabase);
    if (!access) {
      return NextResponse.json({ error: "無法解析訂單可見範圍" }, { status: 500 });
    }

    let query = supabase
      .from("bookings")
      .select("id, created_at, order_amount, metadata, status, merchant_id, sold_via_merchant_id, class_creator_merchant_id, classes ( title, price, merchant_id )")
      .in("status", ["paid", "completed"])
      .gte("created_at", startISO)
      .lt("created_at", endNextISO);

    query = applyAdminBookingsAccessToQuery(query, access);

    const { data: rawRows, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = normalizeReconciliationBookingRows(rawRows ?? []);
    const lines = buildReconciliationLines(rows, commissionByMerchant, labelByMerchant, branchMerchantId);

    const linesHq = lines.filter((l) => l.purchase_channel === "hq");
    const linesLocal = lines.filter((l) => l.purchase_channel === "local");

    const totals = sumReconciliationTotals(lines);
    const totals_hq = sumReconciliationTotals(linesHq);
    const totals_local = sumReconciliationTotals(linesLocal);

    return NextResponse.json({
      lines,
      lines_hq: linesHq,
      lines_local: linesLocal,
      totals,
      totals_hq,
      totals_local,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized admin access") {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "錯誤" }, { status: 500 });
  }
}
