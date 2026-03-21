"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import { getFrontendSettings } from "@/app/actions/frontendSettingsActions";
import { getLinePaySandboxCredentials, validateLinePayCredentials, requestLinePayPayment } from "@/lib/linepay";
import { logPaymentApi } from "@/lib/paymentLogs";
import { resolvePaymentSiteBaseUrl } from "@/lib/appUrl";
import { fetchInventoryResolution } from "@/lib/inventoryClass";
import {
  bookingsVisibleToMerchantOrFilter,
  getAdminBookingMerchantScope,
  getAdminBookingsAccessFilter,
  getOrderAdminClassCreatorMerchantIdFilter,
  type AdminBookingsAccessFilter,
} from "@/lib/bookingsMerchantFilter";

function applyAdminBookingsAccess<T>(q: T, access: AdminBookingsAccessFilter): T {
  if (access.mode === "class_creator") {
    return (q as { eq: (c: string, v: string) => T }).eq("class_creator_merchant_id", access.merchantId);
  }
  return (q as { or: (clause: string) => T }).or(access.orClause);
}

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

  const inv = await fetchInventoryResolution(supabase, merchantId, classId);
  if (!inv) return { allowed: false, error: "課程不存在或非本店家" };

  const { data: row, error } = await supabase
    .from("classes")
    .select("scheduled_slots, class_date, class_time")
    .eq("id", inv.inventoryClassId)
    .eq("merchant_id", inv.inventoryMerchantId)
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
 * 建立「待付款」紀錄（僅用於 LINE Pay／綠界／藍新）。不寫入 bookings，付款成功後由 callback 從此建立 paid 訂單。
 */
async function createPendingPayment(
  supabase: ReturnType<typeof createServerSupabase>,
  params: {
    merchantId: string;
    memberEmail: string;
    classId: string;
    parentName: string | null;
    parentPhone: string | null;
    slotDate: string | null;
    slotTime: string | null;
    allergyNote: string | null;
    kidName: string | null;
    kidAge: string | null;
    addonIndices: number[] | null;
    orderAmount: number | null;
    paymentMethod: "linepay" | "ecpay" | "newebpay";
  }
): Promise<{ success: true; pendingId: string; gatewayKey: string | null } | { success: false; error: string }> {
  const { paymentMethod } = params;
  let gatewayKey: string | null = null;
  if (paymentMethod === "ecpay") {
    gatewayKey = (
      "EC" +
      Date.now().toString().slice(-8) +
      Math.random().toString(36).slice(-4).toUpperCase()
    ).slice(0, 20).trim();
  } else if (paymentMethod === "newebpay") {
    gatewayKey = ("NB" + Date.now().toString()).trim();
  }

  const slotDateParsed =
    params.slotDate && /^\d{4}-\d{2}-\d{2}$/.test(params.slotDate) ? params.slotDate : null;
  const slotTimeParsed =
    params.slotTime && /^\d{2}:\d{2}$/.test(params.slotTime) ? params.slotTime : null;

  const { data: row, error } = await supabase
    .from("pending_payments")
    .insert({
      merchant_id: params.merchantId,
      member_email: params.memberEmail,
      parent_name: params.parentName,
      parent_phone: params.parentPhone,
      class_id: params.classId,
      slot_date: slotDateParsed,
      slot_time: slotTimeParsed,
      allergy_or_special_note: params.allergyNote,
      kid_name: params.kidName,
      kid_age: params.kidAge,
      addon_indices: Array.isArray(params.addonIndices) && params.addonIndices.length > 0 ? params.addonIndices : null,
      order_amount: params.orderAmount,
      payment_method: paymentMethod,
      gateway_key: gatewayKey?.trim() ?? null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  const pendingId = String((row as { id: string }).id);
  if (paymentMethod === "linepay") {
    await supabase.from("pending_payments").update({ gateway_key: pendingId }).eq("id", pendingId);
  }
  return { success: true, pendingId, gatewayKey };
}

/**
 * 下單（多租戶：merchant_id 強制來自 NEXT_PUBLIC_CLIENT_ID）。
 * 僅「ATM／現場付(card)」會立即寫入 bookings；LINE Pay／綠界／藍新改為寫入 pending_payments，付款成功後才建立訂單。
 *
 * **老師站（joyseed）**：`classId` 須為 **老師課程 `classes.id`（UUID）**，與 model 老師站一致；勿傳總站列表課 id。
 * RPC 會解析庫存後寫入 `bookings.class_id`＝庫存課 id（無 inventory 綁定時即本課 id）。
 */
/** 結帳頁傳入的付款方式；存進 DB 為 atm | card | linepay | ecpay | newebpay（transfer → atm） */
export type PaymentMethodForBooking = "card" | "linepay" | "transfer" | "ecpay" | "newebpay";

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
  paymentMethod?: PaymentMethodForBooking | null,
  /** 結帳頁顯示的總金額，寫入訂單供會員中心顯示與結帳頁一致 */
  totalAmount?: number | null,
  /** LINE Pay 用：課程名稱（顯示於 LINE Pay 商品包） */
  courseTitle?: string | null,
  /** LINE Pay 用：課程 slug（用於 cancelUrl 導回結帳頁） */
  courseSlug?: string | null
): Promise<
  | { success: true; bookingId: string; paymentUrl?: string }
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

    const pm =
      paymentMethod === "transfer"
        ? "atm"
        : paymentMethod === "linepay"
          ? "linepay"
          : paymentMethod === "card"
            ? "card"
            : paymentMethod === "ecpay"
              ? "ecpay"
              : paymentMethod === "newebpay"
                ? "newebpay"
                : "atm";

    const orderAmount =
      typeof totalAmount === "number" && !Number.isNaN(totalAmount) && totalAmount >= 0
        ? Math.round(totalAmount)
        : null;

    const siteBase = resolvePaymentSiteBaseUrl();

    if (pm === "linepay" || pm === "ecpay" || pm === "newebpay") {
      const pending = await createPendingPayment(supabase, {
        merchantId,
        memberEmail: email,
        classId,
        parentName: (parentName ?? "").trim() || null,
        parentPhone: (parentPhone ?? "").trim() || null,
        slotDate: slotDate && /^\d{4}-\d{2}-\d{2}$/.test(slotDate) ? slotDate : null,
        slotTime: slotTime && /^\d{2}:\d{2}$/.test(slotTime) ? slotTime : null,
        allergyNote: (allergyOrSpecialNote ?? "").trim() || null,
        kidName: (kidName ?? "").trim() || null,
        kidAge: (kidAge ?? "").trim() || null,
        addonIndices: Array.isArray(addonIndices) && addonIndices.length > 0 ? addonIndices : null,
        orderAmount,
        paymentMethod: pm,
      });
      if (!pending.success) return { success: false, error: pending.error };

      if (pm === "linepay") {
        const settings = await getFrontendSettings();
        const creds = getLinePaySandboxCredentials(settings.linePayApi);
        if (!creds) {
          return { success: false, error: "LINE Pay 未設定，請設定 .env 的 LINE_PAY_CHANNEL_ID / LINE_PAY_CHANNEL_SECRET 或後台金流設定" };
        }
        const validation = validateLinePayCredentials(creds);
        if (!validation.ok) {
          return { success: false, error: validation.error };
        }
        if (!siteBase) {
          return {
            success: false,
            error: "無法判定站點網址，請設定 APP_URL／NEXT_PUBLIC_BASE_URL，或從正式網域開啟結帳頁。",
          };
        }
        const amount = orderAmount ?? 0;
        if (amount <= 0) {
          return { success: false, error: "LINE Pay 付款金額必須大於 0" };
        }
        const orderId = pending.pendingId;
        const productName = (courseTitle && String(courseTitle).trim()) || "課程報名";
        const slugForUrl = (courseSlug && String(courseSlug).trim()) || "course";
        const confirmUrl = `${siteBase}/api/linepay/confirm`;
        const cancelUrl = `${siteBase}/course/${slugForUrl}/checkout?error=payment_cancelled`;
        const requestBody = {
          amount,
          orderId,
          packages: [{ id: "1", amount, products: [{ id: "1", name: productName, quantity: 1, price: amount }] }],
          redirectUrls: { confirmUrl, cancelUrl },
        };
        const linePayRes = await requestLinePayPayment({
          channelId: creds.channelId,
          channelSecret: creds.channelSecret,
          amount,
          orderId,
          packages: requestBody.packages,
          redirectUrls: { confirmUrl, cancelUrl },
        });
        await logPaymentApi(supabase, {
          merchant_id: merchantId,
          order_id: orderId,
          transaction_id: linePayRes.success ? linePayRes.info.transactionId : null,
          api_type: "request",
          request_body: JSON.stringify(requestBody),
          response_body: JSON.stringify({
            success: linePayRes.success,
            returnCode: linePayRes.returnCode,
            returnMessage: linePayRes.returnMessage,
            info: linePayRes.success ? linePayRes.info : undefined,
          }),
          return_code: linePayRes.returnCode,
          return_message: linePayRes.returnMessage,
        });
        if (!linePayRes.success) {
          return { success: false, error: linePayRes.returnMessage || "LINE Pay 請求失敗" };
        }
        const paymentUrl = linePayRes.info.paymentUrl?.web ?? undefined;
        return { success: true, bookingId: "", paymentUrl };
      }

      if (pm === "ecpay" || pm === "newebpay") {
        if (!siteBase) {
          return {
            success: false,
            error: "無法判定站點網址，請設定 APP_URL／NEXT_PUBLIC_BASE_URL，或從正式網域開啟結帳頁。",
          };
        }
        const path = pm === "ecpay" ? "/api/ecpay/checkout" : "/api/newebpay/checkout";
        const paymentUrl = `${siteBase}${path}?pendingId=${encodeURIComponent(pending.pendingId)}`;
        return { success: true, bookingId: "", paymentUrl };
      }
    }

    // 僅「現場付(card)／ATM(transfer)」寫入 bookings；若前端未正確傳入付款方式則不建立訂單
    if (paymentMethod !== "card" && paymentMethod !== "transfer") {
      return { success: false, error: "請選擇付款方式（信用卡／ATM／現場付）後再送出。" };
    }

    // p_class_id：老師站傳老師課 UUID；RPC 內解析 inventory 後訂單仍存庫存課 class_id
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
      p_order_amount: orderAmount,
    });

    if (error) return { success: false, error: error.message };

    const result = data as { ok?: boolean; error?: string; booking_id?: string } | null;
    if (!result || result.ok !== true) {
      return { success: false, error: (result?.error as string) ?? "下單失敗" };
    }

    const bookingId = String(result.booking_id);
    return { success: true, bookingId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "下單失敗";
    return { success: false, error: msg };
  }
}

/** 單一場次的剩餘名額（與下單 RPC 邏輯一致：依該場次已報名數與場次名額計算） */
export type SlotRemaining = { date: string; time: string; capacity: number; remaining: number };

/**
 * 取得指定課程各場次的剩餘名額，供前台「選擇日期與時間」彈窗顯示，與訂單庫存連動。
 * 不計入 status = cancelled 的訂單。
 */
export async function getSlotRemainingCounts(classId: string): Promise<
  | { success: true; slots: SlotRemaining[] }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定店家" };

    const supabase = createServerSupabase();
    const inv = await fetchInventoryResolution(supabase, merchantId, classId);
    if (!inv) return { success: false, error: "課程不存在" };

    const { data: classRow, error: classError } = await supabase
      .from("classes")
      .select("capacity, scheduled_slots, class_date, class_time")
      .eq("id", inv.inventoryClassId)
      .eq("merchant_id", inv.inventoryMerchantId)
      .single();

    if (classError || !classRow) return { success: false, error: "課程不存在" };

    const row = classRow as {
      capacity?: number | null;
      scheduled_slots?: { date?: string; time?: string; capacity?: number }[] | null;
      class_date?: string | null;
      class_time?: string | null;
    };
    const classCapacity = row.capacity ?? 0;

    // 同一 (date, time) 只保留一筆：優先 scheduled_slots 的場次名額，與後台庫存／下單邏輯一致
    const slotsMap = new Map<string, { date: string; time: string; capacity: number }>();

    if (Array.isArray(row.scheduled_slots)) {
      for (const s of row.scheduled_slots) {
        const dateStr = String(s?.date ?? "").slice(0, 10);
        const timeStr = String(s?.time ?? "09:00").slice(0, 5);
        const slotCap =
          typeof s?.capacity === "number" && s.capacity >= 1 ? s.capacity : classCapacity;
        if (dateStr && timeStr) {
          const key = `${dateStr}|${timeStr}`;
          slotsMap.set(key, { date: dateStr, time: timeStr, capacity: slotCap });
        }
      }
    }

    if (row.class_date && row.class_time) {
      const dateStr = String(row.class_date).slice(0, 10);
      const timeStr = String(row.class_time).slice(0, 5);
      const key = `${dateStr}|${timeStr}`;
      if (!slotsMap.has(key)) slotsMap.set(key, { date: dateStr, time: timeStr, capacity: classCapacity });
    }

    const slotsWithCap = Array.from(slotsMap.values());
    if (slotsWithCap.length === 0) return { success: true, slots: [] };

    const { data: bookings, error: bookError } = await supabase
      .from("bookings")
      .select("slot_date, slot_time")
      .eq("class_id", inv.inventoryClassId)
      .in("status", ["paid", "completed"]);

    if (bookError) return { success: false, error: bookError.message };

    const countMap = new Map<string, number>();
    for (const b of bookings ?? []) {
      const br = b as { slot_date?: string | null; slot_time?: string | null };
      const d = br.slot_date ? String(br.slot_date).slice(0, 10) : "";
      const t = br.slot_time ? String(br.slot_time).slice(0, 5) : "";
      const key = `${d}|${t}`;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    const slots: SlotRemaining[] = slotsWithCap.map(({ date, time, capacity }) => {
      const key = `${date}|${time}`;
      const booked = countMap.get(key) ?? 0;
      const remaining = Math.max(0, capacity - booked);
      return { date, time, capacity, remaining };
    });

    return { success: true, slots };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得剩餘名額失敗";
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
    await verifyAdminSession();
    const supabase = createServerSupabase();
    const access = await getAdminBookingsAccessFilter(supabase);
    if (!access) return { success: false, error: "未設定店家" };

    const { data, error } = await applyAdminBookingsAccess(
      supabase.from("bookings").update({ status: "paid" }).eq("id", bookingId),
      access
    )
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
    await verifyAdminSession();
    const supabase = createServerSupabase();
    const access = await getAdminBookingsAccessFilter(supabase);
    if (!access) return { success: false, error: "未設定店家" };

    const { data, error } = await applyAdminBookingsAccess(
      supabase.from("bookings").update({ status: "completed" }).eq("id", bookingId),
      access
    )
      .eq("status", "paid")
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
 * 後台：一鍵將多筆訂單標記為「已付款」。僅 status 為 unpaid/upcoming 且為 ATM 或未填寫付款方式者會更新。
 */
export async function batchMarkBookingsAsPaid(
  bookingIds: string[]
): Promise<
  | { success: true; updated: number; message?: string }
  | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const ids = bookingIds.filter((id) => typeof id === "string" && id.length > 0);
    if (ids.length === 0) return { success: true, updated: 0, message: "無符合的訂單" };

    const supabase = createServerSupabase();
    const access = await getAdminBookingsAccessFilter(supabase);
    if (!access) return { success: false, error: "未設定店家" };

    const { data, error } = await applyAdminBookingsAccess(
      supabase.from("bookings").update({ status: "paid" }),
      access
    )
      .in("status", ["unpaid", "upcoming"])
      .in("id", ids)
      .select("id");

    if (error) return { success: false, error: error.message };
    const updated = Array.isArray(data) ? data.length : 0;
    return { success: true, updated, message: `已將 ${updated} 筆標記為已付款` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "更新失敗";
    return { success: false, error: msg };
  }
}

/**
 * 後台：一鍵將多筆訂單標記為「完成課程」。僅 status 為 paid 者會更新。
 */
export async function batchCompleteBookings(
  bookingIds: string[]
): Promise<
  | { success: true; updated: number; message?: string }
  | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const ids = bookingIds.filter((id) => typeof id === "string" && id.length > 0);
    if (ids.length === 0) return { success: true, updated: 0, message: "無符合的訂單" };

    const supabase = createServerSupabase();
    const access = await getAdminBookingsAccessFilter(supabase);
    if (!access) return { success: false, error: "未設定店家" };

    const { data, error } = await applyAdminBookingsAccess(
      supabase.from("bookings").update({ status: "completed" }),
      access
    )
      .eq("status", "paid")
      .in("id", ids)
      .select("id");

    if (error) return { success: false, error: error.message };
    const updated = Array.isArray(data) ? data.length : 0;
    return { success: true, updated, message: `已將 ${updated} 筆標記為完成課程` };
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
    await verifyAdminSession();
    const supabase = createServerSupabase();
    const access = await getAdminBookingsAccessFilter(supabase);
    if (!access) return { success: false, error: "未設定店家" };

    const { data: booking, error: fetchError } = await applyAdminBookingsAccess(
      supabase.from("bookings").select("id, class_id, slot_date, slot_time, merchant_id").eq("id", bookingId),
      access
    ).single();

    if (fetchError || !booking) return { success: false, error: "訂單不存在或非本店家" };

    const classId = (booking as { class_id?: string }).class_id;
    const ownerMerchantId = String((booking as { merchant_id?: string }).merchant_id ?? "");
    const hadSlot = (booking as { slot_date?: string | null; slot_time?: string | null }).slot_date != null && (booking as { slot_time?: string | null }).slot_time != null;
    const { error: deleteError } = await applyAdminBookingsAccess(
      supabase.from("bookings").delete().eq("id", bookingId),
      access
    );

    if (deleteError) return { success: false, error: deleteError.message };

    if (classId && !hadSlot && ownerMerchantId) {
      const { data: cls } = await supabase
        .from("classes")
        .select("capacity")
        .eq("id", classId)
        .eq("merchant_id", ownerMerchantId)
        .single();
      const current = (cls as { capacity?: number } | null)?.capacity ?? 0;
      await supabase
        .from("classes")
        .update({ capacity: Math.max(0, current + 1) })
        .eq("id", classId)
        .eq("merchant_id", ownerMerchantId);
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
  /** 訂單金額（order_amount 或 classes.price） */
  class_price: number | null;
  /** 所選加購索引，用於顯示加購明細 */
  addon_indices: number[] | null;
  /** 課程加購項目（來自 classes.addon_prices），與 addon_indices 搭配顯示品名與單價 */
  class_addon_prices: { name: string; price: number }[] | null;
};

/** 後台：線上金流尚未轉成 bookings 的待付款列（callback 未跑完時會留在這裡） */
export type AdminPendingPaymentRow = {
  id: string;
  member_email: string;
  parent_name: string | null;
  parent_phone: string | null;
  class_id: string;
  class_title: string | null;
  order_amount: number | null;
  payment_method: string;
  gateway_key: string | null;
  created_at: string;
  slot_date: string | null;
  slot_time: string | null;
};

/**
 * 會員中心：撈取該會員的訂單（member_email + 本站可見範圍），並 join 課程名稱與圖片。
 * 可見範圍含：庫存歸本商家，或經由本商家網站售出（sold_via）。
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
        order_amount,
        addon_indices,
        classes ( title, image_url, price, addon_prices )
      `)
      .or(bookingsVisibleToMerchantOrFilter(merchantId))
      .eq("member_email", email)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };

    const list: BookingWithClass[] = (rows ?? []).map((r: Record<string, unknown>) => {
      const classes = r.classes as { title?: string; image_url?: string; price?: number; addon_prices?: unknown } | null;
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
      const orderAmount = r.order_amount != null && r.order_amount !== "" ? Number(r.order_amount) : null;
      const classPrice = orderAmount ?? (classes?.price != null ? Number(classes.price) : null);
      const addonRaw = classes?.addon_prices;
      let classAddonPrices: { name: string; price: number }[] | null = null;
      if (Array.isArray(addonRaw)) {
        classAddonPrices = (addonRaw as { name?: string; price?: number }[]).map((a) => ({
          name: a?.name != null ? String(a.name) : "",
          price: a?.price != null ? Number(a.price) : 0,
        }));
      } else if (typeof addonRaw === "string") {
        try {
          const parsed = JSON.parse(addonRaw) as unknown;
          if (Array.isArray(parsed)) {
            classAddonPrices = (parsed as { name?: string; price?: number }[]).map((a) => ({
              name: a?.name != null ? String(a.name) : "",
              price: a?.price != null ? Number(a.price) : 0,
            }));
          }
        } catch {
          // ignore
        }
      }

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
        class_price: classPrice,
        addon_indices: parseAddonIndicesFromDb(r.addon_indices),
        class_addon_prices: classAddonPrices,
      };
    });

    return { success: true, data: list };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得訂單失敗";
    return { success: false, error: msg };
  }
}

/**
 * 後台訂單管理：撈取該 merchant 的全部訂單（與會員中心、資料庫筆數一致）。
 * 含未付款（ATM／LINE Pay／綠界／藍新）、已付款、完成課程、已取消。
 */
export async function getAdminBookings(): Promise<
  | { success: true; data: BookingWithClass[] }
  | { success: false; error: string }
> {
  try {
    const supabase = createServerSupabase();
    const access = await getAdminBookingsAccessFilter(supabase);
    if (!access) return { success: false, error: "未設定店家" };

    const { data: rows, error } = await applyAdminBookingsAccess(
      supabase.from("bookings").select(`
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
        order_amount,
        addon_indices,
        classes ( title, image_url, price, addon_prices )
      `),
      access
    ).order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };

    const list: BookingWithClass[] = (rows ?? []).map((r: Record<string, unknown>) => {
      const classes = r.classes as { title?: string; image_url?: string; price?: number; addon_prices?: unknown } | null;
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
      const orderAmount = r.order_amount != null && r.order_amount !== "" ? Number(r.order_amount) : null;
      const classPrice = orderAmount ?? (classes?.price != null ? Number(classes.price) : null);
      const addonRaw = classes?.addon_prices;
      let classAddonPrices: { name: string; price: number }[] | null = null;
      if (Array.isArray(addonRaw)) {
        classAddonPrices = (addonRaw as { name?: string; price?: number }[]).map((a) => ({
          name: a?.name != null ? String(a.name) : "",
          price: a?.price != null ? Number(a.price) : 0,
        }));
      } else if (typeof addonRaw === "string") {
        try {
          const parsed = JSON.parse(addonRaw) as unknown;
          if (Array.isArray(parsed)) {
            classAddonPrices = (parsed as { name?: string; price?: number }[]).map((a) => ({
              name: a?.name != null ? String(a.name) : "",
              price: a?.price != null ? Number(a.price) : 0,
            }));
          }
        } catch {
          // ignore
        }
      }

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
        class_price: classPrice,
        addon_indices: parseAddonIndicesFromDb(r.addon_indices),
        class_addon_prices: classAddonPrices,
      };
    });

    return { success: true, data: list };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得訂單失敗";
    return { success: false, error: msg };
  }
}

/**
 * 後台：線上金流待付款列（尚未寫入 bookings）。客戶若已付款但 callback 失敗，會卡在此表。
 */
export async function getAdminPendingPayments(): Promise<
  | { success: true; data: AdminPendingPaymentRow[] }
  | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const supabase = createServerSupabase();
    const creatorFilter = getOrderAdminClassCreatorMerchantIdFilter();
    const scope = getAdminBookingMerchantScope();

    let rows: Record<string, unknown>[] | null = null;
    let error: { message: string } | null = null;

    if (creatorFilter) {
      const res = await supabase
        .from("pending_payments")
        .select(
          `
        id,
        member_email,
        parent_name,
        parent_phone,
        class_id,
        order_amount,
        payment_method,
        gateway_key,
        created_at,
        slot_date,
        slot_time,
        merchant_id,
        classes ( title, merchant_id, inventory_merchant_id )
      `
        )
        .order("created_at", { ascending: false })
        .limit(400);
      error = res.error;
      const raw = res.data ?? [];
      rows = raw.filter((r) => {
        const c = r.classes as
          | { merchant_id?: string; inventory_merchant_id?: string | null }
          | null
          | undefined;
        const inv = typeof c?.inventory_merchant_id === "string" ? c.inventory_merchant_id.trim() : "";
        const owner = (inv || c?.merchant_id || "").trim();
        return owner === creatorFilter;
      }) as Record<string, unknown>[];
    } else {
      if (scope.length === 0) return { success: false, error: "未設定店家" };
      const res = await supabase
        .from("pending_payments")
        .select(
          `
        id,
        member_email,
        parent_name,
        parent_phone,
        class_id,
        order_amount,
        payment_method,
        gateway_key,
        created_at,
        slot_date,
        slot_time,
        classes ( title )
      `
        )
        .in("merchant_id", scope)
        .order("created_at", { ascending: false });
      error = res.error;
      rows = res.data as Record<string, unknown>[] | null;
    }

    if (error) return { success: false, error: error.message };

    const list: AdminPendingPaymentRow[] = (rows ?? []).map((r: Record<string, unknown>) => {
      const cls = r.classes as { title?: string } | null;
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
        class_title: cls?.title != null ? String(cls.title) : null,
        order_amount: r.order_amount != null && r.order_amount !== "" ? Number(r.order_amount) : null,
        payment_method: r.payment_method != null ? String(r.payment_method) : "",
        gateway_key: r.gateway_key != null ? String(r.gateway_key) : null,
        created_at: String(r.created_at),
        slot_date,
        slot_time,
      };
    });

    return { success: true, data: list };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得待付款失敗";
    return { success: false, error: msg };
  }
}

/**
 * 後台：手動將一筆 pending 轉成已付款訂單（等同金流 callback 成功）。請僅在確認客戶已付款後使用。
 */
export async function createBookingFromPendingForAdmin(
  pendingId: string
): Promise<{ success: true; bookingId: string } | { success: false; error: string }> {
  try {
    await verifyAdminSession();
    const creatorFilter = getOrderAdminClassCreatorMerchantIdFilter();
    const scope = getAdminBookingMerchantScope();
    if (!creatorFilter && scope.length === 0) return { success: false, error: "未設定店家" };
    const id = (pendingId ?? "").trim();
    if (!id) return { success: false, error: "缺少待付款編號" };

    const supabase = createServerSupabase();
    const { data: pendingRow, error: pErr } = await supabase
      .from("pending_payments")
      .select("id, merchant_id, class_id, classes ( merchant_id, inventory_merchant_id, inventory_class_id )")
      .eq("id", id)
      .maybeSingle();

    if (pErr || !pendingRow) {
      return { success: false, error: "找不到此筆待付款" };
    }

    const pr = pendingRow as {
      id: string;
      merchant_id: string;
      class_id: string;
      classes?: {
        merchant_id?: string;
        inventory_merchant_id?: string | null;
        inventory_class_id?: string | null;
      } | null;
    };
    const c = pr.classes;
    const inv = typeof c?.inventory_merchant_id === "string" ? c.inventory_merchant_id.trim() : "";
    const resolvedCreator = (inv || c?.merchant_id || "").trim();

    if (creatorFilter) {
      if (resolvedCreator !== creatorFilter) {
        return { success: false, error: "此筆待付款不屬於目前設定的開課商家範圍" };
      }
    } else if (!scope.includes(pr.merchant_id)) {
      return { success: false, error: "找不到此筆待付款或非同店家資料" };
    }

    const { data: rpcResult, error: rpcErr } = await supabase.rpc("create_booking_from_pending", {
      p_pending_id: id,
    });
    if (rpcErr) {
      return { success: false, error: rpcErr.message };
    }
    const res = rpcResult as { ok?: boolean; booking_id?: string; error?: string } | null;
    if (!res?.ok || !res.booking_id) {
      return { success: false, error: (res?.error as string) || "建立訂單失敗" };
    }

    return { success: true, bookingId: String(res.booking_id) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "建立訂單失敗";
    return { success: false, error: msg };
  }
}

/**
 * 後台課程列表用：各課程的已報名人數（status 為 paid 或 completed）
 */
export async function getEnrollmentCountsForAdmin(): Promise<
  | { success: true; data: Record<string, number> }
  | { success: false; error: string }
> {
  try {
    const supabase = createServerSupabase();
    const access = await getAdminBookingsAccessFilter(supabase);
    if (!access) return { success: false, error: "未設定店家" };

    const { data: rows, error } = await applyAdminBookingsAccess(
      supabase.from("bookings").select("class_id").in("status", ["paid", "completed"]),
      access
    );

    if (error) return { success: false, error: error.message };

    let classRowsQuery = supabase.from("classes").select("id, inventory_class_id, inventory_merchant_id");
    if (access.mode === "class_creator") {
      classRowsQuery = classRowsQuery
        .eq("inventory_merchant_id", access.merchantId)
        .not("inventory_class_id", "is", null);
    } else {
      const scope = getAdminBookingMerchantScope();
      if (scope.length === 0) return { success: false, error: "未設定店家" };
      classRowsQuery = classRowsQuery.in("merchant_id", scope);
    }
    const { data: classRows } = await classRowsQuery;

    const invClassToListingId = new Map<string, string>();
    for (const c of classRows ?? []) {
      const rec = c as {
        id?: string;
        inventory_class_id?: string | null;
        inventory_merchant_id?: string | null;
      };
      const im = typeof rec.inventory_merchant_id === "string" ? rec.inventory_merchant_id.trim() : "";
      const ic = rec.inventory_class_id;
      if (im && ic && rec.id) invClassToListingId.set(String(ic), String(rec.id));
    }

    const counts: Record<string, number> = {};
    for (const r of rows ?? []) {
      const cid = (r as { class_id?: string }).class_id;
      if (!cid) continue;
      const listingId = invClassToListingId.get(String(cid));
      const key = listingId ?? String(cid);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return { success: true, data: counts };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得報名人數失敗";
    return { success: false, error: msg };
  }
}

/**
 * 後台會員列表用：各會員的報名課程數（status 為 paid 或 completed），以 member_email 為 key
 */
export async function getBookingCountsByMemberEmailForAdmin(): Promise<
  | { success: true; data: Record<string, number> }
  | { success: false; error: string }
> {
  try {
    const supabase = createServerSupabase();
    const access = await getAdminBookingsAccessFilter(supabase);
    if (!access) return { success: false, error: "未設定店家" };

    const { data: rows, error } = await applyAdminBookingsAccess(
      supabase.from("bookings").select("member_email").in("status", ["paid", "completed"]),
      access
    );

    if (error) return { success: false, error: error.message };

    const counts: Record<string, number> = {};
    for (const r of rows ?? []) {
      const email = (r as { member_email?: string }).member_email;
      if (email) {
        counts[email] = (counts[email] ?? 0) + 1;
      }
    }
    return { success: true, data: counts };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得報名數失敗";
    return { success: false, error: msg };
  }
}

/**
 * 後台會員管理：依會員信箱取得該會員的購買紀錄（訂單列表）。
 */
export async function getBookingsByMemberEmailForAdmin(memberEmail: string): Promise<
  | { success: true; data: BookingWithClass[] }
  | { success: false; error: string }
> {
  try {
    const email = (memberEmail ?? "").trim();
    if (!email) return { success: false, error: "請提供會員信箱" };

    const supabase = createServerSupabase();
    const access = await getAdminBookingsAccessFilter(supabase);
    if (!access) return { success: false, error: "未設定店家" };

    const { data: rows, error } = await applyAdminBookingsAccess(
      supabase.from("bookings").select(`
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
        order_amount,
        addon_indices,
        classes ( title, image_url, price, addon_prices )
      `),
      access
    )
      .eq("member_email", email)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };

    const list: BookingWithClass[] = (rows ?? []).map((r: Record<string, unknown>) => {
      const classes = r.classes as { title?: string; image_url?: string; price?: number; addon_prices?: unknown } | null;
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
      const orderAmount = r.order_amount != null && r.order_amount !== "" ? Number(r.order_amount) : null;
      const classPrice = orderAmount ?? (classes?.price != null ? Number(classes.price) : null);
      const addonRaw = classes?.addon_prices;
      let classAddonPrices: { name: string; price: number }[] | null = null;
      if (Array.isArray(addonRaw)) {
        classAddonPrices = (addonRaw as { name?: string; price?: number }[]).map((a) => ({
          name: a?.name != null ? String(a.name) : "",
          price: a?.price != null ? Number(a.price) : 0,
        }));
      } else if (typeof addonRaw === "string") {
        try {
          const parsed = JSON.parse(addonRaw) as unknown;
          if (Array.isArray(parsed)) {
            classAddonPrices = (parsed as { name?: string; price?: number }[]).map((a) => ({
              name: a?.name != null ? String(a.name) : "",
              price: a?.price != null ? Number(a.price) : 0,
            }));
          }
        } catch {
          // ignore
        }
      }
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
        class_price: classPrice,
        addon_indices: parseAddonIndicesFromDb(r.addon_indices),
        class_addon_prices: classAddonPrices,
      };
    });
    return { success: true, data: list };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得購買紀錄失敗";
    return { success: false, error: msg };
  }
}

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

/** 點名簿／日期彙總：列表課程 id 與實際計數用的課程 id（庫存課） */
type RollcallSlotSource = {
  displayClassId: string;
  countClassId: string;
  title: string | null;
  capacity: number;
  scheduled_slots: { date: string; time: string; capacity?: number }[];
  class_date: string | null;
  class_time: string | null;
};

async function loadRollcallSlotSources(
  supabase: ReturnType<typeof createServerSupabase>,
  merchantId: string
): Promise<RollcallSlotSource[] | { error: string }> {
  const { data: classesRows, error: classesError } = await supabase
    .from("classes")
    .select(
      "id, title, capacity, scheduled_slots, class_date, class_time, inventory_merchant_id, inventory_class_id"
    )
    .eq("merchant_id", merchantId);

  if (classesError) return { error: classesError.message };

  const invKeys: { mid: string; cid: string }[] = [];
  for (const r of classesRows ?? []) {
    const row = r as {
      inventory_merchant_id?: string | null;
      inventory_class_id?: string | null;
    };
    const im = typeof row.inventory_merchant_id === "string" ? row.inventory_merchant_id.trim() : "";
    const ic = row.inventory_class_id;
    if (im && ic) invKeys.push({ mid: im, cid: String(ic) });
  }

  const invMap = new Map<string, Record<string, unknown>>();
  if (invKeys.length > 0) {
    const ids = Array.from(new Set(invKeys.map((k) => k.cid)));
    const { data: invRows, error: invErr } = await supabase
      .from("classes")
      .select("id, merchant_id, capacity, scheduled_slots, class_date, class_time")
      .in("id", ids);
    if (invErr) return { error: invErr.message };
    for (const row of invRows ?? []) {
      const rec = row as Record<string, unknown>;
      const id = rec.id != null ? String(rec.id) : "";
      if (id) invMap.set(id, rec);
    }
  }

  const out: RollcallSlotSource[] = [];
  for (const r of classesRows ?? []) {
    const row = r as {
      id: string;
      title: string | null;
      capacity: number | null;
      scheduled_slots?: { date: string; time: string; capacity?: number }[] | null;
      class_date?: string | null;
      class_time?: string | null;
      inventory_merchant_id?: string | null;
      inventory_class_id?: string | null;
    };
    const im = typeof row.inventory_merchant_id === "string" ? row.inventory_merchant_id.trim() : "";
    const ic = row.inventory_class_id;
    let countClassId = row.id;
    let cap = row.capacity ?? 0;
    let slots = Array.isArray(row.scheduled_slots) ? row.scheduled_slots : [];
    let cdate = row.class_date ?? null;
    let ctime = row.class_time ?? null;

    if (im && ic) {
      const inv = invMap.get(String(ic));
      if (inv) {
        countClassId = String(inv.id);
        cap = inv.capacity != null ? Number(inv.capacity) : 0;
        slots = Array.isArray(inv.scheduled_slots) ? (inv.scheduled_slots as typeof slots) : [];
        cdate = inv.class_date != null ? String(inv.class_date).slice(0, 10) : null;
        ctime = inv.class_time != null ? String(inv.class_time) : null;
      }
    }

    out.push({
      displayClassId: row.id,
      countClassId,
      title: row.title,
      capacity: cap,
      scheduled_slots: slots,
      class_date: cdate,
      class_time: ctime,
    });
  }
  return out;
}

/** 從 DB 讀出的 addon_indices 可能是 array 或 Postgres 陣列字串 "{0,1}"，統一解析為 number[] */
function parseAddonIndicesFromDb(v: unknown): number[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map((x) => Number(x)).filter((n) => !Number.isNaN(n));
  if (typeof v === "string") {
    const s = v.replace(/^\{|\}$/g, "").trim();
    if (!s) return null;
    return s.split(",").map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n));
  }
  return null;
}

/** 點名簿用：一門課 + 其報名名單 */
/** 點名簿（依日期）：單一場次 = 同 class 同日期同時間 */
export type RollcallSession = {
  classId: string;
  /** 與名額統計、bookings.class_id 對齊；有庫存綁定時為老師端課程 id */
  countClassId: string;
  title: string | null;
  capacity: number;
  time: string;
  slotDate: string;
  enrolledCount: number;
};

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
    const sources = await loadRollcallSlotSources(supabase, merchantId);
    if ("error" in sources) return { success: false, error: sources.error };

    // 與 getRollcallSessionsByDate、getSlotRemainingCounts 一致：同一 (class, date, time) 以 scheduled_slots 為準，再以 class_date 補齊
    const dateToSessions = new Map<string, { key: string; capacity: number }[]>();

    for (const row of sources) {
      const classCapacity = row.capacity ?? 0;

      const slots = row.scheduled_slots;
      for (const s of slots) {
        const dateStr = String(s?.date).slice(0, 10);
        const time = s?.time ? String(s.time).slice(0, 5) : "00:00";
        const timeKey = time.length === 5 ? time : "00:00";
        const cap = (s as { capacity?: number }).capacity;
        const slotCap = typeof cap === "number" && cap >= 1 ? cap : classCapacity;
        const key = `${row.displayClassId}|${dateStr}|${timeKey}|${row.countClassId}`;
        if (!dateToSessions.has(dateStr)) dateToSessions.set(dateStr, []);
        const arr = dateToSessions.get(dateStr)!;
        if (!arr.some((x) => x.key === key)) arr.push({ key, capacity: slotCap });
      }

      if (row.class_date) {
        const dateStr = String(row.class_date).slice(0, 10);
        const t = row.class_time != null ? String(row.class_time).slice(0, 5) : "00:00";
        const timeKey = t.length === 5 ? t : "00:00";
        const key = `${row.displayClassId}|${dateStr}|${timeKey}|${row.countClassId}`;
        if (!dateToSessions.has(dateStr)) dateToSessions.set(dateStr, []);
        const arr = dateToSessions.get(dateStr)!;
        if (!arr.some((x) => x.key === key)) arr.push({ key, capacity: classCapacity });
      }
    }

    const countClassIds = Array.from(new Set(sources.map((s) => s.countClassId)));

    let countMap = new Map<string, number>();
    if (countClassIds.length > 0) {
      const { data: countRows, error: countError } = await supabase
        .from("bookings")
        .select("class_id, slot_date, slot_time")
        .in("class_id", countClassIds)
        .in("status", ["paid", "completed"]);

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
        const parts = key.split("|");
        const displayId = parts[0] ?? "";
        const datePart = parts[1] ?? "";
        const timePart = parts[2] ?? "";
        const countId = parts[3] ?? displayId;
        const countKey = `${countId}|${datePart}|${timePart}`;
        enrolledCount += countMap.get(countKey) ?? 0;
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

    const sources = await loadRollcallSlotSources(supabase, merchantId);
    if ("error" in sources) return { success: false, error: sources.error };

    const sessions: RollcallSession[] = [];
    const seen = new Set<string>();

    for (const row of sources) {
      const classCapacity = row.capacity ?? 0;

      const slots = row.scheduled_slots;
      for (const s of slots) {
        if (String(s?.date).slice(0, 10) !== dateStr) continue;
        const time = s?.time ? String(s.time).slice(0, 5) : "00:00";
        const timeKey = time.length === 5 ? time : "00:00";
        const cap = (s as { capacity?: number }).capacity;
        const slotCap = typeof cap === "number" && cap >= 1 ? cap : classCapacity;
        const key = `${row.displayClassId}|${dateStr}|${timeKey}`;
        if (!seen.has(key)) {
          seen.add(key);
          sessions.push({
            classId: row.displayClassId,
            countClassId: row.countClassId,
            title: row.title,
            capacity: slotCap,
            time: timeKey,
            slotDate: dateStr,
            enrolledCount: 0,
          });
        }
      }

      if (row.class_date && String(row.class_date).slice(0, 10) === dateStr) {
        const t = row.class_time != null ? String(row.class_time).slice(0, 5) : "00:00";
        const timeKey = t.length === 5 ? t : "00:00";
        const key = `${row.displayClassId}|${dateStr}|${timeKey}`;
        if (!seen.has(key)) {
          seen.add(key);
          sessions.push({
            classId: row.displayClassId,
            countClassId: row.countClassId,
            title: row.title,
            capacity: classCapacity,
            time: timeKey,
            slotDate: dateStr,
            enrolledCount: 0,
          });
        }
      }
    }

    const countClassIds = Array.from(new Set(sessions.map((s) => s.countClassId)));

    if (sessions.length === 0) return { success: true, data: [] };

    const { data: countRows, error: countError } = await supabase
      .from("bookings")
      .select("class_id, slot_date, slot_time")
      .in("class_id", countClassIds)
      .in("status", ["paid", "completed"]);

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
      const key = `${s.countClassId}|${s.slotDate}|${s.time}`;
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
 * 某場次點名簿：依 class_id + slot_date + slot_time 從 bookings 撈該場次「全部」訂單（含未付款），
 * 與訂單管理、會員中心筆數一致。已報名／總名額仍僅計 paid/completed。
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

    const inv = await fetchInventoryResolution(supabase, merchantId, classId);
    if (!inv) {
      return { success: false, error: "課程不存在" };
    }
    const countClassId = inv.inventoryClassId;

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
    const addonRaw = r.addon_prices;
    let classAddonPrices: { name: string; price: number }[] | null = null;
    if (Array.isArray(addonRaw)) {
      classAddonPrices = (addonRaw as { name?: string; price?: number }[]).map((a) => ({
        name: a?.name != null ? String(a.name) : "",
        price: a?.price != null ? Number(a.price) : 0,
      }));
    } else if (typeof addonRaw === "string") {
      try {
        const parsed = JSON.parse(addonRaw) as unknown;
        if (Array.isArray(parsed)) {
          classAddonPrices = (parsed as { name?: string; price?: number }[]).map((a) => ({
            name: a?.name != null ? String(a.name) : "",
            price: a?.price != null ? Number(a.price) : 0,
          }));
        }
      } catch {
        // ignore
      }
    }

    const access = await getAdminBookingsAccessFilter(supabase);
    if (!access) return { success: false, error: "未設定店家" };

    const { data: bookingsRows, error: bookingsError } = await applyAdminBookingsAccess(
      supabase
        .from("bookings")
        .select(
          "id, member_email, parent_name, parent_phone, kid_name, kid_age, allergy_or_special_note, addon_indices, status, created_at"
        )
        .eq("class_id", countClassId),
      access
    )
      .eq("slot_date", dateStr)
      .eq("slot_time", timeStr)
      .order("created_at", { ascending: true });

    if (bookingsError) return { success: false, error: bookingsError.message };

    const bookings: BookingWithMember[] = (bookingsRows ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      member_email: String(row.member_email),
      parent_name: row.parent_name != null ? String(row.parent_name).trim() || null : null,
      kid_name: row.kid_name != null ? String(row.kid_name).trim() || null : null,
      kid_age: row.kid_age != null ? String(row.kid_age).trim() || null : null,
      allergy_or_special_note: row.allergy_or_special_note != null ? String(row.allergy_or_special_note).trim() || null : null,
      contact_phone: row.parent_phone != null ? String(row.parent_phone).trim() || null : null,
      addon_indices: parseAddonIndicesFromDb(row.addon_indices),
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
