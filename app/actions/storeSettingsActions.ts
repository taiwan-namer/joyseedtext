"use server";

import { unstable_noStore } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { FAQ_DATA } from "@/app/data/faq";
import { getAdminSessionOrThrow } from "@/lib/auth/adminSession";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

const DEFAULT_SITE_NAME = "童趣島";
const DEFAULT_PRIMARY_COLOR = "#F59E0B"; // Tailwind amber-500

export type StoreSettings = {
  siteName: string;
  primaryColor: string;
  socialFbUrl: string;
  socialIgUrl: string;
  socialLineUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
};

export type FaqItem = { id: string; question: string; answer: string };

/** 預設常見問題（與 data/faq 一致，可變結構供回傳） */
function getDefaultFaqItems(): FaqItem[] {
  return FAQ_DATA.map((item) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
  }));
}

/** 取得目前店家的基本資料（網站名字、主色系、社群連結），無則回傳預設 */
export async function getStoreSettings(): Promise<StoreSettings> {
  unstable_noStore();
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("store_settings")
      .select("site_name, primary_color, social_fb_url, social_ig_url, social_line_url, contact_email, contact_phone, contact_address")
      .eq("merchant_id", merchantId || "")
      .maybeSingle();
    if (error || !data) {
      return {
        siteName: DEFAULT_SITE_NAME,
        primaryColor: DEFAULT_PRIMARY_COLOR,
        socialFbUrl: "",
        socialIgUrl: "",
        socialLineUrl: "",
        contactEmail: "",
        contactPhone: "",
        contactAddress: "",
      };
    }
    const trim = (v: unknown) => (typeof v === "string" ? v.trim() : "") || "";
    return {
      siteName: trim(data.site_name) || DEFAULT_SITE_NAME,
      primaryColor: trim(data.primary_color) || DEFAULT_PRIMARY_COLOR,
      socialFbUrl: trim(data.social_fb_url),
      socialIgUrl: trim(data.social_ig_url),
      socialLineUrl: trim(data.social_line_url),
      contactEmail: trim(data.contact_email),
      contactPhone: trim(data.contact_phone),
      contactAddress: trim(data.contact_address),
    };
  } catch {
    return {
      siteName: DEFAULT_SITE_NAME,
      primaryColor: DEFAULT_PRIMARY_COLOR,
      socialFbUrl: "",
      socialIgUrl: "",
      socialLineUrl: "",
      contactEmail: "",
      contactPhone: "",
      contactAddress: "",
    };
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
    await getAdminSessionOrThrow();
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

/** 更新基本資料（網站名字、主色系、社群連結、聯絡資訊） */
export async function updateStoreSettings(
  siteName: string,
  primaryColor: string,
  socialFbUrl?: string,
  socialIgUrl?: string,
  socialLineUrl?: string,
  contactEmail?: string,
  contactPhone?: string,
  contactAddress?: string
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  try {
    await getAdminSessionOrThrow();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    }
    const name = siteName?.trim() || DEFAULT_SITE_NAME;
    const color = primaryColor?.trim() || DEFAULT_PRIMARY_COLOR;
    const trim = (s: string | undefined) => (typeof s === "string" ? s.trim() : "") || null;
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("store_settings")
      .upsert(
        {
          merchant_id: merchantId,
          site_name: name,
          primary_color: color,
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
