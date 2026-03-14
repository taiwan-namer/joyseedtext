import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";

function getMerchantId(): string | null {
  const raw = process.env.NEXT_PUBLIC_CLIENT_ID;
  return typeof raw === "string" ? raw.trim() || null : null;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatOrderDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * GET /api/export/orders?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * 匯出訂單 CSV（僅 status = paid），streaming 回傳
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAdminSession();
    const merchantId = getMerchantId();
    if (!merchantId) {
      return new Response("未設定店家", { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start_date")?.trim();
    const endDate = searchParams.get("end_date")?.trim();
    if (!startDate || !endDate) {
      return new Response("請提供 start_date 與 end_date（YYYY-MM-DD）", { status: 400 });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return new Response("日期格式錯誤", { status: 400 });
    }
    if (start > end) {
      return new Response("start_date 不可大於 end_date", { status: 400 });
    }

    const startISO = start.toISOString().slice(0, 10) + "T00:00:00.000Z";
    const endNext = new Date(end);
    endNext.setUTCDate(endNext.getUTCDate() + 1);
    const endNextISO = endNext.toISOString();

    const supabase = createServerSupabase();
    const { data: rows, error } = await supabase
      .from("bookings")
      .select("id, created_at, order_amount, status, parent_name, member_email, classes(title, price)")
      .eq("merchant_id", merchantId)
      .eq("status", "paid")
      .gte("created_at", startISO)
      .lt("created_at", endNextISO)
      .order("created_at", { ascending: true });

    if (error) {
      return new Response(`查詢失敗：${error.message}`, { status: 500 });
    }

    const BOM = "\uFEFF";
    const header =
      BOM +
      ["order_id", "order_date", "course_title", "student_name", "student_email", "amount", "status"].join(",") +
      "\n";

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(header));
        for (const r of rows ?? []) {
          const row = r as {
            id: string;
            created_at: string;
            order_amount?: number | null;
            status: string;
            parent_name?: string | null;
            member_email: string;
            classes?: { title?: string | null; price?: number | null } | null;
          };
          const amount =
            row.order_amount != null && row.order_amount >= 0
              ? row.order_amount
              : (row.classes?.price != null ? Number(row.classes.price) : 0);
          const courseTitle = row.classes?.title ?? "—";
          const studentName = row.parent_name ?? "—";
          const line =
            [
              escapeCsvCell(String(row.id)),
              escapeCsvCell(formatOrderDate(row.created_at)),
              escapeCsvCell(String(courseTitle)),
              escapeCsvCell(String(studentName)),
              escapeCsvCell(String(row.member_email)),
              String(amount),
              escapeCsvCell(String(row.status)),
            ].join(",") + "\n";
          controller.enqueue(new TextEncoder().encode(line));
        }
        controller.close();
      },
    });

    const filename = `orders_${startDate.replace(/-/g, "")}_${endDate.replace(/-/g, "")}.csv`;
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized admin access") {
      return new Response("未授權", { status: 401 });
    }
    return new Response(e instanceof Error ? e.message : "伺服器錯誤", { status: 500 });
  }
}
