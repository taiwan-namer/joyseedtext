/** 前台設定共用型別與常數（供 actions 與 client 使用，不可放在 "use server" 檔案） */

/**
 * 首頁版面編輯畫布、裝飾圖顯示／拖曳縮放共用之「設計欄寬」(px)。
 * 須與前台主內容 `max-w-7xl`（80rem＝1280px）一致，否則後台座標與前台會偏移。
 */
export const LAYOUT_DESIGN_CANVAS_WIDTH_PX = 1280 as const;

/**
 * 全頁裝飾橫向：儲存之 leftPct／leftPctMobile 為「相對置中內容欄（寬 min(host, {@link LAYOUT_DESIGN_CANVAS_WIDTH_PX})）」之百分比（欄左為 0；可小於 0 或超過 100 表示在左右留白）。
 * 繪製時若 host 為整頁寬，須轉成 host 上之錨點百分比。
 */
export function floatingIconColumnLeftPctToHostLeftPct(
  leftPctColumn: number,
  hostWidthPx: number,
  columnMaxPx: number = LAYOUT_DESIGN_CANVAS_WIDTH_PX
): number {
  const w = Math.max(1, hostWidthPx);
  const c = Math.min(w, columnMaxPx);
  const o = (w - c) / 2;
  return ((o + (leftPctColumn / 100) * c) / w) * 100;
}

/** 由 host 內水平像素（錨點）反算欄百分比，與 {@link floatingIconColumnLeftPctToHostLeftPct} 互逆（數值可超出 0–100）。 */
export function floatingIconHostXToColumnLeftPct(
  xFromHostLeftPx: number,
  hostWidthPx: number,
  columnMaxPx: number = LAYOUT_DESIGN_CANVAS_WIDTH_PX
): number {
  const w = Math.max(1, hostWidthPx);
  const c = Math.min(w, columnMaxPx);
  const o = (w - c) / 2;
  return ((xFromHostLeftPx - o) / c) * 100;
}

/**
 * 後台桌機畫布模擬之**瀏覽器視窗寬**（px）：須大於主內容欄寬，預覽才會出現與前台寬螢幕相同的左右留白。
 */
export const LAYOUT_ADMIN_PREVIEW_VIEWPORT_WIDTH_PX = 1920 as const;

/**
 * 後台「全頁裝飾」說明用參考高度（px，常見 1920×1080）；實際座標為相對整頁根容器高度之百分比。
 */
export const LAYOUT_VIEWPORT_REFERENCE_HEIGHT_PX = 1080 as const;

export type CarouselItem = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  /** 是否顯示於前台輪播，預設 true */
  visible?: boolean;
  /** 輪播圖點擊連結 */
  linkUrl?: string | null;
  /** 輪播圖上按鈕文字（若有 linkUrl） */
  buttonText?: string | null;
};

const PAGE_BG_EXTENSION_HEX_RE =
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** 內文底圖延伸色：僅接受 #RGB / #RGBA / #RRGGBB / #RRGGBBAA；無效則 null */
export function parsePageBackgroundExtensionColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return PAGE_BG_EXTENSION_HEX_RE.test(t) ? t : null;
}

/** 首頁各區塊裝飾圖：座標為區塊內百分比，錨點為圖片中心 */
export type HeroFloatingIcon = {
  id: string;
  imageUrl: string;
  /** 相對容器寬度之水平百分比（中心錨點）；全頁裝飾時見 {@link floatingIconColumnLeftPctToHostLeftPct} */
  leftPct: number;
  /** 0–100，相對 Hero 容器高度 */
  topPct: number;
  /** 顯示寬度（px） */
  widthPx: number;
  /** 顯示高度（px）；省略時與 widthPx 相同（正方形框，舊資料相容） */
  heightPx?: number;
  /** 手機（max-md）專用；未設定時前台窄螢幕沿用 leftPct／topPct／widthPx／heightPx */
  leftPctMobile?: number | null;
  topPctMobile?: number | null;
  widthPxMobile?: number | null;
  heightPxMobile?: number | null;
  zIndex?: number;
  enabled?: boolean;
};

/** 後台／前台：依桌機或手機讀取有效座標與尺寸（手機欄位未填則沿用桌機） */
export function effectiveFloatingCoords(
  icon: HeroFloatingIcon,
  mode: "desktop" | "mobile"
): { leftPct: number; topPct: number; widthPx: number; heightPx: number } {
  if (mode === "mobile") {
    const w = icon.widthPxMobile ?? icon.widthPx;
    const hRaw = icon.heightPxMobile ?? icon.heightPx ?? icon.widthPx;
    return {
      leftPct: icon.leftPctMobile ?? icon.leftPct,
      topPct: icon.topPctMobile ?? icon.topPct,
      widthPx: Number.isFinite(w) && w >= 16 ? w : 64,
      heightPx: Number.isFinite(hRaw) && hRaw >= 16 ? hRaw : w,
    };
  }
  return {
    leftPct: icon.leftPct,
    topPct: icon.topPct,
    widthPx: icon.widthPx,
    heightPx: icon.heightPx ?? icon.widthPx,
  };
}

/** 裝飾圖外框高度：有 heightPx 用原比例，否則沿用寬度（正方形） */
export function floatingIconDisplayHeight(ic: HeroFloatingIcon): number {
  return ic.heightPx ?? ic.widthPx;
}

/** 後台列表／畫布標示：與陣列順序對齊（1-based），溝通時可說「編號 N」 */
export function formatFloatingIconSlotLabel(zeroBasedIndex: number): string {
  return `編號 ${zeroBasedIndex + 1}`;
}

export function serializeFloatingIconsForPersist(icons: HeroFloatingIcon[] | undefined) {
  return (icons ?? []).map((ic) => ({
    id: ic.id,
    imageUrl: ic.imageUrl,
    leftPct: ic.leftPct,
    topPct: ic.topPct,
    widthPx: ic.widthPx,
    ...(typeof ic.heightPx === "number" && ic.heightPx >= 16 ? { heightPx: ic.heightPx } : {}),
    ...(typeof ic.leftPctMobile === "number" && Number.isFinite(ic.leftPctMobile)
      ? { leftPctMobile: Math.min(100, Math.max(0, ic.leftPctMobile)) }
      : {}),
    ...(typeof ic.topPctMobile === "number" && Number.isFinite(ic.topPctMobile)
      ? { topPctMobile: Math.min(100, Math.max(0, ic.topPctMobile)) }
      : {}),
    ...(typeof ic.widthPxMobile === "number" && ic.widthPxMobile >= 16 ? { widthPxMobile: Math.round(ic.widthPxMobile) } : {}),
    ...(typeof ic.heightPxMobile === "number" && ic.heightPxMobile >= 16 ? { heightPxMobile: Math.round(ic.heightPxMobile) } : {}),
    zIndex: ic.zIndex ?? 0,
    enabled: ic.enabled !== false,
  }));
}

export type FrontendSettings = {
  heroImageUrl: string | null;
  /** 首頁主圖背景圖（可選，用於鋪滿 Hero 區塊底層） */
  heroBackgroundUrl?: string | null;
  /** Hero 主圖背景圖：手機專用（可選；未設定則與桌機共用 heroBackgroundUrl；檔名含 `hero_background_mobile`） */
  heroBackgroundMobileUrl?: string | null;
  heroTitle: string | null;
  carouselItems: CarouselItem[];
  navAboutLabel: string;
  /** 頁尾等「關於」連結目標：站內路徑（如 /about）或 http(s) 外部網址 */
  aboutPageUrl: string;
  navCoursesLabel: string;
  navBookingLabel: string;
  navFaqLabel: string;
  memberIconGallery: string[];
  memberIconSelectedIndex: number;
  /** 關於我們區塊的富文本內容（HTML） */
  aboutContent: string | null;
  /** 同意書內容（頁尾多個連結共用內容頁；舊版單一欄位，新制請用 agreementDocumentsBySlug） */
  agreementContent?: string | null;
  /** 各同意書分頁 HTML，key 為 lib/agreementDocuments 內 slug */
  agreementDocumentsBySlug?: Record<string, string> | null;
  /** 各同意書在列表／前台顯示的標題（key 為 slug）；未設定時顯示 slug */
  agreementDocumentLabelsBySlug?: Record<string, string> | null;
  /**
   * 課程頁「全站固定」注意事項（HTML）：所有課程詳情／課程全文頁在客戶須知下方額外顯示同一區塊。
   * 與單一課程的「注意事項」欄位不同；此為站方統一取消／更改辦法等固定文案。
   */
  precautionsFixedHtml?: string | null;
  /** SEO：網頁標題（&lt;title&gt;） */
  seoTitle: string | null;
  /** SEO：關鍵字（逗號分隔） */
  seoKeywords: string | null;
  /** SEO：網頁描述（&lt;meta description&gt;） */
  seoDescription: string | null;
  /** SEO：分頁圖示（Favicon）網址，顯示於瀏覽器分頁左側 */
  seoFaviconUrl: string | null;
  /** 金流：Line Pay API（金鑰或設定） */
  linePayApi: string | null;
  /** 金流：第三方金流 API */
  thirdPartyApi: string | null;
  /** 金流 ATM：銀行單位（顯示名稱，如國泰銀行） */
  atmBankName: string | null;
  /** 金流 ATM：銀行代碼（例 013） */
  atmBankCode: string | null;
  /** 金流 ATM：銀行帳號 */
  atmBankAccount: string | null;
  /** 金流開關：藍新 NewebPay（結帳頁顯示/隱藏） */
  paymentNewebpayEnabled: boolean;
  /** 金流開關：綠界 ECPay */
  paymentEcpayEnabled: boolean;
  /** 金流開關：LINE Pay */
  paymentLinepayEnabled: boolean;
  /** 金流開關：ATM 銀行轉帳（開啟時需填寫銀行資訊） */
  paymentAtmEnabled: boolean;
  /** 首頁區塊顯示順序（依此陣列順序渲染） */
  layoutOrder: string[];
  /** 單張大圖區塊的圖片網址 */
  fullWidthImageUrl: string | null;
  /** 畫布區塊（含順序、高度、背景圖）；有值時前台依此渲染，否則用 layoutOrder */
  layoutBlocks: LayoutBlock[];
  /**
   * 全頁裝飾層（中心錨點；隨頁面捲動，與後台畫布對齊）。
   * 橫向 leftPct 為「置中 max-w-7xl 欄」之百分比（見 {@link floatingIconColumnLeftPctToHostLeftPct}），可小於 0 或超過 100 以置於左右留白；垂直為根容器高度百分比。
   */
  viewportFloatingIcons: HeroFloatingIcon[];
  /** 精選課程分館列表（後台可編輯） */
  featuredCategories: FeaturedCategory[];
  /** 精選課程區塊上方小圖示（書本雲朵等） */
  featuredSectionIconUrl?: string | null;
  /** 熱門課程區塊標題上方圖示（檔名含 `home_hot_courses_icon`） */
  homeHotCoursesIconUrl?: string | null;
  /** 新上架課程區塊標題上方圖示（檔名含 `home_new_courses_icon`） */
  homeNewCoursesIconUrl?: string | null;
  /** 站點 LOGO 圖片 URL */
  logoUrl: string | null;
  /** Header/LOGO 區塊的背景圖（可選） */
  headerBackgroundUrl?: string | null;
  /** Header 背景圖：手機專用（可選；未設定則與桌機共用；檔名含 `header_background_mobile`） */
  headerBackgroundMobileUrl?: string | null;
  /**
   * 全站「內文區」背景圖（LOGO 列以下、頁尾條款以上；檔名含 `page_background`）
   * 不影響頁首與頁尾區塊
   */
  pageBackgroundUrl?: string | null;
  /** 內文區背景：手機專用（可選；未設定則與桌機共用；檔名含 `page_background_mobile`） */
  pageBackgroundMobileUrl?: string | null;
  /**
   * 內文區底圖下方延伸色（#RRGGBB 等）。僅在有設定內文區背景圖時生效；長頁超出圖高時以此色填滿，與全站「網站背景色」可分開設定。
   */
  pageBackgroundExtensionColor?: string | null;
  /** 是否顯示商品總選單 */
  showProductMenu: boolean;
  /** 頁尾 A/B/C/D 四區內容（HTML 或純文字） */
  footerAreaA: string | null;
  footerAreaB: string | null;
  footerAreaC: string | null;
  footerAreaD: string | null;
  /** 頁尾整塊背景圖（R2 上傳，檔名含 `footer_background`） */
  footerBackgroundUrl?: string | null;
  /** 頁尾背景圖：手機專用（可選；未設定則與桌機共用；檔名含 `footer_background_mobile`） */
  footerBackgroundMobileUrl?: string | null;
  /** 精選課程區：標題＋分類 icon 段背景（檔名含 `home_featured_top_bg`） */
  homeFeaturedTopBackgroundUrl?: string | null;
  /** 同上段：手機專用背景（可選；未設定則窄螢幕沿用桌機圖；檔名含 `home_featured_top_bg_mobile`） */
  homeFeaturedTopBackgroundMobileUrl?: string | null;
  /** 精選課程區：下方 1+6 課程卡段背景（檔名含 `home_featured_grid_bg`） */
  homeFeaturedGridBackgroundUrl?: string | null;
  /** 精選課程區與後續區塊之間橫幅圖（檔名含 `home_mid_banner`） */
  homeMidBannerImageUrl?: string | null;
  /** 橫幅主圖點擊連結（站內路徑或 http(s)） */
  homeMidBannerLinkUrl?: string | null;
  /** @deprecated 請改用 homeCarouselMidStripBackgroundUrl；讀取時仍作為後備 */
  homeMidBannerSectionBackgroundUrl?: string | null;
  /** 熱門課程與新上架課程區塊共用背景（檔名含 `home_courses_block_bg`） */
  homeCoursesBlockBackgroundUrl?: string | null;
  /** 同上區塊：手機專用背景（可選；未設定則手機沿用桌機圖；檔名含 `home_courses_block_bg_mobile`） */
  homeCoursesBlockBackgroundMobileUrl?: string | null;
  /** @deprecated 請改用 homeCarouselMidStripBackgroundUrl；輪播牆 2 仍可用此欄 */
  homeCarouselSectionBackgroundUrl?: string | null;
  /** 輪播牆（首個）與橫幅區共用整段全寬背景（檔名含 `home_carousel_mid_strip`） */
  homeCarouselMidStripBackgroundUrl?: string | null;
  /** 進站彈窗廣告：是否顯示（建議圖片 480×640） */
  entryPopupEnabled?: boolean;
  /** 彈窗圖片 URL */
  entryPopupImageUrl?: string | null;
  /** 點擊圖片或 CTA 的連結（如 LINE 加好友 URL） */
  entryPopupLinkUrl?: string | null;
};

function pickFirstNonEmptyString(o: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickFirstFiniteNumber(o: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/** 讀取 DB／舊版 JSON：同時接受 camelCase 與 snake_case，避免解析失敗後被其他儲存流程覆寫成空陣列 */
export function parseHeroFloatingIcons(raw: unknown): HeroFloatingIcon[] {
  if (!Array.isArray(raw)) return [];
  const out: HeroFloatingIcon[] = [];
  for (const item of raw) {
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id.trim()) continue;
    const imageUrl = pickFirstNonEmptyString(o, "imageUrl", "image_url");
    if (!imageUrl) continue;
    const leftPctRaw = pickFirstFiniteNumber(o, "leftPct", "left_pct");
    const topPctRaw = pickFirstFiniteNumber(o, "topPct", "top_pct");
    const leftPct = leftPctRaw != null ? clampPct(leftPctRaw) : 50;
    const topPct = topPctRaw != null ? clampPct(topPctRaw) : 50;
    const rawW = pickFirstFiniteNumber(o, "widthPx", "width_px") ?? NaN;
    const widthPx = Number.isFinite(rawW) && rawW >= 16 ? Math.round(rawW) : 64;
    const rawH = pickFirstFiniteNumber(o, "heightPx", "height_px") ?? NaN;
    const heightPx = Number.isFinite(rawH) && rawH >= 16 ? Math.round(rawH) : undefined;
    const zIndexRaw = pickFirstFiniteNumber(o, "zIndex", "z_index");
    const zIndex = zIndexRaw != null ? Math.round(zIndexRaw) : 0;
    const enabled = o.enabled === false ? false : true;
    const lpm = pickFirstFiniteNumber(o, "leftPctMobile", "left_pct_mobile");
    const leftPctMobile = lpm != null ? clampPct(lpm) : undefined;
    const tpm = pickFirstFiniteNumber(o, "topPctMobile", "top_pct_mobile");
    const topPctMobile = tpm != null ? clampPct(tpm) : undefined;
    const rawWm = pickFirstFiniteNumber(o, "widthPxMobile", "width_px_mobile") ?? NaN;
    const widthPxMobile = Number.isFinite(rawWm) && rawWm >= 16 ? Math.round(rawWm) : undefined;
    const rawHm = pickFirstFiniteNumber(o, "heightPxMobile", "height_px_mobile") ?? NaN;
    const heightPxMobile = Number.isFinite(rawHm) && rawHm >= 16 ? Math.round(rawHm) : undefined;
    out.push({
      id: o.id.trim(),
      imageUrl,
      leftPct,
      topPct,
      widthPx,
      ...(heightPx != null ? { heightPx } : {}),
      ...(leftPctMobile != null ? { leftPctMobile } : {}),
      ...(topPctMobile != null ? { topPctMobile } : {}),
      ...(widthPxMobile != null ? { widthPxMobile } : {}),
      ...(heightPxMobile != null ? { heightPxMobile } : {}),
      zIndex,
      enabled,
    });
  }
  return out;
}

/** 將現有設定轉成寫入 DB 的基底物件（避免各 upsert 漏欄位互相覆蓋） */
export function persistFrontendSettingsBase(existing: FrontendSettings): Record<string, unknown> {
  return {
    heroImageUrl: existing.heroImageUrl,
    heroBackgroundUrl: existing.heroBackgroundUrl ?? null,
    heroBackgroundMobileUrl: existing.heroBackgroundMobileUrl ?? null,
    heroTitle: existing.heroTitle,
    carouselItems: existing.carouselItems,
    navAboutLabel: existing.navAboutLabel,
    aboutPageUrl: existing.aboutPageUrl,
    navCoursesLabel: existing.navCoursesLabel,
    navBookingLabel: existing.navBookingLabel,
    navFaqLabel: existing.navFaqLabel,
    memberIconGallery: existing.memberIconGallery,
    memberIconSelectedIndex: existing.memberIconSelectedIndex,
    aboutContent: existing.aboutContent ?? null,
    agreementContent: existing.agreementContent ?? null,
    agreementDocumentsBySlug: existing.agreementDocumentsBySlug ?? {},
    agreementDocumentLabelsBySlug: existing.agreementDocumentLabelsBySlug ?? {},
    precautionsFixedHtml: existing.precautionsFixedHtml ?? null,
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
    fullWidthImageUrl: existing.fullWidthImageUrl ?? null,
    layout_blocks: existing.layoutBlocks.map((b) => serializeLayoutBlockForPersist(b)),
    viewport_floating_icons: serializeFloatingIconsForPersist(existing.viewportFloatingIcons),
    featured_categories: existing.featuredCategories,
    featuredSectionIconUrl: existing.featuredSectionIconUrl ?? null,
    homeHotCoursesIconUrl: existing.homeHotCoursesIconUrl ?? null,
    homeNewCoursesIconUrl: existing.homeNewCoursesIconUrl ?? null,
    logoUrl: existing.logoUrl ?? null,
    headerBackgroundUrl: existing.headerBackgroundUrl ?? null,
    headerBackgroundMobileUrl: existing.headerBackgroundMobileUrl ?? null,
    pageBackgroundUrl: existing.pageBackgroundUrl ?? null,
    pageBackgroundMobileUrl: existing.pageBackgroundMobileUrl ?? null,
    pageBackgroundExtensionColor: existing.pageBackgroundExtensionColor ?? null,
    showProductMenu: existing.showProductMenu ?? false,
    footerAreaA: existing.footerAreaA ?? null,
    footerAreaB: existing.footerAreaB ?? null,
    footerAreaC: existing.footerAreaC ?? null,
    footerAreaD: existing.footerAreaD ?? null,
    footerBackgroundUrl: existing.footerBackgroundUrl ?? null,
    footerBackgroundMobileUrl: existing.footerBackgroundMobileUrl ?? null,
    homeFeaturedTopBackgroundUrl: existing.homeFeaturedTopBackgroundUrl ?? null,
    homeFeaturedTopBackgroundMobileUrl: existing.homeFeaturedTopBackgroundMobileUrl ?? null,
    homeFeaturedGridBackgroundUrl: existing.homeFeaturedGridBackgroundUrl ?? null,
    homeMidBannerImageUrl: existing.homeMidBannerImageUrl ?? null,
    homeMidBannerLinkUrl: existing.homeMidBannerLinkUrl ?? null,
    homeMidBannerSectionBackgroundUrl: existing.homeMidBannerSectionBackgroundUrl ?? null,
    homeCoursesBlockBackgroundUrl: existing.homeCoursesBlockBackgroundUrl ?? null,
    homeCoursesBlockBackgroundMobileUrl: existing.homeCoursesBlockBackgroundMobileUrl ?? null,
    homeCarouselSectionBackgroundUrl: existing.homeCarouselSectionBackgroundUrl ?? null,
    homeCarouselMidStripBackgroundUrl: existing.homeCarouselMidStripBackgroundUrl ?? null,
    entryPopupEnabled: existing.entryPopupEnabled === true,
    entryPopupImageUrl: existing.entryPopupImageUrl ?? null,
    entryPopupLinkUrl: existing.entryPopupLinkUrl ?? null,
  };
}

/** 單一畫布區塊（存於 frontend_settings.layout_blocks） */
export type LayoutBlock = {
  id: string;
  order: number;
  /** 區塊高度（px），用戶可調；未設則用元件預設 */
  heightPx: number | null;
  /** 區塊背景圖網址（上傳至 R2 後存 URL） */
  backgroundImageUrl: string | null;
  /** 是否啟用顯示，預設 true */
  enabled?: boolean;
  /** 區塊標題（可後台編輯，用於新上架課程、熱門體驗、精選課程等） */
  title?: string | null;
  /** 此區塊內裝飾小圖（後台畫布拖曳；百分比相對於該區塊容器） */
  floatingIcons?: HeroFloatingIcon[];
};

/** 寫入 `layout_blocks` 單一元素（與 persistFrontendSettingsBase 一致） */
export function serializeLayoutBlockForPersist(b: LayoutBlock): Record<string, unknown> {
  return {
    id: b.id,
    order: b.order,
    heightPx: b.heightPx,
    backgroundImageUrl: b.backgroundImageUrl,
    enabled: b.enabled !== false,
    title: b.title ?? null,
    floatingIcons: serializeFloatingIconsForPersist(b.floatingIcons),
  };
}

/**
 * 讀取區塊最小高度／背景圖時，舊資料可能只存別名 id（例：`courses` 與 `courses_grid` 二擇一）。
 * 優先使用與 sectionId 完全一致的那一筆，找不到再依序嘗試別名。
 */
const LAYOUT_BLOCK_STYLE_FALLBACK_IDS: Record<string, readonly string[]> = {
  courses_grid: ["courses"],
  courses: ["courses_grid"],
  carousel: ["carousel_2"],
  carousel_2: ["carousel"],
};

export function resolveLayoutBlockForStyle(
  blocks: LayoutBlock[],
  sectionId: string
): LayoutBlock | undefined {
  const candidates: string[] = [sectionId, ...(LAYOUT_BLOCK_STYLE_FALLBACK_IDS[sectionId] ?? [])];
  for (const cid of candidates) {
    const b = blocks.find((x) => x.id === cid);
    if (b) return b;
  }
  return undefined;
}

/**
 * 後台畫布 BlockWrapper：高度／背景來自可能為別名的那一筆，但 `block.id` 必須與畫布選取的 section id 一致（`data-block-id`、拖曳高度寫回）。
 */
export function layoutBlockForCanvasWrapper(
  source: LayoutBlock | undefined,
  canonicalSectionId: string
): LayoutBlock | undefined {
  if (!source) return undefined;
  if (source.id === canonicalSectionId) return source;
  return { ...source, id: canonicalSectionId };
}

/**
 * 未設定 `heightPx` 時，首頁該區在桌機、max-w-7xl 內建版型下之**概算**高度（px），供後台側欄對照。
 */
export function estimateIntrinsicMinHeightPxForBranchHomeBlock(blockId: string): number | null {
  const padX = 32; // px-4 左右，與主內容欄一致
  const innerW = Math.max(0, LAYOUT_DESIGN_CANVAS_WIDTH_PX - padX);
  switch (blockId) {
    case "carousel":
    case "carousel_2": {
      const slideBoxH = Math.round((innerW * 5) / 12);
      return slideBoxH + 32; // section py-4
    }
    case "courses":
    case "courses_grid":
    case "courses_list":
      // 標題 + 一列網格／列表示意之概算（課程多時會更高）
      return 560;
    case "new_courses":
    case "popular_experiences":
      return 220; // 後台佔位 py-8、min-h-[140px]、說明文案
    case "contact":
      return 480; // py-12、雙欄／地圖區概略
    default:
      return null;
  }
}

/** 精選課程分類（首頁分館卡片，後台可編輯） */
export type FeaturedCategory = {
  id: string;
  name: string;
  /** 更多內容連結 */
  link: string;
  imageUrl?: string | null;
  /** 滑鼠移入（hover）時顯示的替換圖（桌機） */
  hoverImageUrl?: string | null;
  /** 是否啟用，預設 true */
  enabled?: boolean;
  /** 排序用，越小越前面 */
  order?: number;
};

/** 預設精選課程 8 分類（童趣島風格） */
export const DEFAULT_FEATURED_CATEGORIES: FeaturedCategory[] = [
  { id: "art", name: "藝術花園", link: "/courses?category=藝術花園" },
  { id: "science", name: "科學秘境", link: "/courses?category=科學秘境" },
  { id: "music", name: "音樂湖畔", link: "/courses?category=音樂湖畔" },
  { id: "baking", name: "烘焙小屋", link: "/courses?category=烘焙小屋" },
  { id: "sense", name: "感知之森", link: "/courses?category=感知之森" },
  { id: "language", name: "語言之丘", link: "/courses?category=語言之丘" },
  { id: "sports", name: "體能草原", link: "/courses?category=體能草原" },
  { id: "world", name: "世界之窗", link: "/courses?category=世界之窗" },
];

/** 首頁 Hero 熱門搜尋標籤（可擴充為後台設定） */
export const DEFAULT_HERO_HOT_TAGS = ["音樂律動", "美感探索", "親子活動", "體能發展", "小小職能"];

/** 首頁區塊 ID（與前台區塊一一對應） */
export const LAYOUT_SECTION_IDS = [
  "header",
  "hero",
  "hero_carousel",
  "featured_categories",
  "carousel",
  "carousel_2",
  "full_width_image",
  "courses",
  "courses_grid",
  "courses_list",
  "new_courses",
  "popular_experiences",
  "about",
  "faq",
  "contact",
  "footer",
] as const;
export type LayoutSectionId = (typeof LAYOUT_SECTION_IDS)[number];

/** 預設首頁區塊順序（童趣島風格：含精選課程、新上架、熱門體驗） */
export const DEFAULT_LAYOUT_ORDER: string[] = [
  "header",
  "hero",
  "featured_categories",
  "carousel",
  "courses_grid",
  "new_courses",
  "popular_experiences",
  "about",
  "faq",
  "contact",
  "footer",
];

/** 預設畫布區塊（由 DEFAULT_LAYOUT_ORDER 產生） */
export function getDefaultLayoutBlocks(): LayoutBlock[] {
  return DEFAULT_LAYOUT_ORDER.map((id, i) => ({
    id,
    order: i,
    heightPx: null,
    backgroundImageUrl: null,
    enabled: true,
    title: LAYOUT_SECTION_LABELS[id] ?? null,
  }));
}

/** 區塊 ID 對應中文標籤（後台畫布顯示用） */
export const LAYOUT_SECTION_LABELS: Record<string, string> = {
  header: "上方導覽列",
  hero: "首頁大圖",
  hero_carousel: "首頁大圖（輪播）",
  featured_categories: "精選課程",
  carousel: "輪播牆",
  carousel_2: "輪播牆 2",
  full_width_image: "單張大圖",
  courses: "熱門課程（舊版）",
  courses_grid: "熱門課程（網格）",
  courses_list: "熱門課程（列表）",
  new_courses: "新上架課程",
  popular_experiences: "熱門體驗",
  about: "關於我們",
  faq: "常見問題",
  contact: "聯絡區",
  footer: "頁尾",
};

/** 預設 10 個會員圖示（專案 public/member-icons/ 內建） */
export const DEFAULT_MEMBER_ICON_URLS: string[] = [
  "/member-icons/1.svg",
  "/member-icons/2.svg",
  "/member-icons/3.svg",
  "/member-icons/4.svg",
  "/member-icons/5.svg",
  "/member-icons/6.svg",
  "/member-icons/7.svg",
  "/member-icons/8.svg",
  "/member-icons/9.svg",
  "/member-icons/10.svg",
];

export const DEFAULT_CAROUSEL: CarouselItem[] = [
  { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
  { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
  { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
];

export const DEFAULT_HERO_TITLE = "探索童趣島，一起冒險吧！";
export const DEFAULT_NAV = { about: "關於我們", courses: "課程資訊", booking: "課程預約", faq: "常見問題" };

/** 關於頁預設站內路徑（對應 app/about/page.tsx） */
export const DEFAULT_ABOUT_PAGE_URL = "/about";

/** 正規化後台儲存的「關於」連結：站內以 / 開頭，或 http(s)；阻擋 javascript:/data: */
export function normalizeAboutPageUrl(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_ABOUT_PAGE_URL;
  const t = raw.trim();
  if (!t) return DEFAULT_ABOUT_PAGE_URL;
  const lower = t.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return DEFAULT_ABOUT_PAGE_URL;
  }
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/")) return t;
  return `/${t.replace(/^\/+/, "")}`;
}
