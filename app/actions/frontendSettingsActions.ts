"use server";

import { unstable_noStore } from "next/cache";
import { uploadOneToR2, uploadOneToR2WithPrefix } from "@/app/actions/productActions";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import {
  type CarouselItem,
  type FrontendSettings,
  type LayoutBlock,
  DEFAULT_MEMBER_ICON_URLS,
  DEFAULT_CAROUSEL,
  DEFAULT_HERO_TITLE,
  DEFAULT_NAV,
  DEFAULT_LAYOUT_ORDER,
  getDefaultLayoutBlocks,
} from "@/app/lib/frontendSettingsShared";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/** 取得前台設定（首頁大圖、輪播） */
export async function getFrontendSettings(): Promise<FrontendSettings> {
  unstable_noStore();
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("store_settings")
      .select("frontend_settings")
      .eq("merchant_id", merchantId || "")
      .maybeSingle();
    if (error || !data?.frontend_settings) {
      return {
        heroImageUrl: null,
        heroTitle: DEFAULT_HERO_TITLE,
        carouselItems: DEFAULT_CAROUSEL,
        navAboutLabel: DEFAULT_NAV.about,
        navCoursesLabel: DEFAULT_NAV.courses,
        navBookingLabel: DEFAULT_NAV.booking,
        navFaqLabel: DEFAULT_NAV.faq,
        memberIconGallery: DEFAULT_MEMBER_ICON_URLS,
        memberIconSelectedIndex: 0,
        aboutContent: null,
        seoTitle: null,
        seoKeywords: null,
        seoDescription: null,
        seoFaviconUrl: null,
        linePayApi: null,
        thirdPartyApi: null,
        atmBankName: null,
        atmBankCode: null,
        atmBankAccount: null,
        paymentNewebpayEnabled: false,
        paymentEcpayEnabled: false,
        paymentLinepayEnabled: false,
        paymentAtmEnabled: false,
        layoutOrder: DEFAULT_LAYOUT_ORDER,
        fullWidthImageUrl: null,
        layoutBlocks: getDefaultLayoutBlocks(),
      };
    }
    const raw = data.frontend_settings as Record<string, unknown>;
    const items = Array.isArray(raw.carouselItems)
      ? (raw.carouselItems as unknown[]).map((x: unknown, i: number) => {
          const o = x as Record<string, unknown>;
          return {
            id: typeof o.id === "string" ? o.id : `w${i + 1}`,
            title: typeof o.title === "string" ? o.title : "",
            subtitle: typeof o.subtitle === "string" ? o.subtitle : "",
            imageUrl: o.imageUrl != null ? String(o.imageUrl) : null,
            visible: o.visible === false ? false : true,
          };
        })
      : DEFAULT_CAROUSEL;
    const gallery = Array.isArray(raw.memberIconGallery) && (raw.memberIconGallery as unknown[]).length > 0
      ? (raw.memberIconGallery as unknown[]).filter((u): u is string => typeof u === "string")
      : DEFAULT_MEMBER_ICON_URLS;
    const selectedIndex = typeof raw.memberIconSelectedIndex === "number"
      ? Math.max(0, Math.min(raw.memberIconSelectedIndex, gallery.length - 1))
      : 0;
    return {
      heroImageUrl: raw.heroImageUrl != null ? String(raw.heroImageUrl) : null,
      heroTitle: raw.heroTitle != null ? String(raw.heroTitle) : DEFAULT_HERO_TITLE,
      carouselItems: items.length > 0 ? items : DEFAULT_CAROUSEL,
      navAboutLabel: typeof raw.navAboutLabel === "string" && raw.navAboutLabel.trim() ? raw.navAboutLabel.trim() : DEFAULT_NAV.about,
      navCoursesLabel: typeof raw.navCoursesLabel === "string" && raw.navCoursesLabel.trim() ? raw.navCoursesLabel.trim() : DEFAULT_NAV.courses,
      navBookingLabel: typeof raw.navBookingLabel === "string" && raw.navBookingLabel.trim() ? raw.navBookingLabel.trim() : DEFAULT_NAV.booking,
      navFaqLabel: typeof raw.navFaqLabel === "string" && raw.navFaqLabel.trim() ? raw.navFaqLabel.trim() : DEFAULT_NAV.faq,
      memberIconGallery: gallery,
      memberIconSelectedIndex: gallery.length > 0 ? selectedIndex : 0,
      aboutContent: typeof raw.aboutContent === "string" ? raw.aboutContent : null,
      seoTitle: typeof raw.seoTitle === "string" ? raw.seoTitle : null,
      seoKeywords: typeof raw.seoKeywords === "string" ? raw.seoKeywords : null,
      seoDescription: typeof raw.seoDescription === "string" ? raw.seoDescription : null,
      seoFaviconUrl: typeof raw.seoFaviconUrl === "string" ? raw.seoFaviconUrl : null,
      linePayApi: typeof raw.linePayApi === "string" ? raw.linePayApi : null,
      thirdPartyApi: typeof raw.thirdPartyApi === "string" ? raw.thirdPartyApi : null,
      atmBankName: typeof raw.atmBankName === "string" ? raw.atmBankName : null,
      atmBankAccount: typeof raw.atmBankAccount === "string" ? raw.atmBankAccount : null,
      atmBankCode: raw.atmBankCode != null ? String(raw.atmBankCode) : null,
      paymentNewebpayEnabled: raw.paymentNewebpayEnabled === true,
      paymentEcpayEnabled: raw.paymentEcpayEnabled === true,
      paymentLinepayEnabled: raw.paymentLinepayEnabled === true,
      paymentAtmEnabled: raw.paymentAtmEnabled === true,
      layoutOrder: Array.isArray(raw.layout_order) && (raw.layout_order as unknown[]).length > 0
        ? (raw.layout_order as unknown[]).filter((x): x is string => typeof x === "string")
        : DEFAULT_LAYOUT_ORDER,
      fullWidthImageUrl: typeof raw.fullWidthImageUrl === "string" ? raw.fullWidthImageUrl : null,
      layoutBlocks: parseLayoutBlocks(raw.layout_blocks),
    };
  } catch {
    return {
      heroImageUrl: null,
      heroTitle: DEFAULT_HERO_TITLE,
      carouselItems: DEFAULT_CAROUSEL,
      navAboutLabel: DEFAULT_NAV.about,
      navCoursesLabel: DEFAULT_NAV.courses,
      navBookingLabel: DEFAULT_NAV.booking,
      navFaqLabel: DEFAULT_NAV.faq,
      memberIconGallery: DEFAULT_MEMBER_ICON_URLS,
      memberIconSelectedIndex: 0,
      aboutContent: null,
      seoTitle: null,
      seoKeywords: null,
      seoDescription: null,
      seoFaviconUrl: null,
      linePayApi: null,
      thirdPartyApi: null,
      atmBankName: null,
      atmBankAccount: null,
      atmBankCode: null,
      paymentNewebpayEnabled: false,
      paymentEcpayEnabled: false,
      paymentLinepayEnabled: false,
      paymentAtmEnabled: false,
      layoutOrder: DEFAULT_LAYOUT_ORDER,
      fullWidthImageUrl: null,
      layoutBlocks: getDefaultLayoutBlocks(),
    };
  }
}

function parseLayoutBlocks(raw: unknown): LayoutBlock[] {
  if (!Array.isArray(raw) || raw.length === 0) return getDefaultLayoutBlocks();
  const blocks: LayoutBlock[] = [];
  for (let i = 0; i < raw.length; i++) {
    const o = raw[i] as Record<string, unknown> | null;
    if (!o || typeof o.id !== "string") continue;
    const order = typeof o.order === "number" ? o.order : i;
    const heightPx = typeof o.heightPx === "number" && o.heightPx > 0 ? o.heightPx : null;
    const backgroundImageUrl = typeof o.backgroundImageUrl === "string" ? o.backgroundImageUrl : null;
    blocks.push({ id: o.id, order, heightPx, backgroundImageUrl });
  }
  blocks.sort((a, b) => a.order - b.order);
  return blocks.length > 0 ? blocks : getDefaultLayoutBlocks();
}

/** 更新畫布區塊（後台「首頁版面」儲存用）；會一併寫入 layout_order 以相容舊版 */
export async function updateLayoutBlocks(blocks: LayoutBlock[]): Promise<
  { success: true; message?: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const existing = await getFrontendSettings();
    const sorted = [...blocks].sort((a, b) => a.order - b.order);
    const layout_order = sorted.map((b) => b.id);
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const frontendSettings: Record<string, unknown> = {
      heroImageUrl: existing.heroImageUrl,
      heroTitle: existing.heroTitle,
      carouselItems: existing.carouselItems,
      navAboutLabel: existing.navAboutLabel,
      navCoursesLabel: existing.navCoursesLabel,
      navBookingLabel: existing.navBookingLabel,
      navFaqLabel: existing.navFaqLabel,
      memberIconGallery: existing.memberIconGallery,
      memberIconSelectedIndex: existing.memberIconSelectedIndex,
      aboutContent: existing.aboutContent ?? null,
      seoTitle: existing.seoTitle ?? null,
      seoKeywords: existing.seoKeywords ?? null,
      seoDescription: existing.seoDescription ?? null,
      seoFaviconUrl: existing.seoFaviconUrl ?? null,
      linePayApi: existing.linePayApi ?? null,
      thirdPartyApi: existing.thirdPartyApi ?? null,
      atmBankName: existing.atmBankName ?? null,
      atmBankAccount: existing.atmBankAccount ?? null,
      atmBankCode: existing.atmBankCode ?? null,
      paymentNewebpayEnabled: existing.paymentNewebpayEnabled ?? false,
      paymentEcpayEnabled: existing.paymentEcpayEnabled ?? false,
      paymentLinepayEnabled: existing.paymentLinepayEnabled ?? false,
      paymentAtmEnabled: existing.paymentAtmEnabled ?? false,
      layout_order,
      fullWidthImageUrl: existing.fullWidthImageUrl ?? null,
      layout_blocks: sorted.map((b) => ({
        id: b.id,
        order: b.order,
        heightPx: b.heightPx,
        backgroundImageUrl: b.backgroundImageUrl,
      })),
    };
    const { error } = await supabase
      .from("store_settings")
      .upsert(
        {
          merchant_id: merchantId,
          frontend_settings: frontendSettings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      );
    if (error) return { success: false, error: error.message };
    return { success: true, message: "版面已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}

/** 上傳區塊背景圖至 R2，回傳網址（再由前端寫入該區塊 backgroundImageUrl 並呼叫 updateLayoutBlocks） */
export async function uploadLayoutBlockBackground(formData: FormData): Promise<
  { success: true; url: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const url = await uploadOneToR2WithPrefix(formData, "background_image", "layout-bg");
    if (!url) return { success: false, error: "未選擇圖片或檔案無效" };
    return { success: true, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上傳失敗";
    return { success: false, error: msg };
  }
}

/** 更新首頁區塊順序（後台「首頁版面」儲存用） */
export async function updateLayoutOrder(order: string[]): Promise<
  { success: true; message?: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const existing = await getFrontendSettings();
    const uniqueOrder = Array.from(new Set(order)).filter((id) => id != null && String(id).trim() !== "");
    if (uniqueOrder.length === 0) return { success: false, error: "至少需保留一個區塊" };
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const frontendSettings: Record<string, unknown> = {
      heroImageUrl: existing.heroImageUrl,
      heroTitle: existing.heroTitle,
      carouselItems: existing.carouselItems,
      navAboutLabel: existing.navAboutLabel,
      navCoursesLabel: existing.navCoursesLabel,
      navBookingLabel: existing.navBookingLabel,
      navFaqLabel: existing.navFaqLabel,
      memberIconGallery: existing.memberIconGallery,
      memberIconSelectedIndex: existing.memberIconSelectedIndex,
      aboutContent: existing.aboutContent ?? null,
      seoTitle: existing.seoTitle ?? null,
      seoKeywords: existing.seoKeywords ?? null,
      seoDescription: existing.seoDescription ?? null,
      seoFaviconUrl: existing.seoFaviconUrl ?? null,
      linePayApi: existing.linePayApi ?? null,
      thirdPartyApi: existing.thirdPartyApi ?? null,
      atmBankName: existing.atmBankName ?? null,
      atmBankAccount: existing.atmBankAccount ?? null,
      atmBankCode: existing.atmBankCode ?? null,
      paymentNewebpayEnabled: existing.paymentNewebpayEnabled ?? false,
      paymentEcpayEnabled: existing.paymentEcpayEnabled ?? false,
      paymentLinepayEnabled: existing.paymentLinepayEnabled ?? false,
      paymentAtmEnabled: existing.paymentAtmEnabled ?? false,
      layout_order: uniqueOrder,
      fullWidthImageUrl: existing.fullWidthImageUrl ?? null,
      layout_blocks: uniqueOrder.map((id, i) => {
        const b = existing.layoutBlocks.find((x) => x.id === id);
        return b ? { id: b.id, order: i, heightPx: b.heightPx, backgroundImageUrl: b.backgroundImageUrl } : { id, order: i, heightPx: null, backgroundImageUrl: null };
      }),
    };
    const { error } = await supabase
      .from("store_settings")
      .upsert(
        {
          merchant_id: merchantId,
          frontend_settings: frontendSettings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      );
    if (error) return { success: false, error: error.message };
    return { success: true, message: "版面順序已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}

/** 更新單張大圖區塊的圖片網址 */
export async function updateFullWidthImageUrl(url: string | null): Promise<
  { success: true; message?: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const existing = await getFrontendSettings();
    const value = typeof url === "string" && url.trim() ? url.trim() : null;
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const frontendSettings: Record<string, unknown> = {
      heroImageUrl: existing.heroImageUrl,
      heroTitle: existing.heroTitle,
      carouselItems: existing.carouselItems,
      navAboutLabel: existing.navAboutLabel,
      navCoursesLabel: existing.navCoursesLabel,
      navBookingLabel: existing.navBookingLabel,
      navFaqLabel: existing.navFaqLabel,
      memberIconGallery: existing.memberIconGallery,
      memberIconSelectedIndex: existing.memberIconSelectedIndex,
      aboutContent: existing.aboutContent ?? null,
      seoTitle: existing.seoTitle ?? null,
      seoKeywords: existing.seoKeywords ?? null,
      seoDescription: existing.seoDescription ?? null,
      seoFaviconUrl: existing.seoFaviconUrl ?? null,
      linePayApi: existing.linePayApi ?? null,
      thirdPartyApi: existing.thirdPartyApi ?? null,
      atmBankName: existing.atmBankName ?? null,
      atmBankAccount: existing.atmBankAccount ?? null,
      atmBankCode: existing.atmBankCode ?? null,
      paymentNewebpayEnabled: existing.paymentNewebpayEnabled ?? false,
      paymentEcpayEnabled: existing.paymentEcpayEnabled ?? false,
      paymentLinepayEnabled: existing.paymentLinepayEnabled ?? false,
      paymentAtmEnabled: existing.paymentAtmEnabled ?? false,
      layout_order: existing.layoutOrder,
      fullWidthImageUrl: value,
      layout_blocks: existing.layoutBlocks.map((b) => ({ id: b.id, order: b.order, heightPx: b.heightPx, backgroundImageUrl: b.backgroundImageUrl })),
    };
    const { error } = await supabase
      .from("store_settings")
      .upsert(
        {
          merchant_id: merchantId,
          frontend_settings: frontendSettings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      );
    if (error) return { success: false, error: error.message };
    return { success: true, message: "單張大圖網址已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}

/** 更新前台設定（表單送出：大圖、大圖文字、輪播項目） */
export async function updateFrontendSettings(formData: FormData): Promise<
  { success: true; message?: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };

    const existing = await getFrontendSettings();

    const heroUrl = (formData.get("hero_image_url") as string)?.trim() || null;
    let heroImageUrl = heroUrl || existing.heroImageUrl;
    const heroFile = formData.get("hero_image") as File | null;
    if (!heroUrl && heroFile && heroFile instanceof File && heroFile.size > 0) {
      const url = await uploadOneToR2(formData, "hero_image");
      if (url) heroImageUrl = url;
    }

    const heroTitle = (formData.get("hero_title") as string)?.trim() || DEFAULT_HERO_TITLE;

    const carouselLength = Math.min(20, Math.max(0, parseInt(String(formData.get("carousel_length") || "3"), 10) || 3));
    const carouselItems: CarouselItem[] = [];
    for (let i = 0; i < carouselLength; i++) {
      const id = existing.carouselItems[i]?.id ?? `w${i + 1}`;
      const title = (formData.get(`carousel_${i}_title`) as string)?.trim() || "";
      const subtitle = (formData.get(`carousel_${i}_subtitle`) as string)?.trim() || "";
      const imageUrlForm = (formData.get(`carousel_${i}_image_url`) as string)?.trim() || null;
      let imageUrl = (imageUrlForm || existing.carouselItems[i]?.imageUrl) ?? null;
      const file = formData.get(`carousel_${i}_image`) as File | null;
      if (!imageUrlForm && file && file instanceof File && file.size > 0) {
        const url = await uploadOneToR2(formData, `carousel_${i}_image`);
        if (url) imageUrl = url;
      }
      const visibleRaw = formData.get(`carousel_${i}_visible`);
      const visible = visibleRaw === "0" || String(visibleRaw).toLowerCase() === "false" ? false : true;
      carouselItems.push({ id, title, subtitle, imageUrl, visible });
    }

    const navCoursesLabel = (formData.get("nav_courses_label") as string)?.trim() || DEFAULT_NAV.courses;
    const navBookingLabel = (formData.get("nav_booking_label") as string)?.trim() || DEFAULT_NAV.booking;
    const navFaqLabel = (formData.get("nav_faq_label") as string)?.trim() || DEFAULT_NAV.faq;

    let memberIconGallery: string[] = DEFAULT_MEMBER_ICON_URLS;
    try {
      const galleryJson = formData.get("member_icon_gallery_json") as string | null;
      if (galleryJson) {
        const parsed = JSON.parse(galleryJson) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) memberIconGallery = parsed;
      }
    } catch {}
    const memberIconSelectedIndex = Math.min(
      Math.max(0, parseInt(String(formData.get("member_icon_selected_index") || "0"), 10) || 0),
      Math.max(0, memberIconGallery.length - 1)
    );

    const navAboutLabel = formData.has("nav_about_label")
      ? ((formData.get("nav_about_label") as string)?.trim() || DEFAULT_NAV.about)
      : existing.navAboutLabel;
    const aboutContent = formData.has("about_content")
      ? ((formData.get("about_content") as string)?.trim() || null)
      : existing.aboutContent ?? null;
    const seoTitle = formData.has("seo_title")
      ? ((formData.get("seo_title") as string)?.trim() || null)
      : existing.seoTitle ?? null;
    const seoKeywords = formData.has("seo_keywords")
      ? ((formData.get("seo_keywords") as string)?.trim() || null)
      : existing.seoKeywords ?? null;
    const seoDescription = formData.has("seo_description")
      ? ((formData.get("seo_description") as string)?.trim() || null)
      : existing.seoDescription ?? null;

    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("store_settings")
      .upsert(
        {
          merchant_id: merchantId,
          frontend_settings: {
            heroImageUrl,
            heroTitle,
            carouselItems,
            navAboutLabel,
            navCoursesLabel,
            navBookingLabel,
            navFaqLabel,
            memberIconGallery,
            memberIconSelectedIndex,
            aboutContent,
            seoTitle,
            seoKeywords,
            seoDescription,
            linePayApi: existing.linePayApi ?? null,
            thirdPartyApi: existing.thirdPartyApi ?? null,
            atmBankName: existing.atmBankName ?? null,
            atmBankAccount: existing.atmBankAccount ?? null,
            atmBankCode: existing.atmBankCode ?? null,
            layout_order: existing.layoutOrder,
            fullWidthImageUrl: existing.fullWidthImageUrl ?? null,
            layout_blocks: existing.layoutBlocks.map((b) => ({ id: b.id, order: b.order, heightPx: b.heightPx, backgroundImageUrl: b.backgroundImageUrl })),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      );
    if (error) return { success: false, error: error.message };
    return { success: true, message: "前台設定已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}

/** 關於我們獨立頁：僅取得導覽列文字與內容 */
export async function getAboutPageData(): Promise<{ navAboutLabel: string; aboutContent: string | null }> {
  const s = await getFrontendSettings();
  return { navAboutLabel: s.navAboutLabel ?? DEFAULT_NAV.about, aboutContent: s.aboutContent ?? null };
}

/** 關於我們獨立頁：僅更新導覽列文字與內容 */
export async function updateAboutPage(formData: FormData): Promise<
  { success: true; message?: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const existing = await getFrontendSettings();
    const navAboutLabel = (formData.get("nav_about_label") as string)?.trim() || DEFAULT_NAV.about;
    const aboutContent = (formData.get("about_content") as string)?.trim() || null;
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("store_settings")
      .upsert(
        {
          merchant_id: merchantId,
          frontend_settings: {
            heroImageUrl: existing.heroImageUrl,
            heroTitle: existing.heroTitle,
            carouselItems: existing.carouselItems,
            navAboutLabel,
            navCoursesLabel: existing.navCoursesLabel,
            navBookingLabel: existing.navBookingLabel,
            navFaqLabel: existing.navFaqLabel,
            memberIconGallery: existing.memberIconGallery,
            memberIconSelectedIndex: existing.memberIconSelectedIndex,
            aboutContent,
            seoTitle: existing.seoTitle ?? null,
            seoKeywords: existing.seoKeywords ?? null,
            seoDescription: existing.seoDescription ?? null,
            linePayApi: existing.linePayApi ?? null,
            thirdPartyApi: existing.thirdPartyApi ?? null,
            atmBankName: existing.atmBankName ?? null,
            atmBankAccount: existing.atmBankAccount ?? null,
            atmBankCode: existing.atmBankCode ?? null,
            layout_order: existing.layoutOrder,
            fullWidthImageUrl: existing.fullWidthImageUrl ?? null,
            layout_blocks: existing.layoutBlocks.map((b) => ({ id: b.id, order: b.order, heightPx: b.heightPx, backgroundImageUrl: b.backgroundImageUrl })),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      );
    if (error) return { success: false, error: error.message };
    return { success: true, message: "關於我們已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}

/** SEO 設定：供後台 SEO 頁與 layout metadata 使用 */
export async function getSeoSettings(): Promise<{
  seoTitle: string | null;
  seoKeywords: string | null;
  seoDescription: string | null;
  seoFaviconUrl: string | null;
}> {
  const s = await getFrontendSettings();
  return {
    seoTitle: s.seoTitle ?? null,
    seoKeywords: s.seoKeywords ?? null,
    seoDescription: s.seoDescription ?? null,
    seoFaviconUrl: s.seoFaviconUrl ?? null,
  };
}

/** SEO 設定頁：更新網頁標題、關鍵字、描述、分頁圖示（Favicon） */
export async function updateSeoSettings(formData: FormData): Promise<
  { success: true; message?: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const existing = await getFrontendSettings();
    const seoTitle = (formData.get("seo_title") as string)?.trim() || null;
    const seoKeywords = (formData.get("seo_keywords") as string)?.trim() || null;
    const seoDescription = (formData.get("seo_description") as string)?.trim() || null;
    const faviconUrlForm = (formData.get("seo_favicon_url") as string)?.trim() || null;
    const faviconFile = formData.get("seo_favicon") as File | null;
    let seoFaviconUrl = existing.seoFaviconUrl ?? null;
    if (faviconUrlForm) {
      seoFaviconUrl = faviconUrlForm;
    } else if (faviconFile && faviconFile instanceof File && faviconFile.size > 0) {
      const url = await uploadOneToR2(formData, "seo_favicon");
      if (url) seoFaviconUrl = url;
    }
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("store_settings")
      .upsert(
        {
          merchant_id: merchantId,
          frontend_settings: {
            heroImageUrl: existing.heroImageUrl,
            heroTitle: existing.heroTitle,
            carouselItems: existing.carouselItems,
            navAboutLabel: existing.navAboutLabel,
            navCoursesLabel: existing.navCoursesLabel,
            navBookingLabel: existing.navBookingLabel,
            navFaqLabel: existing.navFaqLabel,
            memberIconGallery: existing.memberIconGallery,
            memberIconSelectedIndex: existing.memberIconSelectedIndex,
            aboutContent: existing.aboutContent ?? null,
            seoTitle,
            seoKeywords,
            seoDescription,
            seoFaviconUrl,
            linePayApi: existing.linePayApi ?? null,
            thirdPartyApi: existing.thirdPartyApi ?? null,
            atmBankName: existing.atmBankName ?? null,
            atmBankAccount: existing.atmBankAccount ?? null,
            atmBankCode: existing.atmBankCode ?? null,
            paymentNewebpayEnabled: existing.paymentNewebpayEnabled ?? false,
            paymentEcpayEnabled: existing.paymentEcpayEnabled ?? false,
            paymentLinepayEnabled: existing.paymentLinepayEnabled ?? false,
            paymentAtmEnabled: existing.paymentAtmEnabled ?? false,
            layout_order: existing.layoutOrder,
            fullWidthImageUrl: existing.fullWidthImageUrl ?? null,
            layout_blocks: existing.layoutBlocks.map((b) => ({ id: b.id, order: b.order, heightPx: b.heightPx, backgroundImageUrl: b.backgroundImageUrl })),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      );
    if (error) return { success: false, error: error.message };
    return { success: true, message: "SEO 設定已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}

/** 金流設定：供後台金流設定頁與結帳頁使用（開關與 ATM 銀行資訊） */
export async function getPaymentSettings(): Promise<{
  linePayApi: string | null;
  thirdPartyApi: string | null;
  atmBankName: string | null;
  atmBankCode: string | null;
  atmBankAccount: string | null;
  paymentNewebpayEnabled: boolean;
  paymentEcpayEnabled: boolean;
  paymentLinepayEnabled: boolean;
  paymentAtmEnabled: boolean;
}> {
  const s = await getFrontendSettings();
  return {
    linePayApi: s.linePayApi ?? null,
    thirdPartyApi: s.thirdPartyApi ?? null,
    atmBankName: s.atmBankName ?? null,
    atmBankCode: s.atmBankCode ?? null,
    atmBankAccount: s.atmBankAccount ?? null,
    paymentNewebpayEnabled: s.paymentNewebpayEnabled ?? false,
    paymentEcpayEnabled: s.paymentEcpayEnabled ?? false,
    paymentLinepayEnabled: s.paymentLinepayEnabled ?? false,
    paymentAtmEnabled: s.paymentAtmEnabled ?? false,
  };
}

/** 金流設定頁：更新各金流開關與 ATM 銀行資訊（不讓用戶填 API，僅開關；ATM 開啟時填銀行資訊） */
export async function updatePaymentSettings(formData: FormData): Promise<
  { success: true; message?: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const existing = await getFrontendSettings();
    const paymentNewebpayEnabled = formData.get("payment_newebpay_enabled") === "1";
    const paymentEcpayEnabled = formData.get("payment_ecpay_enabled") === "1";
    const paymentLinepayEnabled = formData.get("payment_linepay_enabled") === "1";
    const paymentAtmEnabled = formData.get("payment_atm_enabled") === "1";
    const atmBankName = (formData.get("atm_bank_name") as string)?.trim() || null;
    const atmBankCode = (formData.get("atm_bank_code") as string)?.trim() || null;
    const atmBankAccount = (formData.get("atm_bank_account") as string)?.trim() || null;
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("store_settings")
      .upsert(
        {
          merchant_id: merchantId,
          frontend_settings: {
            heroImageUrl: existing.heroImageUrl,
            heroTitle: existing.heroTitle,
            carouselItems: existing.carouselItems,
            navAboutLabel: existing.navAboutLabel,
            navCoursesLabel: existing.navCoursesLabel,
            navBookingLabel: existing.navBookingLabel,
            navFaqLabel: existing.navFaqLabel,
            memberIconGallery: existing.memberIconGallery,
            memberIconSelectedIndex: existing.memberIconSelectedIndex,
            aboutContent: existing.aboutContent ?? null,
            seoTitle: existing.seoTitle ?? null,
            seoKeywords: existing.seoKeywords ?? null,
            seoDescription: existing.seoDescription ?? null,
            linePayApi: existing.linePayApi ?? null,
            thirdPartyApi: existing.thirdPartyApi ?? null,
            atmBankName: paymentAtmEnabled ? atmBankName : (existing.atmBankName ?? null),
            atmBankCode: paymentAtmEnabled ? atmBankCode : (existing.atmBankCode ?? null),
            atmBankAccount: paymentAtmEnabled ? atmBankAccount : (existing.atmBankAccount ?? null),
            paymentNewebpayEnabled,
            paymentEcpayEnabled,
            paymentLinepayEnabled,
            paymentAtmEnabled,
            layout_order: existing.layoutOrder,
            fullWidthImageUrl: existing.fullWidthImageUrl ?? null,
            layout_blocks: existing.layoutBlocks.map((b) => ({ id: b.id, order: b.order, heightPx: b.heightPx, backgroundImageUrl: b.backgroundImageUrl })),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      );
    if (error) return { success: false, error: error.message };
    return { success: true, message: "金流設定已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}
