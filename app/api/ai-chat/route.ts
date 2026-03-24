import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentMemberEmail } from "@/app/actions/bookingActions";
import { getFaqItems } from "@/app/actions/storeSettingsActions";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import { sidebarOptionToDisplayLabels } from "@/lib/sidebarAgeOption";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

// AI 客服課程查詢：與前台課程頁一致，使用當前站台 merchant_id

/** 簡單關鍵字判斷意圖：訂單 / 課程 / 其他(FAQ) */
function classifyIntent(message: string): "order" | "course" | "faq" {
  const t = message.trim();
  if (
    /訂單|報名了|我的課|訂單狀態|我報名|查訂單|有沒有報名|已報名/.test(t)
  ) {
    return "order";
  }
  if (
    /課程|幾歲|適合|本週|有什麼課|活動|推薦|價格|多少錢/.test(t)
  ) {
    return "course";
  }
  return "faq";
}

export type AiChatCourseItem = {
  id: string;
  title: string;
  image_url: string | null;
  price: number | null;
  age_range: string;
  url: string;
};

export type AiChatOrderItem = {
  id: string;
  courseTitle: string;
  status: string;
  slotDate: string | null;
  slotTime: string | null;
  amount: number | null;
  courseUrl: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { message?: string; admin_preview_order?: boolean };
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) {
      return Response.json(
        { error: "請提供 message" },
        { status: 400 }
      );
    }

    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return Response.json(
        { error: "未設定店家" },
        { status: 500 }
      );
    }

    const memberEmail = await getCurrentMemberEmail();
    const intent = classifyIntent(message);
    const adminPreviewOrder = body?.admin_preview_order === true;

    // 訂單查詢：未登入時，若為後台範例預覽則驗證 admin 後回傳範例訂單
    if (intent === "order" && !memberEmail) {
      if (adminPreviewOrder) {
        try {
          await verifyAdminSession();
        } catch {
          return Response.json({
            type: "faq",
            reply: "查詢訂單需要先登入會員喔！請先至網站登入後再問「我的訂單」或「我報名了什麼課」。",
          });
        }
        const supabase = createServerSupabase();
        const { data: bookingsRows } = await supabase
          .from("bookings")
          .select("id, status, slot_date, slot_time, order_amount, class_id, classes(title)")
          .eq("merchant_id", merchantId)
          .order("created_at", { ascending: false })
          .limit(2);

        const orders: AiChatOrderItem[] = (bookingsRows ?? []).map((b: Record<string, unknown>) => {
          const c = b.classes as { title?: string } | null;
          const classId = b.class_id != null ? String(b.class_id) : "";
          return {
            id: String(b.id ?? ""),
            courseTitle: c?.title ?? "課程",
            status: String(b.status ?? ""),
            slotDate: b.slot_date != null ? String(b.slot_date) : null,
            slotTime: b.slot_time != null ? String(b.slot_time) : null,
            amount: b.order_amount != null ? Number(b.order_amount) : null,
            courseUrl: classId ? `/course/${classId}` : "/course",
          };
        });

        return Response.json({
          type: "order_list",
          reply: "以下為訂單列表範例（僅供後台預覽）。前台訪客需登入會員才能查詢自己的訂單。",
          orders,
        });
      }
      return Response.json({
        type: "faq",
        reply:
          "查詢訂單需要先登入會員喔！請先至網站登入後再問「我的訂單」或「我報名了什麼課」。",
      });
    }

    const supabase = createServerSupabase();

    if (intent === "course") {
      const { data: classesRows } = await supabase
        .from("classes")
        .select("id, title, image_url, price, scheduled_slots, sidebar_option")
        .eq("merchant_id", merchantId);

      const courses: AiChatCourseItem[] = (classesRows ?? []).map((row: Record<string, unknown>) => {
        const id = String(row.id ?? "");
        const sidebar = (row.sidebar_option as string[] | null) ?? [];
        const ageLabels = sidebarOptionToDisplayLabels(sidebar);
        return {
          id,
          title: String(row.title ?? ""),
          image_url: row.image_url != null ? String(row.image_url) : null,
          price: row.price != null ? Number(row.price) : null,
          age_range: ageLabels.join("、") || "未標示",
          url: `/course/${id}`,
        };
      });

      return Response.json({
        type: "course_recommendation",
        reply: courses.length > 0 ? "為您推薦以下課程，可點擊查看詳情或立即報名。" : "目前沒有符合的課程，歡迎稍後再來或聯絡客服。",
        courses,
      });
    }

    if (intent === "order" && memberEmail) {
      const { data: bookingsRows } = await supabase
        .from("bookings")
        .select("id, status, slot_date, slot_time, order_amount, class_id, classes(title)")
        .eq("merchant_id", merchantId)
        .eq("member_email", memberEmail)
        .order("created_at", { ascending: false })
        .limit(20);

      const orders: AiChatOrderItem[] = (bookingsRows ?? []).map((b: Record<string, unknown>) => {
        const c = b.classes as { title?: string } | null;
        const classId = b.class_id != null ? String(b.class_id) : "";
        return {
          id: String(b.id ?? ""),
          courseTitle: c?.title ?? "課程",
          status: String(b.status ?? ""),
          slotDate: b.slot_date != null ? String(b.slot_date) : null,
          slotTime: b.slot_time != null ? String(b.slot_time) : null,
          amount: b.order_amount != null ? Number(b.order_amount) : null,
          courseUrl: classId ? `/course/${classId}` : "/course",
        };
      });

      return Response.json({
        type: "order_list",
        reply: orders.length > 0 ? "以下是您的訂單紀錄。" : "您目前沒有訂單，歡迎報名課程。",
        orders,
      });
    }

    // FAQ：用常見問題組 context，呼叫 DeepSeek 生成回答
    const faqItems = await getFaqItems();
    const faqContext =
      faqItems.length > 0
        ? faqItems
            .map((i) => `Q: ${i.question}\nA: ${i.answer}`)
            .join("\n\n")
        : "（目前無常見問題資料，請建議使用者聯絡客服）";

    const systemPrompt = `你是親子課程平台的客服助理。請僅根據以下【常見問題】回答，語氣親切、簡潔、清楚。若無法從資料中找到答案，請建議聯絡客服。

【常見問題】
${faqContext}`;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey?.trim()) {
      return Response.json({
        type: "faq",
        reply: "客服系統設定中，請稍後再試或直接聯絡客服。",
      });
    }

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("DeepSeek API error", res.status, errText);
      return Response.json({
        type: "faq",
        reply: "AI 暫時無法回覆，請稍後再試或聯絡客服。",
      });
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ??
      "抱歉，我暫時無法回覆，請稍後再試或聯絡客服。";

    return Response.json({ type: "faq", reply });
  } catch (e) {
    console.error("ai-chat error", e);
    return Response.json(
      { type: "faq", reply: "處理時發生錯誤，請稍後再試。" },
      { status: 500 }
    );
  }
}
