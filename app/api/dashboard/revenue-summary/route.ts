import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";

function getMerchantId(): string | null {
  const raw = process.env.NEXT_PUBLIC_CLIENT_ID;
  return typeof raw === "string" ? raw.trim() || null : null;
}

/**
 * GET /api/dashboard/revenue-summary?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&course_id=xxx
 * 老師後台訂單金額總覽：總營收、總報名人數、課程數量、平均客單價（僅 status = paid）
 * course_id 為選填，篩選指定課程。
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
    const courseId = searchParams.get("course_id")?.trim() || null;
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
    let query = supabase
      .from("bookings")
      .select("id, class_id, order_amount, classes(price)")
      .eq("merchant_id", merchantId)
      .eq("status", "paid")
      .gte("created_at", startISO)
      .lt("created_at", endNextISO);
    if (courseId) {
      query = query.eq("class_id", courseId);
    }
    const { data: rows, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let totalRevenue = 0;
    const classIds = new Set<string>();
    for (const r of rows ?? []) {
      const row = r as { order_amount?: number | null; classes?: { price?: number | null } | null; class_id?: string };
      const amount = row.order_amount != null && row.order_amount >= 0
        ? row.order_amount
        : (row.classes?.price != null ? Number(row.classes.price) : 0);
      totalRevenue += amount;
      if (row.class_id) classIds.add(String(row.class_id));
    }

    const totalStudents = (rows ?? []).length;
    const totalCourses = classIds.size;
    const averageOrderValue = totalStudents > 0 ? Math.round(totalRevenue / totalStudents) : 0;

    return NextResponse.json({
      total_revenue: totalRevenue,
      total_students: totalStudents,
      total_courses: totalCourses,
      average_order_value: averageOrderValue,
    });
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
