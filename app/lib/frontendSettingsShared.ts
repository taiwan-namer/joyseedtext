/**
 * 前台設定共用型別與常數（供 actions 與 client 使用，不可放在 "use server" 檔案）。
 *
 * **儲存位置（分站）**：`store_settings.frontend_settings`（jsonb），列為 **`merchant_id = NEXT_PUBLIC_CLIENT_ID`**。
 * 畫布資料為 `frontend_settings.layout_blocks` 陣列，非獨立表。總站範本列為 `merchant_id = "model"`（見 `lib/constants.ts`），勿與分站混淆。
 */

export type CarouselItem = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  /** 是否顯示於前台輪播，預設 true */
  visible?: boolean;
};

/** 首頁各區塊裝飾圖：座標為區塊內百分比，錨點為圖片中心（與 model 總站畫布一致） */
export type HeroFloatingIcon = {
  id: string;
  imageUrl: string;
  /** 0–100，相對區塊容器寬度 */
  leftPct: number;
  /** 0–100，相對區塊容器高度 */
  topPct: number;
  /** 顯示寬度（px） */
  widthPx: number;
  /** 顯示高度（px）；省略時與 widthPx 相同 */
  heightPx?: number;
  /** 手機（max-md）專用；未設定時沿用桌機 */
  leftPctMobile?: number | null;
  topPctMobile?: number | null;
  widthPxMobile?: number | null;
  heightPxMobile?: number | null;
  zIndex?: number;
  enabled?: boolean;
};

/** 依桌機或手機讀取有效座標與尺寸 */
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

export function floatingIconDisplayHeight(ic: HeroFloatingIcon): number {
  return ic.heightPx ?? ic.widthPx;
}

/** 後台列表／畫布標示：與陣列順序對齊（1-based） */
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

export function parseHeroFloatingIcons(raw: unknown): HeroFloatingIcon[] {
  if (!Array.isArray(raw)) return [];
  const out: HeroFloatingIcon[] = [];
  for (const item of raw) {
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id.trim()) continue;
    if (typeof o.imageUrl !== "string" || !o.imageUrl.trim()) continue;
    const leftPct =
      typeof o.leftPct === "number" && Number.isFinite(o.leftPct) ? Math.min(100, Math.max(0, o.leftPct)) : 50;
    const topPct =
      typeof o.topPct === "number" && Number.isFinite(o.topPct) ? Math.min(100, Math.max(0, o.topPct)) : 50;
    const rawW = typeof o.widthPx === "number" && Number.isFinite(o.widthPx) ? o.widthPx : NaN;
    const widthPx = Number.isFinite(rawW) && rawW >= 16 ? Math.round(rawW) : 64;
    const rawH = typeof o.heightPx === "number" && Number.isFinite(o.heightPx) ? o.heightPx : NaN;
    const heightPx = Number.isFinite(rawH) && rawH >= 16 ? Math.round(rawH) : undefined;
    const zIndex = typeof o.zIndex === "number" && Number.isFinite(o.zIndex) ? Math.round(o.zIndex) : 0;
    const enabled = o.enabled === false ? false : true;
    const leftPctMobile =
      typeof o.leftPctMobile === "number" && Number.isFinite(o.leftPctMobile)
        ? Math.min(100, Math.max(0, o.leftPctMobile))
        : undefined;
    const topPctMobile =
      typeof o.topPctMobile === "number" && Number.isFinite(o.topPctMobile)
        ? Math.min(100, Math.max(0, o.topPctMobile))
        : undefined;
    const rawWm = typeof o.widthPxMobile === "number" && Number.isFinite(o.widthPxMobile) ? o.widthPxMobile : NaN;
    const widthPxMobile = Number.isFinite(rawWm) && rawWm >= 16 ? Math.round(rawWm) : undefined;
    const rawHm = typeof o.heightPxMobile === "number" && Number.isFinite(o.heightPxMobile) ? o.heightPxMobile : NaN;
    const heightPxMobile = Number.isFinite(rawHm) && rawHm >= 16 ? Math.round(rawHm) : undefined;
    out.push({
      id: o.id.trim(),
      imageUrl: o.imageUrl.trim(),
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

export type FrontendSettings = {
  heroImageUrl: string | null;
  heroTitle: string | null;
  carouselItems: CarouselItem[];
  navAboutLabel: string;
  navCoursesLabel: string;
  navBookingLabel: string;
  navFaqLabel: string;
  memberIconGallery: string[];
  memberIconSelectedIndex: number;
  /** 關於我們區塊的富文本內容（HTML） */
  aboutContent: string | null;
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
};

/** 單一畫布區塊（存於本分站 `store_settings.frontend_settings.layout_blocks`） */
export type LayoutBlock = {
  id: string;
  order: number;
  /** 區塊高度（px），用戶可調；未設則用元件預設 */
  heightPx: number | null;
  /** 區塊背景圖網址（上傳至 R2 後存 URL） */
  backgroundImageUrl: string | null;
  /** 是否啟用顯示，預設 true */
  enabled?: boolean;
  /** 區塊標題（後台可編輯） */
  title?: string | null;
  /** 此區塊內裝飾小圖（後台畫布拖曳） */
  floatingIcons?: HeroFloatingIcon[];
};

/** 寫入 DB 的 layout_blocks 單筆（與 model 欄位一致） */
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

/** 首頁區塊 ID（與前台區塊一一對應；與 model 對齊） */
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

/** 預設首頁區塊順序（與 model 對齊；前台未實作之區塊可於畫布中略過） */
export const DEFAULT_LAYOUT_ORDER: string[] = [
  "header",
  "hero",
  "featured_categories",
  "carousel",
  "courses",
  "new_courses",
  "popular_experiences",
  "about",
  "faq",
  "contact",
  "footer",
];

/** 區塊 ID 對應中文標籤（後台畫布顯示用） */
export const LAYOUT_SECTION_LABELS: Record<string, string> = {
  header: "上方導覽列",
  hero: "首頁大圖",
  hero_carousel: "首頁大圖（輪播）",
  featured_categories: "精選課程",
  carousel: "輪播牆",
  carousel_2: "輪播牆 2",
  full_width_image: "單張大圖",
  courses: "熱門課程",
  courses_grid: "熱門課程（網格）",
  courses_list: "熱門課程（列表）",
  new_courses: "新上架課程",
  popular_experiences: "熱門體驗",
  about: "關於我們",
  faq: "常見問題",
  contact: "聯絡區",
  footer: "頁尾",
};

/** 預設畫布區塊 */
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

export const DEFAULT_HERO_TITLE = "探索孩子的無限潛能";
export const DEFAULT_NAV = { about: "關於我們", courses: "課程介紹", booking: "課程預約", faq: "常見問題" };
