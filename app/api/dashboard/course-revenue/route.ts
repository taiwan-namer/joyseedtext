import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";

function getMerchantId(): string | null {
  const raw = process.env.NEXT_PUBLIC_CLIENT_ID;
  return typeof raw === "string" ? raw.trim() || null : null;
}

/**
 * GET /api/dashboard/course-revenue?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * 依課程彙總：課程名稱、報名人數、營收（僅 status = paid），依營收降序
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAdminSession();
    const merchantId = getMerchantId();
    if (!merchantId) {
      return NextResponse.json({ error: "未設定店家" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date")?.trim();
    const endDate = searchParams.get("end_date")?.trim();
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "請提供 start_date 與 end_date（YYYY-MM-DD）" },
        { status: 400 }
      );
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: "日期格式錯誤" }, { status: 400 });
    }
    if (start > end) {
      return NextResponse.json({ error: "start_date 不可大於 end_date" }, { status: 400 });
    }

    const startISO = start.toISOString().slice(0, 10) + "T00:00:00.000Z";
    const endNext = new Date(end);
    endNext.setUTCDate(endNext.getUTCDate() + 1);
    const endNextISO = endNext.toISOString();

    const supabase = createServerSupabase();
    const { data: rows, error } = await supabase
      .from("bookings")
      .select("class_id, order_amount, classes(id, title, price)")
      .eq("merchant_id", merchantId)
      .eq("status", "paid")
      .gte("created_at", startISO)
      .lt("created_at", endNextISO);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const byClass = new Map<
      string,
      { course_title: string; total_students: number; total_revenue: number }
    >();
    for (const r of rows ?? []) {
      const row = r as {
        class_id: string;
        order_amount?: number | null;
        classes?: { id?: string; title?: string | null; price?: number | null } | null;
      };
      const classId = row.class_id;
      const title = row.classes?.title ?? "—";
      const amount =
        row.order_amount != null && row.order_amount >= 0
          ? row.order_amount
          : (row.classes?.price != null ? Number(row.classes.price) : 0);

      const cur = byClass.get(classId);
      if (cur) {
        cur.total_students += 1;
        cur.total_revenue += amount;
      } else {
        byClass.set(classId, {
          course_title: String(title),
          total_students: 1,
          total_revenue: amount,
        });
      }
    }

    const items = Array.from(byClass.values()).sort((a, b) => b.total_revenue - a.total_revenue);
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
