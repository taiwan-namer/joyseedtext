"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * 檢查所選 (slotDate, slotTime) 是否在該課程的開課場次內（scheduled_slots 或 class_date/class_time）。
 * 若課程沒有任何場次或未傳 slot，回傳 true（不擋）；有傳 slot 則必須在清單內。
 */
async function isSlotAllowed(
  supabase: ReturnType<typeof createServerSupabase>,
  merchantId: string,
  classId: string,
  slotDate: string | null,
  slotTime: string | null
): Promise<{ allowed: boolean; error?: string }> {
  if (!slotDate || !slotTime) return { allowed: true };
  const dateStr = slotDate.replace(/T.*$/, "").slice(0, 10);
  const timeStr = slotTime.replace(/.*(\d{2}:\d{2}).*/, "$1").slice(0, 5);

  const { data: row, error } = await supabase
    .from("classes")
    .select("scheduled_slots, class_date, class_time")
    .eq("id", classId)
    .eq("merchant_id", merchantId)
    .single();

  if (error || !row) return { allowed: false, error: "課程不存在或非本店家" };

  const r = row as {
    scheduled_slots?: { date: string; time: string }[] | null;
    class_date?: string | null;
    class_time?: string | null;
  };
  const slots: { date: string; time: string }[] = [];
  if (Array.isArray(r.scheduled_slots)) {
    for (const s of r.scheduled_slots) {
      if (s?.date && s?.time) slots.push({ date: String(s.date).slice(0, 10), time: String(s.time).slice(0, 5) });
    }
  }
  if (r.class_date && r.class_time) {
    slots.push({
      date: String(r.class_date).slice(0, 10),
      time: String(r.class_time).slice(0, 5),
    });
  }

  if (slots.length === 0) return { allowed: true }; // 無場次資料時不擋（舊資料）

  const allowed = slots.some(
    (s) => s.date === dateStr && s.time === timeStr
  );
  if (!allowed) {
    return {
      allowed: false,
      error: "所選日期或時段不在本課程的開課場次中，請回到課程頁重新選擇場次。",
    };
  }
  return { allowed: true };
}

/**
 * 下單並扣除庫存（多租戶：merchant_id 強制來自 NEXT_PUBLIC_CLIENT_ID）。
 * 透過 RPC 在同一交易內：檢查名額 → 新增訂單(upcoming) → capacity - 1。
 * 下單前會檢查所選 slot 是否在課程的 scheduled_slots／class_date+class_time 內，避免點錯或竄改網址。
 */
/** 結帳頁傳入的付款方式；存進 DB 為 atm | card | linepay（transfer → atm） */
export type PaymentMethodForBooking = "card" | "linepay" | "transfer";

export async function createBooking(
  classId: string,
  memberEmail: string,
  parentName?: string,
  parentPhone?: string,
  slotDate?: string | null,
  slotTime?: string | null,
  allergyOrSpecialNote?: string | null,
  kidName?: string | null,
  kidAge?: string | null,
  addonIndices?: number[] | null,
  paymentMethod?: PaymentMethodForBooking | null
): Promise<
  | { success: true; bookingId: string }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定店家" };

    const email = (memberEmail ?? "").trim();
    if (!email) return { success: false, error: "請提供會員信箱" };

    const supabase = createServerSupabase();

    if (slotDate && slotTime) {
      const dateStr = slotDate.replace(/T.*$/, "").slice(0, 10);
      const timeStr = slotTime.replace(/.*(\d{2}:\d{2}).*/, "$1").slice(0, 5);
      const check = await isSlotAllowed(supabase, merchantId, classId, dateStr, timeStr);
      if (!check.allowed) {
        return { success: false, error: check.error ?? "所選場次無效，請重新選擇。" };
      }
    }

    const pm = paymentMethod === "transfer" ? "atm" : paymentMethod === "linepay" ? "linepay" : paymentMethod === "card" ? "card" : "atm";

    const { data, error } = await supabase.rpc("create_booking_and_decrement_capacity", {
      p_merchant_id: merchantId,
      p_member_email: email,
      p_class_id: classId,
      p_parent_name: (parentName ?? "").trim() || null,
      p_parent_phone: (parentPhone ?? "").trim() || null,
      p_slot_date: slotDate && /^\d{4}-\d{2}-\d{2}$/.test(slotDate) ? slotDate : null,
      p_slot_time: slotTime && /^\d{2}:\d{2}$/.test(slotTime) ? slotTime : null,
      p_allergy_note: (allergyOrSpecialNote ?? "").trim() || null,
      p_kid_name: (kidName ?? "").trim() || null,
      p_kid_age: (kidAge ?? "").trim() || null,
      p_addon_indices: Array.isArray(addonIndices) && addonIndices.length > 0 ? addonIndices : null,
      p_payment_method: pm,
    });

    if (error) return { success: false, error: error.message };

    const result = data as { ok?: boolean; error?: string; booking_id?: string } | null;
    if (!result || result.ok !== true) {
      return { success: false, error: (result?.error as string) ?? "下單失敗" };
    }

    return { success: true, bookingId: String(result.booking_id) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "下單失敗";
    return { success: false, error: msg };
  }
}

/**
 * 後台：將訂單狀態更新為「已付款」（多租戶：僅允許該 merchant_id）。僅當 status 為 unpaid 時可操作。
 */
export async function markBookingAsPaid(
  bookingId: string
): Promise<
  | { success: true; message?: string }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定店家" };

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "paid" })
      .eq("id", bookingId)
      .eq("merchant_id", merchantId)
      .eq("status", "unpaid")
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "訂單不存在、非本店家或狀態不可變更" };

    return { success: true, message: "已標記為已付款" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "更新失敗";
    return { success: false, error: msg };
  }
}

/**
 * 後台：將訂單狀態更新為「完成課程」（多租戶：僅允許該 merchant_id）。
 */
export async function completeBooking(
  bookingId: string
): Promise<
  | { success: true; message?: string }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定店家" };

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", bookingId)
      .eq("merchant_id", merchantId)
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "訂單不存在或非本店家" };

    return { success: true, message: "已標記為完成課程" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "更新失敗";
    return { success: false, error: msg };
  }
}

/**
 * 後台：刪除訂單（多租戶：僅允許該 merchant_id）。刪除後將該課程名額 +1 回補。
 */
export async function deleteBooking(
  bookingId: string
): Promise<
  | { success: true; message?: string }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定店家" };

    const supabase = createServerSupabase();

    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, class_id")
      .eq("id", bookingId)
      .eq("merchant_id", merchantId)
      .single();

    if (fetchError || !booking) return { success: false, error: "訂單不存在或非本店家" };

    const classId = (booking as { class_id?: string }).class_id;
    const { error: deleteError } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId)
      .eq("merchant_id", merchantId);

    if (deleteError) return { success: false, error: deleteError.message };

    if (classId) {
      const { data: cls } = await supabase
        .from("classes")
        .select("capacity")
        .eq("id", classId)
        .eq("merchant_id", merchantId)
        .single();
      const current = (cls as { capacity?: number } | null)?.capacity ?? 0;
      await supabase
        .from("classes")
        .update({ capacity: Math.max(0, current + 1) })
        .eq("id", classId)
        .eq("merchant_id", merchantId);
    }

    return { success: true, message: "訂單已刪除" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "刪除失敗";
    return { success: false, error: msg };
  }
}

/** 會員中心用：取得當前登入者信箱（從 cookie session） */
export async function getCurrentMemberEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();
  return user?.email?.trim() ?? null;
}

/** 會員中心用：取得當前登入者姓名（從 members 表，依信箱查詢） */
export async function getCurrentMemberName(): Promise<string | null> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    const email = await getCurrentMemberEmail();
    if (!merchantId || !email) return null;
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("members")
      .select("name")
      .eq("merchant_id", merchantId)
      .eq("email", email)
      .maybeSingle();
    if (error || !data?.name) return null;
    const name = String(data.name).trim();
    return name || null;
  } catch {
    return null;
  }
}

export type BookingWithClass = {
  id: string;
  member_email: string;
  parent_name: string | null;
  parent_phone: string | null;
  class_id: string;
  /** unpaid=未付款, paid=已付款, completed=完成課程, cancelled=已取消 */
  status: string;
  /** atm=ATM轉帳, card=信用卡, linepay=LINE Pay */
  payment_method: string;
  created_at: string;
  /** 場次日期（bookings.slot_date，YYYY-MM-DD 或 null） */
  slot_date: string | null;
  /** 場次時間（bookings.slot_time，HH:MM 或 null） */
  slot_time: string | null;
  class_title: string | null;
  class_image_url: string | null;
  /** 課程售價（來自 classes.price） */
  class_price: number | null;
};

/**
 * 會員中心：撈取該會員的訂單（member_email + merchant_id），並 join 課程名稱與圖片。
 */
export async function getMyBookings(): Promise<
  | { success: true; data: BookingWithClass[] }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    const email = await getCurrentMemberEmail();
    if (!merchantId) return { success: false, error: "未設定店家" };
    if (!email) return { success: false, error: "請先登入" };

    const supabase = createServerSupabase();
    const { data: rows, error } = await supabase
      .from("bookings")
      .select(`
        id,
        member_email,
        parent_name,
        parent_phone,
        class_id,
        status,
        payment_method,
        created_at,
        slot_date,
        slot_time,
        classes ( title, image_url, price )
      `)
      .eq("merchant_id", merchantId)
      .eq("member_email", email)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };

    const list: BookingWithClass[] = (rows ?? []).map((r: Record<string, unknown>) => {
      const classes = r.classes as { title?: string; image_url?: string; price?: number } | null;
      const slotDateRaw = r.slot_date;
      const slotTimeRaw = r.slot_time;
      const slot_date =
        slotDateRaw != null && slotDateRaw !== ""
          ? String(slotDateRaw).replace(/T.*$/, "").slice(0, 10)
          : null;
      const slot_time =
        slotTimeRaw != null && String(slotTimeRaw).trim() !== ""
          ? String(slotTimeRaw).replace(/.*(\d{2}:\d{2}).*/, "$1").slice(0, 5)
          : null;

      return {
        id: String(r.id),
        member_email: String(r.member_email),
        parent_name: r.parent_name != null ? String(r.parent_name) : null,
        parent_phone: r.parent_phone != null ? String(r.parent_phone) : null,
        class_id: String(r.class_id),
        status: String(r.status),
        payment_method: r.payment_method != null ? String(r.payment_method) : "atm",
        created_at: String(r.created_at),
        slot_date,
        slot_time,
        class_title: classes?.title ?? null,
        class_image_url: classes?.image_url ?? null,
        class_price: classes?.price != null ? Number(classes.price) : null,
      };
    });

    return { success: true, data: list };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得訂單失敗";
    return { success: false, error: msg };
  }
}

/**
 * 後台訂單管理：撈取該 merchant 所有訂單，含課程名稱與圖片。
 */
export async function getAdminBookings(): Promise<
  | { success: true; data: BookingWithClass[] }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定店家" };

    const supabase = createServerSupabase();
    const { data: rows, error } = await supabase
      .from("bookings")
      .select(`
        id,
        member_email,
        parent_name,
        parent_phone,
        class_id,
        status,
        payment_method,
        created_at,
        slot_date,
        slot_time,
        classes ( title, image_url, price )
      `)
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };

    const list: BookingWithClass[] = (rows ?? []).map((r: Record<string, unknown>) => {
      const classes = r.classes as { title?: string; image_url?: string; price?: number } | null;
      const slotDateRaw = r.slot_date;
      const slotTimeRaw = r.slot_time;
      const slot_date =
        slotDateRaw != null && slotDateRaw !== ""
          ? String(slotDateRaw).replace(/T.*$/, "").slice(0, 10)
          : null;
      const slot_time =
        slotTimeRaw != null && String(slotTimeRaw).trim() !== ""
          ? String(slotTimeRaw).replace(/.*(\d{2}:\d{2}).*/, "$1").slice(0, 5)
          : null;

      return {
        id: String(r.id),
        member_email: String(r.member_email),
        parent_name: r.parent_name != null ? String(r.parent_name) : null,
        parent_phone: r.parent_phone != null ? String(r.parent_phone) : null,
        class_id: String(r.class_id),
        status: String(r.status),
        payment_method: r.payment_method != null ? String(r.payment_method) : "atm",
        created_at: String(r.created_at),
        slot_date,
        slot_time,
        class_title: classes?.title ?? null,
        class_image_url: classes?.image_url ?? null,
        class_price: classes?.price != null ? Number(classes.price) : null,
      };
    });

    return { success: true, data: list };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得訂單失敗";
    return { success: false, error: msg };
  }
}

/** 點名簿用：單一課程資訊 */
export type ClassForEnrollment = {
  id: string;
  title: string | null;
  capacity: number | null;
  scheduled_slots: { date: string; time: string }[] | null;
};

/** 點名簿用：訂單 + 家長／小朋友／聯絡方式，與訂單管理相同，皆直接來自 bookings 表 */
export type BookingWithMember = {
  id: string;
  member_email: string;
  /** 家長姓名：bookings.parent_name */
  parent_name: string | null;
  /** 小朋友暱稱：bookings.kid_name */
  kid_name: string | null;
  /** 小朋友年齡：bookings.kid_age */
  kid_age: string | null;
  /** 有無過敏或特殊疾病：bookings.allergy_or_special_note */
  allergy_or_special_note: string | null;
  /** 聯絡電話：bookings.parent_phone */
  contact_phone: string | null;
  /** 所選加購在 classes.addon_prices 的索引，用於顯示「課程 800 + 珍珠奶茶50 + 雞排60」 */
  addon_indices: number[] | null;
  status: string;
  created_at: string;
};

/** 點名簿單一場次回傳：訂單列表 + 該課程價格與加購項目（來自 classes） */
export type SessionBookingsResult = {
  bookings: BookingWithMember[];
  classBasePrice: number;
  classAddonPrices: { name: string; price: number }[] | null;
};

/** 點名簿用：一門課 + 其報名名單 */
export type CourseEnrollmentItem = {
  class: ClassForEnrollment;
  bookings: BookingWithMember[];
};

/**
 * 後台報名進度查詢（點名簿）：撈取店家所有課程與每門課的訂單。
 * 家長姓名、聯絡電話等與訂單管理相同，皆直接從 bookings 表取得（不查 members）。
 */
export async function getEnrollmentByCourse(): Promise<
  | { success: true; data: CourseEnrollmentItem[] }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定店家" };

    const supabase = createServerSupabase();

    const { data: classesRows, error: classesError } = await supabase
      .from("classes")
      .select("id, title, capacity, scheduled_slots")
      .eq("merchant_id", merchantId)
      .order("id", { ascending: true });

    if (classesError) return { success: false, error: classesError.message };
    const classesList = (classesRows ?? []) as { id: string; title: string | null; capacity: number | null; scheduled_slots: unknown }[];
    const classIds = classesList.map((c) => c.id);
    if (classIds.length === 0) return { success: true, data: [] };

    const { data: bookingsRows, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, member_email, parent_name, parent_phone, kid_name, kid_age, allergy_or_special_note, addon_indices, class_id, status, created_at")
      .eq("merchant_id", merchantId)
      .in("class_id", classIds)
      .order("created_at", { ascending: false });

    if (bookingsError) return { success: false, error: bookingsError.message };

    const parseAddonIndices = (row: Record<string, unknown>): number[] | null => {
      const v = row.addon_indices;
      if (v == null) return null;
      if (Array.isArray(v)) return v.map((x) => Number(x)).filter((n) => !Number.isNaN(n));
      return null;
    };

    const bookingsByClassId = new Map<string, BookingWithMember[]>();
    for (const r of bookingsRows ?? []) {
      const row = r as Record<string, unknown>;
      const cid = String(row.class_id ?? "");
      const b: BookingWithMember = {
        id: String(row.id),
        member_email: String(row.member_email),
        parent_name: row.parent_name != null ? String(row.parent_name).trim() || null : null,
        kid_name: row.kid_name != null ? String(row.kid_name).trim() || null : null,
        kid_age: row.kid_age != null ? String(row.kid_age).trim() || null : null,
        allergy_or_special_note: row.allergy_or_special_note != null ? String(row.allergy_or_special_note).trim() || null : null,
        contact_phone: row.parent_phone != null ? String(row.parent_phone).trim() || null : null,
        addon_indices: parseAddonIndices(row),
        status: String(row.status),
        created_at: String(row.created_at),
      };
      if (!bookingsByClassId.has(cid)) bookingsByClassId.set(cid, []);
      bookingsByClassId.get(cid)!.push(b);
    }

    const data: CourseEnrollmentItem[] = classesList.map((cls) => ({
      class: {
        id: cls.id,
        title: cls.title,
        capacity: cls.capacity,
        scheduled_slots: Array.isArray(cls.scheduled_slots) ? (cls.scheduled_slots as { date: string; time: string }[]) : null,
      },
      bookings: bookingsByClassId.get(cls.id) ?? [],
    }));

    return { success: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得報名資料失敗";
    return { success: false, error: msg };
  }
}

/** 點名簿（依日期）：單一場次 = 同 class 同日期同時間 */
export type RollcallSession = {
  classId: string;
  title: string | null;
  capacity: number;
  time: string;
  slotDate: string;
  enrolledCount: number;
};

/**
 * 動態日期選單：撈取當前店家所有有開課的日期（從 scheduled_slots 與 class_date 萃取），去重、排序。
 */
export async function getRollcallDates(): Promise<
  | { success: true; data: string[] }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定店家" };

    const supabase = createServerSupabase();
    const { data: rows, error } = await supabase
      .from("classes")
      .select("scheduled_slots, class_date")
      .eq("merchant_id", merchantId);

    if (error) return { success: false, error: error.message };

    const dateSet = new Set<string>();
    for (const r of rows ?? []) {
      const row = r as { scheduled_slots?: unknown; class_date?: string | null };
      if (row.class_date) dateSet.add(String(row.class_date).slice(0, 10));
      const slots = row.scheduled_slots;
      if (Array.isArray(slots)) {
        for (const s of slots as { date?: string }[]) {
          if (s?.date) dateSet.add(String(s.date).slice(0, 10));
        }
      }
    }
    const dates = Array.from(dateSet).sort();
    return { success: true, data: dates };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得日期失敗";
    return { success: false, error: msg };
  }
}

/** 日期選單用：每個日期的已報名數與總名額（當日所有場次加總） */
export type RollcallDateWithCounts = {
  date: string;
  enrolledCount: number;
  totalCapacity: number;
};

/**
 * 動態日期選單（含名額）：撈取所有有開課的日期，並回傳每個日期的已報名／總名額，供選單顯示。
 */
export async function getRollcallDatesWithCounts(): Promise<
  | { success: true; data: RollcallDateWithCounts[] }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定店家" };

    const supabase = createServerSupabase();
    const { data: classesRows, error: classesError } = await supabase
      .from("classes")
      .select("id, capacity, scheduled_slots, class_date, class_time")
      .eq("merchant_id", merchantId);

    if (classesError) return { success: false, error: classesError.message };

    const dateToSessions = new Map<string, { key: string; capacity: number }[]>();

    for (const r of classesRows ?? []) {
      const row = r as {
        id: string;
        capacity: number | null;
        scheduled_slots?: { date: string; time: string }[] | null;
        class_date?: string | null;
        class_time?: string | null;
      };
      const capacity = row.capacity ?? 0;

      if (row.class_date) {
        const dateStr = String(row.class_date).slice(0, 10);
        const t = row.class_time != null ? String(row.class_time).slice(0, 5) : "00:00";
        const timeKey = t.length === 5 ? t : "00:00";
        const key = `${row.id}|${dateStr}|${timeKey}`;
        if (!dateToSessions.has(dateStr)) dateToSessions.set(dateStr, []);
        const arr = dateToSessions.get(dateStr)!;
        if (!arr.some((x) => x.key === key)) arr.push({ key, capacity });
      }

      const slots = Array.isArray(row.scheduled_slots) ? row.scheduled_slots : [];
      for (const s of slots) {
        const dateStr = String(s?.date).slice(0, 10);
        const time = s?.time ? String(s.time).slice(0, 5) : "00:00";
        const timeKey = time.length === 5 ? time : "00:00";
        const key = `${row.id}|${dateStr}|${timeKey}`;
        if (!dateToSessions.has(dateStr)) dateToSessions.set(dateStr, []);
        const arr = dateToSessions.get(dateStr)!;
        if (!arr.some((x) => x.key === key)) arr.push({ key, capacity });
      }
    }

    const allKeys = new Set<string>();
    for (const arr of dateToSessions.values()) {
      for (const { key } of arr) allKeys.add(key);
    }
    const classIds = [...new Set(Array.from(allKeys).map((k) => k.split("|")[0]))];

    let countMap = new Map<string, number>();
    if (classIds.length > 0) {
      const { data: countRows, error: countError } = await supabase
        .from("bookings")
        .select("class_id, slot_date, slot_time")
        .eq("merchant_id", merchantId)
        .in("class_id", classIds)
        .not("status", "eq", "cancelled");

      if (!countError && countRows) {
        for (const b of countRows) {
          const br = b as { class_id: string; slot_date?: string | null; slot_time?: string | null };
          const d = br.slot_date ? String(br.slot_date).slice(0, 10) : "";
          const t = br.slot_time ? String(br.slot_time).slice(0, 5) : "";
          const key = `${br.class_id}|${d}|${t}`;
          countMap.set(key, (countMap.get(key) ?? 0) + 1);
        }
      }
    }

    const result: RollcallDateWithCounts[] = [];
    for (const dateStr of Array.from(dateToSessions.keys()).sort()) {
      const sessions = dateToSessions.get(dateStr)!;
      let totalCapacity = 0;
      let enrolledCount = 0;
      for (const { key, capacity } of sessions) {
        totalCapacity += capacity;
        enrolledCount += countMap.get(key) ?? 0;
      }
      result.push({ date: dateStr, enrolledCount, totalCapacity });
    }

    return { success: true, data: result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得日期失敗";
    return { success: false, error: msg };
  }
}

/**
 * 指定日期的所有場次（同日多時段 = 多筆，每筆獨立 class_id 對應一門課的該時段）。
 * 從 scheduled_slots 展開；若有 class_date/class_time 也納入。
 */
export async function getRollcallSessionsByDate(
  slotDate: string
): Promise<
  | { success: true; data: RollcallSession[] }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定店家" };

    const dateStr = slotDate.slice(0, 10);
    const supabase = createServerSupabase();

    const { data: classesRows, error: classesError } = await supabase
      .from("classes")
      .select("id, title, capacity, scheduled_slots, class_date, class_time")
      .eq("merchant_id", merchantId);

    if (classesError) return { success: false, error: classesError.message };

    const sessions: RollcallSession[] = [];
    const seen = new Set<string>();

    for (const r of classesRows ?? []) {
      const row = r as {
        id: string;
        title: string | null;
        capacity: number | null;
        scheduled_slots?: { date: string; time: string }[] | null;
        class_date?: string | null;
        class_time?: string | null;
      };
      const capacity = row.capacity ?? 0;

      if (row.class_date && String(row.class_date).slice(0, 10) === dateStr) {
        const t = row.class_time != null ? String(row.class_time).slice(0, 5) : "00:00";
        const timeKey = t.length === 5 ? t : "00:00";
        const key = `${row.id}|${dateStr}|${timeKey}`;
        if (!seen.has(key)) {
          seen.add(key);
          sessions.push({
            classId: row.id,
            title: row.title,
            capacity,
            time: timeKey,
            slotDate: dateStr,
            enrolledCount: 0,
          });
        }
      }

      const slots = Array.isArray(row.scheduled_slots) ? row.scheduled_slots : [];
      for (const s of slots) {
        if (String(s?.date).slice(0, 10) !== dateStr) continue;
        const time = s?.time ? String(s.time).slice(0, 5) : "00:00";
        const timeKey = time.length === 5 ? time : "00:00";
        const key = `${row.id}|${dateStr}|${timeKey}`;
        if (!seen.has(key)) {
          seen.add(key);
          sessions.push({
            classId: row.id,
            title: row.title,
            capacity,
            time: timeKey,
            slotDate: dateStr,
            enrolledCount: 0,
          });
        }
      }
    }

    const classIds = Array.from(new Set(sessions.map((s) => s.classId)));

    if (sessions.length === 0) return { success: true, data: [] };

    const { data: countRows, error: countError } = await supabase
      .from("bookings")
      .select("class_id, slot_date, slot_time")
      .eq("merchant_id", merchantId)
      .in("class_id", [...new Set(classIds)])
      .not("status", "eq", "cancelled");

    if (countError) return { success: false, error: countError.message };

    const countMap = new Map<string, number>();
    for (const b of countRows ?? []) {
      const br = b as { class_id: string; slot_date?: string | null; slot_time?: string | null };
      const d = br.slot_date ? String(br.slot_date).slice(0, 10) : "";
      const t = br.slot_time ? String(br.slot_time).slice(0, 5) : "";
      const key = `${br.class_id}|${d}|${t}`;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    for (const s of sessions) {
      const key = `${s.classId}|${s.slotDate}|${s.time}`;
      s.enrolledCount = countMap.get(key) ?? 0;
    }

    sessions.sort((a, b) => a.time.localeCompare(b.time) || (a.title ?? "").localeCompare(b.title ?? ""));

    return { success: true, data: sessions };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得場次失敗";
    return { success: false, error: msg };
  }
}

/**
 * 某場次點名簿：依 class_id + slot_date + slot_time 從 bookings 撈訂單，並帶回該課程的價格與 addon_prices 供顯示加購明細。
 */
export async function getBookingsForSession(
  classId: string,
  slotDate: string,
  slotTime: string
): Promise<
  | { success: true; data: SessionBookingsResult }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定店家" };

    const dateStr = slotDate.slice(0, 10);
    const timeStr = slotTime.length >= 5 ? slotTime.slice(0, 5) : slotTime;

    const supabase = createServerSupabase();

    const { data: classRow, error: classError } = await supabase
      .from("classes")
      .select("price, sale_price, addon_prices")
      .eq("id", classId)
      .eq("merchant_id", merchantId)
      .single();

    if (classError || !classRow) {
      return { success: false, error: classError?.message ?? "課程不存在" };
    }

    const r = classRow as { price?: number | null; sale_price?: number | null; addon_prices?: unknown };
    const price = r.price != null ? Number(r.price) : 0;
    const salePrice = r.sale_price != null ? Number(r.sale_price) : null;
    const classBasePrice = salePrice != null && price > 0 && salePrice < price ? salePrice : price;
    const classAddonPrices: { name: string; price: number }[] | null = Array.isArray(r.addon_prices)
      ? (r.addon_prices as { name?: string; price?: number }[]).map((a) => ({
          name: a?.name != null ? String(a.name) : "",
          price: a?.price != null ? Number(a.price) : 0,
        }))
      : null;

    const { data: bookingsRows, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, member_email, parent_name, parent_phone, kid_name, kid_age, allergy_or_special_note, addon_indices, status, created_at")
      .eq("merchant_id", merchantId)
      .eq("class_id", classId)
      .eq("slot_date", dateStr)
      .eq("slot_time", timeStr)
      .order("created_at", { ascending: true });

    if (bookingsError) return { success: false, error: bookingsError.message };

    const rawIndices = (r: Record<string, unknown>): number[] | null => {
      const v = r.addon_indices;
      if (v == null) return null;
      if (Array.isArray(v)) return v.map((x) => Number(x)).filter((n) => !Number.isNaN(n));
      return null;
    };

    const bookings: BookingWithMember[] = (bookingsRows ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      member_email: String(row.member_email),
      parent_name: row.parent_name != null ? String(row.parent_name).trim() || null : null,
      kid_name: row.kid_name != null ? String(row.kid_name).trim() || null : null,
      kid_age: row.kid_age != null ? String(row.kid_age).trim() || null : null,
      allergy_or_special_note: row.allergy_or_special_note != null ? String(row.allergy_or_special_note).trim() || null : null,
      contact_phone: row.parent_phone != null ? String(row.parent_phone).trim() || null : null,
      addon_indices: rawIndices(row),
      status: String(row.status),
      created_at: String(row.created_at),
    }));

    return {
      success: true,
      data: {
        bookings,
        classBasePrice,
        classAddonPrices,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得報名名單失敗";
    return { success: false, error: msg };
  }
}
