"use server";

import { cache } from "react";
import { unstable_noStore } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { FAQ_DATA } from "@/app/data/faq";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import { GLOBAL_CATEGORIES_SOURCE_MERCHANT_ID } from "@/lib/constants";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

const DEFAULT_SITE_NAME = "童趣島";
const DEFAULT_PRIMARY_COLOR = "#F59E0B"; // Tailwind amber-500
const DEFAULT_BACKGROUND_COLOR = "#fafaf9"; // 淺色柔和
const DEFAULT_ABOUT_SECTION_BG = "#ffffff";

/** 後台設定的發票品項一筆 */
export type InvoiceItemSetting = {
  name: string;
  word: string;
  /** 固定金額（選填）；若填則此品項為固定金額，其餘金額歸第一筆或未填的那一筆 */
  amount?: number;
};

export type StoreSettings = {
  siteName: string;
  primaryColor: string;
  backgroundColor: string;
  aboutSectionBackgroundColor: string;
  socialFbUrl: string;
  socialIgUrl: string;
  socialLineUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  /** 是否在前台顯示 AI 客服 Widget，預設 true */
  aiChatEnabled: boolean;
  /** AI 客服歡迎訊息，null 時用預設 */
  aiChatWelcomeMessage: string | null;
  /** 發票品項設定，null 時開立發票用預設一筆「課程預約」 */
  invoiceItems: InvoiceItemSetting[] | null;
  /** 發票開立廠商：'ecpay' 綠界、'ezpay' 藍新 ezPay（選 ezpay 尚未串接時會略過開立） */
  invoiceProvider: "ecpay" | "ezpay";
};

export type FaqItem = { id: string; question: string; answer: string };

/**
 * DB `store_settings.global_categories`（jsonb）的允許形狀。
 * Migration：`20260323120000_store_settings_global_categories.sql`。
 * {@link getGlobalCategoriesFromMain} 讀取 `store_settings.global_categories` 的那一列：
 * merchant_id 固定為 {@link GLOBAL_CATEGORIES_SOURCE_MERCHANT_ID}（與 model 總站一致）。
 */
export type StoreSettingsGlobalCategoriesJson =
  | string[]
  | { categories?: Array<string | { name?: string; label?: string }> }
  | Record<string, unknown>
  | null;

/** 預設常見問題（與 data/faq 一致，可變結構供回傳） */
function getDefaultFaqItems(): FaqItem[] {
  return FAQ_DATA.map((item) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
  }));
}

/** 較早 migration 已存在的欄位（production 未跑新 migration 時仍可讀取） */
const STORE_SETTINGS_SELECT_LEGACY =
  "site_name, primary_color, social_fb_url, social_ig_url, social_line_url, contact_email, contact_phone, contact_address";

const STORE_SETTINGS_SELECT_FULL =
  "site_name, primary_color, background_color, about_section_background_color, social_fb_url, social_ig_url, social_line_url, contact_email, contact_phone, contact_address, ai_chat_enabled, ai_chat_welcome_message, invoice_items, invoice_provider";

function parseInvoiceItems(raw: unknown): InvoiceItemSetting[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: InvoiceItemSetting[] = [];
  for (const x of raw) {
    if (typeof x !== "object" || x == null || !("name" in x)) continue;
    const name = String((x as { name?: unknown }).name ?? "").trim();
    if (!name) continue;
    out.push({
      name,
      word: String((x as { word?: unknown }).word ?? "式").trim().slice(0, 6),
      amount:
        typeof (x as { amount?: unknown }).amount === "number" && Number.isFinite((x as { amount?: unknown }).amount)
          ? Number((x as { amount?: unknown }).amount)
          : undefined,
    });
  }
  return out.length > 0 ? out : null;
}

function parseStoreSettingsRow(raw: Record<string, unknown>): StoreSettings {
  const trim = (v: unknown) => (typeof v === "string" ? v.trim() : "") || "";
  return {
    siteName: trim(raw.site_name) || DEFAULT_SITE_NAME,
    primaryColor: trim(raw.primary_color) || DEFAULT_PRIMARY_COLOR,
    backgroundColor: trim(raw.background_color) || DEFAULT_BACKGROUND_COLOR,
    aboutSectionBackgroundColor: trim(raw.about_section_background_color) || DEFAULT_ABOUT_SECTION_BG,
    socialFbUrl: trim(raw.social_fb_url),
    socialIgUrl: trim(raw.social_ig_url),
    socialLineUrl: trim(raw.social_line_url),
    contactEmail: trim(raw.contact_email),
    contactPhone: trim(raw.contact_phone),
    contactAddress: trim(raw.contact_address),
    aiChatEnabled: raw.ai_chat_enabled === false ? false : true,
    aiChatWelcomeMessage: typeof raw.ai_chat_welcome_message === "string" && raw.ai_chat_welcome_message.trim() ? raw.ai_chat_welcome_message.trim() : null,
    invoiceItems: parseInvoiceItems(raw.invoice_items),
    invoiceProvider: raw.invoice_provider === "ezpay" ? "ezpay" : "ecpay",
  };
}

const loadStoreSettingsForCurrentMerchant = cache(async (): Promise<StoreSettings> => {
  const fallback = (): StoreSettings => ({
    siteName: DEFAULT_SITE_NAME,
    primaryColor: DEFAULT_PRIMARY_COLOR,
    backgroundColor: DEFAULT_BACKGROUND_COLOR,
    aboutSectionBackgroundColor: DEFAULT_ABOUT_SECTION_BG,
    socialFbUrl: "",
    socialIgUrl: "",
    socialLineUrl: "",
    contactEmail: "",
    contactPhone: "",
    contactAddress: "",
    aiChatEnabled: true,
    aiChatWelcomeMessage: null,
    invoiceItems: null,
    invoiceProvider: "ecpay",
  });

  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    const supabase = createServerSupabase();

    try {
      const { data, error } = await supabase
        .from("store_settings")
        .select(STORE_SETTINGS_SELECT_FULL)
        .eq("merchant_id", merchantId || "")
        .maybeSingle();
      if (!error && data) {
        return parseStoreSettingsRow(data as Record<string, unknown>);
      }
    } catch {
      /* 可能為新欄位尚未存在，改試僅基本欄位 */
    }

    const { data, error } = await supabase
      .from("store_settings")
      .select(STORE_SETTINGS_SELECT_LEGACY)
      .eq("merchant_id", merchantId || "")
      .maybeSingle();
    if (error || !data) {
      return fallback();
    }
    return parseStoreSettingsRow(data as Record<string, unknown>);
  } catch {
    /* Supabase 未設定（缺 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）或連線失敗時回傳預設，避免 layout 崩潰 */
    return fallback();
  }
});

/** 取得目前店家的基本資料（網站名字、主色系、社群連結），無則回傳預設。同一請求內多次呼叫只查一次 DB。 */
export async function getStoreSettings(): Promise<StoreSettings> {
  return loadStoreSettingsForCurrentMerchant();
}

/**
 * 依指定商家讀 store_settings（發票品項／invoice_provider 等）。
 * 庫存課訂單之 `bookings.merchant_id` 為庫存擁有者時，開發票應用此函式，勿只用 NEXT_PUBLIC_CLIENT_ID。
 * 查無列時退回 {@link getStoreSettings}（目前站台）。
 */
export async function getStoreSettingsForMerchant(merchantId: string): Promise<StoreSettings> {
  unstable_noStore();
  const mid = (merchantId ?? "").trim();
  if (!mid) {
    return getStoreSettings();
  }

  try {
    const supabase = createServerSupabase();

    try {
      const { data, error } = await supabase
        .from("store_settings")
        .select(STORE_SETTINGS_SELECT_FULL)
        .eq("merchant_id", mid)
        .maybeSingle();
      if (!error && data) {
        return parseStoreSettingsRow(data as Record<string, unknown>);
      }
    } catch {
      /* 可能為新欄位尚未存在 */
    }

    const { data, error } = await supabase
      .from("store_settings")
      .select(STORE_SETTINGS_SELECT_LEGACY)
      .eq("merchant_id", mid)
      .maybeSingle();
    if (!error && data) {
      return parseStoreSettingsRow(data as Record<string, unknown>);
    }
  } catch {
    /* ignore */
  }

  return getStoreSettings();
}

/**
 * 從總站讀取 `store_settings.global_categories`（固定 {@link GLOBAL_CATEGORIES_SOURCE_MERCHANT_ID}）。
 * 回傳已去除空白、去重後的字串陣列；若發生錯誤、欄位不存在或尚未設定則回傳空陣列。
 */
export async function getGlobalCategoriesFromMain(): Promise<string[]> {
  unstable_noStore();
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("store_settings")
      .select("global_categories")
      .eq("merchant_id", GLOBAL_CATEGORIES_SOURCE_MERCHANT_ID)
      .maybeSingle();

    if (error || !data || !("global_categories" in data)) {
      return [];
    }

    const raw = (data as { global_categories?: unknown }).global_categories;
    if (!raw) return [];

    let list: string[] = [];

    if (Array.isArray(raw)) {
      list = raw
        .map((item): string | null => {
          if (typeof item === "string") return item.trim();
          if (typeof item === "object" && item !== null) {
            const obj = item as Record<string, unknown>;
            const name = typeof obj.name === "string" ? obj.name.trim() : "";
            const label = typeof obj.label === "string" ? obj.label.trim() : "";
            return (name || label) || null;
          }
          return null;
        })
        .filter((v): v is string => !!v);
    } else if (typeof raw === "object") {
      // 若儲存為物件（例如 { categories: [...] }），嘗試從其中解析
      const obj = raw as Record<string, unknown>;
      const inner = Array.isArray(obj.categories) ? obj.categories : [];
      list = inner
        .map((item): string | null => {
          if (typeof item === "string") return item.trim();
          if (typeof item === "object" && item !== null) {
            const o = item as Record<string, unknown>;
            const name = typeof o.name === "string" ? o.name.trim() : "";
            const label = typeof o.label === "string" ? o.label.trim() : "";
            return (name || label) || null;
          }
          return null;
        })
        .filter((v): v is string => !!v);
    }

    // 去除重複與空字串
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const v of list) {
      const key = v.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(key);
    }
    return deduped;
  } catch {
    // 若因 RLS 或環境變數造成錯誤，一律回傳空陣列，交由前端 fallback 處理
    return [];
  }
}

/** 取得常見問題列表（後台編輯、前台顯示用），無則回傳預設 */
export async function getFaqItems(): Promise<FaqItem[]> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("store_settings")
      .select("faq_items")
      .eq("merchant_id", merchantId || "")
      .maybeSingle();
    if (error || !data) return getDefaultFaqItems();
    const raw = data.faq_items;
    if (!Array.isArray(raw) || raw.length === 0) return getDefaultFaqItems();
    return raw.filter(
      (x: unknown): x is FaqItem =>
        typeof x === "object" &&
        x != null &&
        "id" in x &&
        "question" in x &&
        "answer" in x &&
        typeof (x as FaqItem).id === "string" &&
        typeof (x as FaqItem).question === "string" &&
        typeof (x as FaqItem).answer === "string"
    );
  } catch {
    return getDefaultFaqItems();
  }
}

/** 儲存常見問題列表 */
export async function updateFaqItems(
  items: FaqItem[]
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const list = items.filter((i) => (i.question?.trim() || i.answer?.trim()) !== "");
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("store_settings")
      .upsert(
        {
          merchant_id: merchantId,
          faq_items: list.length > 0 ? list : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      );
    if (error) return { success: false, error: error.message };
    return { success: true, message: "常見問題已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}

/** 更新基本資料（網站名字、主色系、背景色、關於我們區塊背景色、社群連結、聯絡資訊） */
export async function updateStoreSettings(
  siteName: string,
  primaryColor: string,
  backgroundColor: string,
  aboutSectionBackgroundColor: string,
  socialFbUrl?: string,
  socialIgUrl?: string,
  socialLineUrl?: string,
  contactEmail?: string,
  contactPhone?: string,
  contactAddress?: string
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    }
    const name = siteName?.trim() || DEFAULT_SITE_NAME;
    const color = primaryColor?.trim() || DEFAULT_PRIMARY_COLOR;
    const bgColor = backgroundColor?.trim() || DEFAULT_BACKGROUND_COLOR;
    const aboutBg = aboutSectionBackgroundColor?.trim() || DEFAULT_ABOUT_SECTION_BG;
    const trim = (s: string | undefined) => (typeof s === "string" ? s.trim() : "") || null;
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("store_settings")
      .upsert(
        {
          merchant_id: merchantId,
          site_name: name,
          primary_color: color,
          background_color: bgColor,
          about_section_background_color: aboutBg,
          social_fb_url: trim(socialFbUrl),
          social_ig_url: trim(socialIgUrl),
          social_line_url: trim(socialLineUrl),
          contact_email: trim(contactEmail),
          contact_phone: trim(contactPhone),
          contact_address: trim(contactAddress),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      );
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, message: "基本資料已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}

/** 更新 AI 客服設定（開關、歡迎訊息） */
export async function updateAiChatSettings(
  aiChatEnabled: boolean,
  aiChatWelcomeMessage: string | null
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    }
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("store_settings")
      .update({
        ai_chat_enabled: !!aiChatEnabled,
        ai_chat_welcome_message: typeof aiChatWelcomeMessage === "string" && aiChatWelcomeMessage.trim() ? aiChatWelcomeMessage.trim() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_id", merchantId);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, message: "AI 客服設定已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}

/** 更新發票廠商與品項（後台已改由「金流／發票設定」更新廠商並清空品項；保留供相容或腳本） */
export async function updateInvoiceSettings(
  invoiceProvider: "ecpay" | "ezpay",
  items: InvoiceItemSetting[]
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    }
    const list = items.filter((i) => (i.name ?? "").trim() !== "").map((i) => ({
      name: String(i.name).trim().slice(0, 500),
      word: String(i.word ?? "式").trim().slice(0, 6),
      amount: typeof i.amount === "number" && Number.isFinite(i.amount) && i.amount >= 0 ? i.amount : undefined,
    }));
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("store_settings")
      .update({
        invoice_provider: invoiceProvider === "ezpay" ? "ezpay" : "ecpay",
        invoice_items: list.length > 0 ? list : null,
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_id", merchantId);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, message: "發票設定已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}

/** @deprecated 請改用 updateInvoiceSettings(provider, items) */
export async function updateInvoiceItems(
  items: InvoiceItemSetting[]
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  return updateInvoiceSettings("ecpay", items);
}
