import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import { fetchAdminReconciliationResult } from "@/lib/adminReconciliationFetch";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * GET /api/dashboard/monthly-revenue
 * 最近 6 個月：依「對帳明細」同口徑累加客付總額（order_total）於每月，與 orders 入帳快照一致
 */
export async function GET() {
  try {
    await verifyAdminSession();

    const branchMerchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!branchMerchantId) {
      return NextResponse.json({ error: "未設定店家" }, { status: 500 });
    }

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const endNext = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startISO = start.toISOString().slice(0, 10) + "T00:00:00.000Z";
    const endNextISO = endNext.toISOString();

    const supabase = createServerSupabase();
    try {
      const { lines } = await fetchAdminReconciliationResult(supabase, {
        startISO,
        endNextISO,
        branchMerchantId,
      });

      const byMonth: Record<string, number> = {};
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        byMonth[key] = 0;
      }

      for (const line of lines) {
        const month = line.created_at.slice(0, 7);
        if (month in byMonth) {
          byMonth[month] += line.order_total;
        }
      }

      const items = Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, revenue]) => ({ month, revenue }));

      return NextResponse.json({ items });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "對帳資料載入失敗" },
        { status: 500 }
      );
    }
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
