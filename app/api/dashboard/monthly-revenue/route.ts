import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import {
  applyAdminBookingsAccessToQuery,
  getAdminBookingsAccessFilter,
} from "@/lib/bookingsMerchantFilter";

/**
 * GET /api/dashboard/monthly-revenue
 * 最近 6 個月的每月營收（status = paid 或 completed，可見範圍與訂單管理一致），回傳 { items: { month: "YYYY-MM", revenue: number }[] } 由舊到新
 */
export async function GET() {
  try {
    await verifyAdminSession();

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const endNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startISO = start.toISOString().slice(0, 10) + "T00:00:00.000Z";
    const endNextISO = endNext.toISOString();

    const supabase = createServerSupabase();
    const access = await getAdminBookingsAccessFilter(supabase);
    if (!access) {
      return NextResponse.json({ error: "未設定店家" }, { status: 500 });
    }
    const query = supabase.from("bookings").select("created_at, order_amount, classes(price)");
    const scoped = applyAdminBookingsAccessToQuery(query, access);
    const { data: rows, error } = await scoped
      .in("status", ["paid", "completed"])
      .gte("created_at", startISO)
      .lt("created_at", endNextISO);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const byMonth: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth[key] = 0;
    }

    for (const r of rows ?? []) {
      const row = r as { created_at: string; order_amount?: number | null; classes?: { price?: number | null } | null };
      const month = row.created_at.slice(0, 7);
      const amount =
        row.order_amount != null && row.order_amount >= 0
          ? row.order_amount
          : (row.classes?.price != null ? Number(row.classes.price) : 0);
      if (month in byMonth) {
        byMonth[month] += amount;
      }
    }

    const items = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));

    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized admin access") {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "伺服器錯誤" },
      { status: 500 }
    );
  }
}
