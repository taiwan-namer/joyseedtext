import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import { fetchAdminReconciliationResult } from "@/lib/adminReconciliationFetch";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * GET /api/dashboard/revenue-summary?start_date=&end_date=&course_id=
 * 相容舊欄位名稱：`total_revenue` = 對帳口徑客付總額（等同對帳明細 totals.order_total）
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
    try {
      const { lines, totals } = await fetchAdminReconciliationResult(supabase, {
        startISO,
        endNextISO,
        branchMerchantId,
        class_id: courseId,
      });

      const totalStudents = lines.length;
      const uniqueCourseKeys = new Set(lines.map((l) => `${l.supplier_merchant_id}\0${l.class_title}`));
      const totalCourses = uniqueCourseKeys.size;
      const averageOrderValue = totalStudents > 0 ? Math.round(totals.order_total / totalStudents) : 0;

      return NextResponse.json({
        total_revenue: totals.order_total,
        total_students: totalStudents,
        total_courses: totalCourses,
        average_order_value: averageOrderValue,
      });
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
