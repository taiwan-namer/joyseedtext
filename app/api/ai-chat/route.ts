import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getCurrentMemberEmail } from "@/app/actions/bookingActions";
import { getFaqItems } from "@/app/actions/storeSettingsActions";

const SIDEBAR_OPTION_LABELS: Record<string, string> = {
  "0": "0-3歲",
  "1": "3-6歲",
  "2": "6-9歲",
  "3": "可大人陪同",
};

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    // 訂單查詢僅限登入
    if (intent === "order" && !memberEmail) {
      return Response.json({
        reply:
          "查詢訂單需要先登入會員喔！請先至網站登入後再問「我的訂單」或「我報名了什麼課」。",
      });
    }

    const supabase = createServerSupabase();

    // 1) FAQ
    const faqItems = await getFaqItems();
    const faqContext =
      faqItems.length > 0
        ? faqItems
            .map((i) => `Q: ${i.question}\nA: ${i.answer}`)
            .join("\n\n")
        : "（目前無常見問題資料）";

    // 2) 課程列表（標題、價格、簡介、年齡標籤、場次）
    const { data: classesRows } = await supabase
      .from("classes")
      .select("id, title, price, course_intro, scheduled_slots, sidebar_option")
      .eq("merchant_id", merchantId);

    const classesList = (classesRows ?? []).map((row: Record<string, unknown>) => {
      const sidebar = (row.sidebar_option as string[] | null) ?? [];
      const ageLabels = sidebar
        .map((v) => SIDEBAR_OPTION_LABELS[v] ?? v)
        .filter(Boolean);
      const slots = row.scheduled_slots as { date?: string; time?: string }[] | null;
      const slotStr = Array.isArray(slots) && slots.length > 0
        ? slots.map((s) => `${s.date ?? ""} ${s.time ?? ""}`).join("、")
        : "（未設定場次）";
      return `課程：${row.title ?? ""}｜價格：${row.price ?? ""}｜年齡：${ageLabels.join("、") || "未標示"}｜場次：${slotStr}｜簡介：${(row.course_intro as string) ?? ""}`;
    });
    const coursesContext =
      classesList.length > 0
        ? classesList.join("\n")
        : "（目前無課程資料）";

    // 3) 訂單（僅登入時）
    let ordersContext = "";
    if (intent === "order" && memberEmail) {
      const { data: bookingsRows } = await supabase
        .from("bookings")
        .select("id, status, created_at, slot_date, slot_time, order_amount, classes(title)")
        .eq("merchant_id", merchantId)
        .eq("member_email", memberEmail)
        .order("created_at", { ascending: false })
        .limit(20);

      const ordersList = (bookingsRows ?? []).map((b: Record<string, unknown>) => {
        const c = b.classes as { title?: string } | null;
        const title = c?.title ?? "課程";
        return `訂單：${title}｜狀態：${b.status ?? ""}｜日期：${b.slot_date ?? ""} ${b.slot_time ?? ""}｜金額：${b.order_amount ?? ""}`;
      });
      ordersContext =
        ordersList.length > 0
          ? ordersList.join("\n")
          : "（此會員目前無訂單）";
    }

    const systemPrompt = `你是親子課程平台的客服助理。任務：回答家長關於課程、報名、退款、活動的問題。若無法確定答案，請建議聯絡客服。
回答語氣：親切、簡潔、清楚。

【常見問題】
${faqContext}

【課程一覽】
${coursesContext}
${ordersContext ? `\n【此會員的訂單】\n${ordersContext}` : ""}

請僅根據以上資料回答，不要捏造課程名稱或價格。`;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey?.trim()) {
      return Response.json(
        { error: "未設定 DEEPSEEK_API_KEY" },
        { status: 500 }
      );
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
      return Response.json(
        { error: "AI 暫時無法回覆，請稍後再試。" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ??
      "抱歉，我暫時無法回覆，請稍後再試或聯絡客服。";

    return Response.json({ reply });
  } catch (e) {
    console.error("ai-chat error", e);
    return Response.json(
      { error: "處理時發生錯誤，請稍後再試。" },
      { status: 500 }
    );
  }
}
