"use server";

/**
 * 前台／首頁畫布讀寫：一律以 **`NEXT_PUBLIC_CLIENT_ID`** 對應 `store_settings` 列（**分站**）。
 * 總站 model 的整包設定在 `merchant_id = "model"`；從總站複製範本至分站時，合入本分站 id 之 `frontend_settings`，勿直接改寫總站列（見 `MARKETPLACE_MERCHANT_ID`）。
 */

import { unstable_noStore } from "next/cache";
import { uploadOneToR2, uploadOneToR2WithPrefix } from "@/app/actions/productActions";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import {
  type CarouselItem,
  type FeaturedCategory,
  type FrontendSettings,
  type LayoutBlock,
  DEFAULT_MEMBER_ICON_URLS,
  DEFAULT_CAROUSEL,
  DEFAULT_FEATURED_CATEGORIES,
  DEFAULT_HERO_TITLE,
  DEFAULT_NAV,
  DEFAULT_LAYOUT_ORDER,
  DEFAULT_ABOUT_PAGE_URL,
  LAYOUT_SECTION_LABELS,
  getDefaultLayoutBlocks,
  normalizeAboutPageUrl,
  parseHeroFloatingIcons,
  parsePageBackgroundExtensionColor,
  persistFrontendSettingsBase,
  serializeLayoutBlockForPersist,
} from "@/app/lib/frontendSettingsShared";
import { parseAgreementDocumentsFromRaw, parseAgreementLabelsFromRaw } from "@/lib/agreementDocuments";

function persistLayoutBlocks(blocks: LayoutBlock[]): Record<string, unknown>[] {
  return blocks.map((b) => serializeLayoutBlockForPersist(b));
}

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function normalizeUploadedAssetUrl(url: string | null | undefined, uploadKeyHint: string): string | null {
  const u = typeof url === "string" ? url.trim() : "";
  if (!u) return null;
  if (!u.toLowerCase().includes(uploadKeyHint.toLowerCase())) return null;
  return u;
}

function normalizeHomeCarouselMidStripUrl(url: string | null | undefined): string | null {
  return (
    normalizeUploadedAssetUrl(url, "home_carousel_mid_strip") ??
    normalizeUploadedAssetUrl(url, "home_carousel_section_bg") ??
    normalizeUploadedAssetUrl(url, "home_mid_section_bg")
  );
}

function parseFeaturedCategories(raw: unknown): FeaturedCategory[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_FEATURED_CATEGORIES;
  const list: FeaturedCategory[] = [];
  for (let i = 0; i < raw.length; i++) {
    const o = (raw[i] as Record<string, unknown>) ?? {};
    if (typeof o.id !== "string" || typeof o.name !== "string") continue;
    const link = typeof o.link === "string" ? o.link : `/courses?category=${encodeURIComponent(String(o.name))}`;
    const enabled = o.enabled === false ? false : true;
    const order = typeof o.order === "number" ? o.order : i;
    list.push({
      id: o.id,
      name: o.name,
      link,
      imageUrl: normalizeUploadedAssetUrl(o.imageUrl != null ? String(o.imageUrl) : null, "category_image"),
      hoverImageUrl: normalizeUploadedAssetUrl(
        o.hoverImageUrl != null ? String(o.hoverImageUrl) : null,
        "category_hover_image"
      ),
      enabled,
      order,
    });
  }
  list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return list.length > 0 ? list : DEFAULT_FEATURED_CATEGORIES;
}

function parseLayoutBlocks(raw: unknown): LayoutBlock[] {
  if (raw === undefined || raw === null) return getDefaultLayoutBlocks();
  if (!Array.isArray(raw)) return getDefaultLayoutBlocks();
  if (raw.length === 0) return [];
  const blocks: LayoutBlock[] = [];
  for (let i = 0; i < raw.length; i++) {
    const o = raw[i] as Record<string, unknown> | null;
    if (!o || typeof o.id !== "string") continue;
    const order = typeof o.order === "number" ? o.order : i;
    const heightPx = typeof o.heightPx === "number" && o.heightPx > 0 ? o.heightPx : null;
    const backgroundImageUrl = typeof o.backgroundImageUrl === "string" ? o.backgroundImageUrl : null;
    const enabled = o.enabled === false ? false : true;
    const title = o.title != null && typeof o.title === "string" ? o.title : (LAYOUT_SECTION_LABELS[o.id] ?? null);
    const floatingIcons = parseHeroFloatingIcons(o.floatingIcons);
    blocks.push({
      id: o.id,
      order,
      heightPx,
      backgroundImageUrl,
      enabled,
      title,
      floatingIcons: floatingIcons.length > 0 ? floatingIcons : undefined,
    });
  }
  blocks.sort((a, b) => a.order - b.order);
  return blocks;
}

function applyLegacyHeroFloatingIconsToBlocks(
  blocks: LayoutBlock[],
  raw: Record<string, unknown>
): LayoutBlock[] {
  const legacy = parseHeroFloatingIcons(raw.heroFloatingIcons);
  if (legacy.length === 0) return blocks;
  return blocks.map((b) => {
    if (b.id !== "hero") return b;
    if ((b.floatingIcons?.length ?? 0) > 0) return b;
    return { ...b, floatingIcons: legacy };
  });
}

function defaultFrontendSettingsWhenMissing(): FrontendSettings {
  return {
    heroImageUrl: null,
    heroBackgroundUrl: null,
    heroBackgroundMobileUrl: null,
    heroTitle: DEFAULT_HERO_TITLE,
    carouselItems: DEFAULT_CAROUSEL,
    navAboutLabel: DEFAULT_NAV.about,
    aboutPageUrl: DEFAULT_ABOUT_PAGE_URL,
    navCoursesLabel: DEFAULT_NAV.courses,
    navBookingLabel: DEFAULT_NAV.booking,
    navFaqLabel: DEFAULT_NAV.faq,
    memberIconGallery: DEFAULT_MEMBER_ICON_URLS,
    memberIconSelectedIndex: 0,
    aboutContent: null,
    agreementContent: null,
    agreementDocumentsBySlug: {},
    agreementDocumentLabelsBySlug: {},
    precautionsFixedHtml: null,
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
    featuredCategories: DEFAULT_FEATURED_CATEGORIES,
    featuredSectionIconUrl: null,
    homeHotCoursesIconUrl: null,
    homeNewCoursesIconUrl: null,
    logoUrl: null,
    headerBackgroundUrl: null,
    headerBackgroundMobileUrl: null,
    pageBackgroundUrl: null,
    pageBackgroundMobileUrl: null,
    pageBackgroundExtensionColor: null,
    showProductMenu: false,
    footerAreaA: null,
    footerAreaB: null,
    footerAreaC: null,
    footerAreaD: null,
    footerBackgroundUrl: null,
    footerBackgroundMobileUrl: null,
    homeFeaturedTopBackgroundUrl: null,
    homeFeaturedTopBackgroundMobileUrl: null,
    homeFeaturedGridBackgroundUrl: null,
    homeMidBannerImageUrl: null,
    homeMidBannerLinkUrl: null,
    homeMidBannerSectionBackgroundUrl: null,
    homeCoursesBlockBackgroundUrl: null,
    homeCoursesBlockBackgroundMobileUrl: null,
    homeCarouselSectionBackgroundUrl: null,
    homeCarouselMidStripBackgroundUrl: null,
    entryPopupEnabled: false,
    entryPopupImageUrl: null,
    entryPopupLinkUrl: null,
  };
}

async function readFrontendSettingsUncached(): Promise<FrontendSettings> {
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
      return defaultFrontendSettingsWhenMissing();
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
            linkUrl: o.linkUrl != null ? String(o.linkUrl) : null,
            buttonText: o.buttonText != null ? String(o.buttonText) : null,
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
      heroImageUrl: normalizeUploadedAssetUrl(
        raw.heroImageUrl != null ? String(raw.heroImageUrl) : null,
        "hero_image"
      ),
      heroBackgroundUrl: normalizeUploadedAssetUrl(
        raw.heroBackgroundUrl != null ? String(raw.heroBackgroundUrl) : null,
        "hero_background"
      ),
      heroBackgroundMobileUrl: normalizeUploadedAssetUrl(
        raw.heroBackgroundMobileUrl != null ? String(raw.heroBackgroundMobileUrl) : null,
        "hero_background_mobile"
      ),
      heroTitle: raw.heroTitle != null ? String(raw.heroTitle) : DEFAULT_HERO_TITLE,
      carouselItems: items.length > 0 ? items : DEFAULT_CAROUSEL,
      navAboutLabel: typeof raw.navAboutLabel === "string" && raw.navAboutLabel.trim() ? raw.navAboutLabel.trim() : DEFAULT_NAV.about,
      aboutPageUrl: normalizeAboutPageUrl(raw.aboutPageUrl),
      navCoursesLabel: typeof raw.navCoursesLabel === "string" && raw.navCoursesLabel.trim() ? raw.navCoursesLabel.trim() : DEFAULT_NAV.courses,
      navBookingLabel: typeof raw.navBookingLabel === "string" && raw.navBookingLabel.trim() ? raw.navBookingLabel.trim() : DEFAULT_NAV.booking,
      navFaqLabel: typeof raw.navFaqLabel === "string" && raw.navFaqLabel.trim() ? raw.navFaqLabel.trim() : DEFAULT_NAV.faq,
      memberIconGallery: gallery,
      memberIconSelectedIndex: gallery.length > 0 ? selectedIndex : 0,
      aboutContent: typeof raw.aboutContent === "string" ? raw.aboutContent : null,
      agreementContent: typeof raw.agreementContent === "string" ? raw.agreementContent : null,
      agreementDocumentsBySlug: parseAgreementDocumentsFromRaw(raw),
      agreementDocumentLabelsBySlug: parseAgreementLabelsFromRaw(raw),
      precautionsFixedHtml: (() => {
        const camel = raw.precautionsFixedHtml;
        const snake = raw.precautions_fixed_html;
        if (typeof camel === "string") return camel;
        if (typeof snake === "string") return snake;
        return null;
      })(),
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
      layoutBlocks: applyLegacyHeroFloatingIconsToBlocks(parseLayoutBlocks(raw.layout_blocks), raw),
      featuredCategories: parseFeaturedCategories(raw.featured_categories),
      featuredSectionIconUrl: normalizeUploadedAssetUrl(
        typeof raw.featuredSectionIconUrl === "string" ? raw.featuredSectionIconUrl : null,
        "featured_icon"
      ),
      homeHotCoursesIconUrl: normalizeUploadedAssetUrl(
        typeof raw.homeHotCoursesIconUrl === "string" ? raw.homeHotCoursesIconUrl : null,
        "home_hot_courses_icon"
      ),
      homeNewCoursesIconUrl: normalizeUploadedAssetUrl(
        typeof raw.homeNewCoursesIconUrl === "string" ? raw.homeNewCoursesIconUrl : null,
        "home_new_courses_icon"
      ),
      logoUrl: normalizeUploadedAssetUrl(typeof raw.logoUrl === "string" ? raw.logoUrl : null, "logo"),
      headerBackgroundUrl: typeof raw.headerBackgroundUrl === "string" ? raw.headerBackgroundUrl : null,
      headerBackgroundMobileUrl:
        typeof raw.headerBackgroundMobileUrl === "string" && raw.headerBackgroundMobileUrl.trim()
          ? raw.headerBackgroundMobileUrl.trim()
          : null,
      pageBackgroundUrl: normalizeUploadedAssetUrl(
        typeof raw.pageBackgroundUrl === "string" ? raw.pageBackgroundUrl : null,
        "page_background"
      ),
      pageBackgroundMobileUrl: normalizeUploadedAssetUrl(
        typeof raw.pageBackgroundMobileUrl === "string" ? raw.pageBackgroundMobileUrl : null,
        "page_background_mobile"
      ),
      pageBackgroundExtensionColor: (() => {
        const camel = raw.pageBackgroundExtensionColor;
        const snake = raw.page_background_extension_color;
        const s = typeof camel === "string" ? camel : typeof snake === "string" ? snake : null;
        return parsePageBackgroundExtensionColor(s);
      })(),
      showProductMenu: raw.showProductMenu === true,
      footerAreaA: typeof raw.footerAreaA === "string" ? raw.footerAreaA : null,
      footerAreaB: typeof raw.footerAreaB === "string" ? raw.footerAreaB : null,
      footerAreaC: typeof raw.footerAreaC === "string" ? raw.footerAreaC : null,
      footerAreaD: typeof raw.footerAreaD === "string" ? raw.footerAreaD : null,
      footerBackgroundUrl: normalizeUploadedAssetUrl(
        typeof raw.footerBackgroundUrl === "string" ? raw.footerBackgroundUrl : null,
        "footer_background"
      ),
      footerBackgroundMobileUrl: normalizeUploadedAssetUrl(
        typeof raw.footerBackgroundMobileUrl === "string" ? raw.footerBackgroundMobileUrl : null,
        "footer_background_mobile"
      ),
      homeFeaturedTopBackgroundUrl: normalizeUploadedAssetUrl(
        typeof raw.homeFeaturedTopBackgroundUrl === "string" ? raw.homeFeaturedTopBackgroundUrl : null,
        "home_featured_top_bg"
      ),
      homeFeaturedTopBackgroundMobileUrl: normalizeUploadedAssetUrl(
        typeof raw.homeFeaturedTopBackgroundMobileUrl === "string" ? raw.homeFeaturedTopBackgroundMobileUrl : null,
        "home_featured_top_bg_mobile"
      ),
      homeFeaturedGridBackgroundUrl: normalizeUploadedAssetUrl(
        typeof raw.homeFeaturedGridBackgroundUrl === "string" ? raw.homeFeaturedGridBackgroundUrl : null,
        "home_featured_grid_bg"
      ),
      homeMidBannerImageUrl: normalizeUploadedAssetUrl(
        typeof raw.homeMidBannerImageUrl === "string" ? raw.homeMidBannerImageUrl : null,
        "home_mid_banner"
      ),
      homeMidBannerLinkUrl:
        typeof raw.homeMidBannerLinkUrl === "string" && raw.homeMidBannerLinkUrl.trim()
          ? String(raw.homeMidBannerLinkUrl).trim()
          : null,
      homeMidBannerSectionBackgroundUrl: normalizeUploadedAssetUrl(
        typeof raw.homeMidBannerSectionBackgroundUrl === "string" ? raw.homeMidBannerSectionBackgroundUrl : null,
        "home_mid_section_bg"
      ),
      homeCoursesBlockBackgroundUrl: normalizeUploadedAssetUrl(
        typeof raw.homeCoursesBlockBackgroundUrl === "string" ? raw.homeCoursesBlockBackgroundUrl : null,
        "home_courses_block_bg"
      ),
      homeCoursesBlockBackgroundMobileUrl: normalizeUploadedAssetUrl(
        typeof raw.homeCoursesBlockBackgroundMobileUrl === "string" ? raw.homeCoursesBlockBackgroundMobileUrl : null,
        "home_courses_block_bg_mobile"
      ),
      homeCarouselSectionBackgroundUrl: normalizeUploadedAssetUrl(
        typeof raw.homeCarouselSectionBackgroundUrl === "string" ? raw.homeCarouselSectionBackgroundUrl : null,
        "home_carousel_section_bg"
      ),
      homeCarouselMidStripBackgroundUrl: normalizeHomeCarouselMidStripUrl(
        typeof raw.homeCarouselMidStripBackgroundUrl === "string" ? raw.homeCarouselMidStripBackgroundUrl : null
      ),
      entryPopupEnabled: raw.entryPopupEnabled === true,
      entryPopupImageUrl:
        typeof raw.entryPopupImageUrl === "string" && raw.entryPopupImageUrl.trim()
          ? raw.entryPopupImageUrl.trim()
          : null,
      entryPopupLinkUrl:
        typeof raw.entryPopupLinkUrl === "string" && raw.entryPopupLinkUrl.trim()
          ? raw.entryPopupLinkUrl.trim()
          : null,
    };
  } catch {
    return defaultFrontendSettingsWhenMissing();
  }
}

/**
 * 取得本分站前台設定（首頁大圖、輪播、`layout_blocks` 畫布等）。
 * 查詢 `store_settings.merchant_id === NEXT_PUBLIC_CLIENT_ID`，非總站 `"model"`。
 */
export async function getFrontendSettings(): Promise<FrontendSettings> {
  unstable_noStore();
  return readFrontendSettingsUncached();
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
    const merged: FrontendSettings = { ...existing, layoutBlocks: sorted };
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const frontendSettings: Record<string, unknown> = {
      ...persistFrontendSettingsBase(merged),
      layout_order,
      layout_blocks: persistLayoutBlocks(sorted),
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

/** 上傳首頁／區塊裝飾小圖至 R2（與 model 畫布一致，key：`float_image`） */
export async function uploadHeroFloatingIcon(formData: FormData): Promise<
  { success: true; url: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const url = await uploadOneToR2WithPrefix(formData, "float_image", "hero-float");
    if (!url) return { success: false, error: "未選擇圖片或檔案無效" };
    return { success: true, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上傳失敗";
    return { success: false, error: msg };
  }
}

/** 上傳首頁「單張大圖」至 R2（key：`full_width_image`，路徑：`home-full-width`） */
export async function uploadFullWidthImage(formData: FormData): Promise<
  { success: true; url: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const url = await uploadOneToR2WithPrefix(formData, "full_width_image", "home-full-width");
    if (!url) return { success: false, error: "未選擇圖片或檔案無效" };
    return { success: true, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上傳失敗";
    return { success: false, error: msg };
  }
}

/** 關於我們富文本：內嵌圖片上傳至 R2（key：`about_content_image`，路徑：`pages/about`） */
export async function uploadAboutPageContentImage(formData: FormData): Promise<
  { success: true; url: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const url = await uploadOneToR2WithPrefix(formData, "about_content_image", "pages/about");
    if (!url) {
      return {
        success: false,
        error: "請選擇有效的圖片檔案（JPEG／PNG／GIF／WebP，10MB 以下）",
      };
    }
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
    const layoutBlocksOrdered = uniqueOrder.map((id, i) => {
      const b = existing.layoutBlocks.find((x) => x.id === id);
      return b
        ? { ...b, order: i }
        : {
            id,
            order: i,
            heightPx: null,
            backgroundImageUrl: null,
            enabled: true,
            title: LAYOUT_SECTION_LABELS[id] ?? null,
          };
    });
    const merged: FrontendSettings = { ...existing, layoutOrder: uniqueOrder, layoutBlocks: layoutBlocksOrdered };
    const frontendSettings: Record<string, unknown> = {
      ...persistFrontendSettingsBase(merged),
      layout_order: uniqueOrder,
      layout_blocks: layoutBlocksOrdered.map((b) => serializeLayoutBlockForPersist(b)),
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
    const merged: FrontendSettings = { ...existing, fullWidthImageUrl: value };
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const frontendSettings: Record<string, unknown> = {
      ...persistFrontendSettingsBase(merged),
      fullWidthImageUrl: value,
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

/** 上傳首頁主圖（key：`hero_image`，路徑：`home-hero`） */
export async function uploadHeroLayoutImage(formData: FormData): Promise<
  { success: true; url: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const url = await uploadOneToR2WithPrefix(formData, "hero_image", "home-hero");
    if (!url) return { success: false, error: "未選擇圖片或檔案無效" };
    return { success: true, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上傳失敗";
    return { success: false, error: msg };
  }
}

/** 上傳 LOGO（key：`store_logo`，路徑含 `logo` 以利讀取驗證） */
export async function uploadLogoLayoutImage(formData: FormData): Promise<
  { success: true; url: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const url = await uploadOneToR2WithPrefix(formData, "store_logo", "store-logo");
    if (!url) return { success: false, error: "未選擇圖片或檔案無效" };
    return { success: true, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上傳失敗";
    return { success: false, error: msg };
  }
}

/** 上傳頁首背景（桌機） */
export async function uploadHeaderBackgroundDesktop(formData: FormData): Promise<
  { success: true; url: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const url = await uploadOneToR2WithPrefix(formData, "header_background", "header-bg");
    if (!url) return { success: false, error: "未選擇圖片或檔案無效" };
    return { success: true, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上傳失敗";
    return { success: false, error: msg };
  }
}

/** 上傳頁首背景（手機） */
export async function uploadHeaderBackgroundMobile(formData: FormData): Promise<
  { success: true; url: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const url = await uploadOneToR2WithPrefix(formData, "header_background_mobile", "header-bg-mobile");
    if (!url) return { success: false, error: "未選擇圖片或檔案無效" };
    return { success: true, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上傳失敗";
    return { success: false, error: msg };
  }
}

/**
 * 上傳輪播單張圖。FormData 須含檔案欄位 `carousel_slide_image`、文字欄位 `carousel_upload_index`（0-based）。
 */
export async function uploadCarouselSlideImage(formData: FormData): Promise<
  { success: true; url: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const rawIdx = formData.get("carousel_upload_index");
    const index = Math.min(19, Math.max(0, parseInt(String(rawIdx ?? "0"), 10) || 0));
    const url = await uploadOneToR2WithPrefix(formData, "carousel_slide_image", `home-carousel-${index}`);
    if (!url) return { success: false, error: "未選擇圖片或檔案無效" };
    return { success: true, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上傳失敗";
    return { success: false, error: msg };
  }
}

export async function updateHeroImageUrl(url: string | null): Promise<
  { success: true; message?: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const existing = await getFrontendSettings();
    const value = typeof url === "string" && url.trim() ? url.trim() : null;
    const merged: FrontendSettings = { ...existing, heroImageUrl: value };
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const frontendSettings: Record<string, unknown> = {
      ...persistFrontendSettingsBase(merged),
      heroImageUrl: value,
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
    return { success: true, message: "首頁主圖已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}

export async function updateLogoUrl(url: string | null): Promise<
  { success: true; message?: string } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const existing = await getFrontendSettings();
    const value = typeof url === "string" && url.trim() ? url.trim() : null;
    const merged: FrontendSettings = { ...existing, logoUrl: value };
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const frontendSettings: Record<string, unknown> = {
      ...persistFrontendSettingsBase(merged),
      logoUrl: value,
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
    return { success: true, message: "LOGO 已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}

export async function updateHeaderBackgroundUrls(
  desktop: string | null,
  mobile: string | null
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const existing = await getFrontendSettings();
    const desk = typeof desktop === "string" && desktop.trim() ? desktop.trim() : null;
    const mob = typeof mobile === "string" && mobile.trim() ? mobile.trim() : null;
    const merged: FrontendSettings = {
      ...existing,
      headerBackgroundUrl: desk,
      headerBackgroundMobileUrl: mob,
    };
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const frontendSettings: Record<string, unknown> = {
      ...persistFrontendSettingsBase(merged),
      headerBackgroundUrl: desk,
      headerBackgroundMobileUrl: mob,
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
    return { success: true, message: "頁首背景已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}

export async function updateCarouselItemsPersist(
  items: CarouselItem[]
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const existing = await getFrontendSettings();
    const max = 20;
    const normalized: CarouselItem[] = items.slice(0, max).map((x, i) => {
      const prev = existing.carouselItems[i];
      const id = typeof x.id === "string" && x.id.trim() ? x.id.trim() : prev?.id ?? `w${i + 1}`;
      const title = typeof x.title === "string" ? x.title : "";
      const subtitle = typeof x.subtitle === "string" ? x.subtitle : "";
      const imageUrl =
        x.imageUrl != null && String(x.imageUrl).trim() ? String(x.imageUrl).trim() : null;
      const visible = x.visible === false ? false : true;
      const linkUrl =
        x.linkUrl != null && String(x.linkUrl).trim() ? String(x.linkUrl).trim() : prev?.linkUrl ?? null;
      const buttonText =
        x.buttonText != null && String(x.buttonText).trim()
          ? String(x.buttonText).trim()
          : prev?.buttonText ?? null;
      return { id, title, subtitle, imageUrl, visible, linkUrl, buttonText };
    });
    const merged: FrontendSettings = { ...existing, carouselItems: normalized };
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const frontendSettings: Record<string, unknown> = {
      ...persistFrontendSettingsBase(merged),
      carouselItems: normalized,
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
    return { success: true, message: "輪播圖已儲存" };
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
            layout_blocks: persistLayoutBlocks(existing.layoutBlocks),
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
            layout_blocks: persistLayoutBlocks(existing.layoutBlocks),
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

/** 基本資料頁：僅更新導覽列文字與會員圖示（其餘 `frontend_settings` 欄位沿用現值） */
export async function updateNavMemberFrontendSettings(payload: {
  navCoursesLabel: string;
  navBookingLabel: string;
  navFaqLabel: string;
  memberIconGallery: string[];
  memberIconSelectedIndex: number;
}): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const existing = await getFrontendSettings();
    const navCoursesLabel = (payload.navCoursesLabel ?? "").trim() || DEFAULT_NAV.courses;
    const navBookingLabel = (payload.navBookingLabel ?? "").trim() || DEFAULT_NAV.booking;
    const navFaqLabel = (payload.navFaqLabel ?? "").trim() || DEFAULT_NAV.faq;
    let memberIconGallery =
      Array.isArray(payload.memberIconGallery) && payload.memberIconGallery.length > 0
        ? payload.memberIconGallery.filter((u): u is string => typeof u === "string")
        : DEFAULT_MEMBER_ICON_URLS;
    if (memberIconGallery.length === 0) memberIconGallery = [...DEFAULT_MEMBER_ICON_URLS];
    const memberIconSelectedIndex = Math.min(
      Math.max(0, payload.memberIconSelectedIndex ?? 0),
      Math.max(0, memberIconGallery.length - 1)
    );
    const merged: FrontendSettings = {
      ...existing,
      navCoursesLabel,
      navBookingLabel,
      navFaqLabel,
      memberIconGallery,
      memberIconSelectedIndex,
    };
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("store_settings")
      .upsert(
        {
          merchant_id: merchantId,
          frontend_settings: persistFrontendSettingsBase(merged),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      );
    if (error) return { success: false, error: error.message };
    return { success: true, message: "導覽列與會員圖示已儲存" };
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
            layout_blocks: persistLayoutBlocks(existing.layoutBlocks),
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

/** 金流／發票：供後台金流設定頁與結帳頁使用（開關、ATM、發票開立廠商） */
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
  invoiceProvider: "ecpay" | "ezpay";
}> {
  const { getStoreSettings } = await import("@/app/actions/storeSettingsActions");
  const s = await getFrontendSettings();
  const store = await getStoreSettings();
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
    invoiceProvider: store.invoiceProvider === "ezpay" ? "ezpay" : "ecpay",
  };
}

/** 金流／發票設定頁：更新各金流開關、ATM、發票開立廠商（後台已移除發票品項編輯，儲存時清空 `invoice_items` 以使用預設「課程預約」單筆） */
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
    const invoiceProviderRaw = (formData.get("invoice_provider") as string)?.trim().toLowerCase();
    const invoiceProvider = invoiceProviderRaw === "ezpay" ? "ezpay" : "ecpay";
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
            layout_blocks: persistLayoutBlocks(existing.layoutBlocks),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "merchant_id" }
      );
    if (error) return { success: false, error: error.message };
    const { error: invError } = await supabase
      .from("store_settings")
      .update({
        invoice_provider: invoiceProvider,
        invoice_items: null,
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_id", merchantId);
    if (invError) return { success: false, error: invError.message };
    return { success: true, message: "金流／發票設定已儲存" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "儲存失敗";
    return { success: false, error: msg };
  }
}
