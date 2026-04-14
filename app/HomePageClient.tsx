"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, ChevronLeft, ChevronRight, Facebook, Instagram, Search, Star } from "lucide-react";
import FAQ from "./components/FAQ";
import FeaturedCategoriesSection from "./components/home/FeaturedCategoriesSection";
import { useStoreSettings } from "./providers/StoreSettingsProvider";
import { useState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import {
  homeActivityMatchesFeaturedCategory,
  pickRandomSubset,
  type HomePageActivity,
} from "@/lib/homePageActivity";
import { CourseCoverBadgesCompact } from "./components/CourseCoverBadges";
import type { CarouselItem, FrontendSettings, HeroFloatingIcon } from "./lib/frontendSettingsShared";
import HeroFloatingIconsLayer from "./components/home/HeroFloatingIconsLayer";
import {
  ABOUT_FLOATING_ICONS_HORIZONTAL_CENTER_SLOTS_1_BASED,
  ABOUT_FLOATING_ICON_HORIZONTAL_ROW_GROUPS_1_BASED,
  ABOUT_FLOATING_ICON_VERTICAL_NUDGE_PX_BY_SLOT_1_BASED,
} from "./about/aboutFloatingLayout";
import AboutRichTextHtml from "./about/AboutRichTextHtml";
import AboutWeBelieveBesideSlot13 from "./about/AboutWeBelieveBesideSlot13";
import {
  DEFAULT_ABOUT_PAGE_URL,
  getDefaultLayoutBlocks,
  normalizeAboutPageUrl,
  LAYOUT_SECTION_LABELS,
  type LayoutBlock,
} from "./lib/frontendSettingsShared";

function coalesceLayoutBlocks(lb: LayoutBlock[] | undefined | null): LayoutBlock[] {
  if (Array.isArray(lb)) return lb;
  return getDefaultLayoutBlocks();
}
import type { FeaturedCategory } from "./lib/frontendSettingsShared";
import { isValidImageUrl } from "@/lib/safeMedia";
import { isAbsoluteHttpUrl, normalizeUserFacingHref } from "@/lib/normalizeUserFacingHref";
import { googleMapsEmbedSrcFromAddress } from "@/lib/googleMapsEmbed";
import EntryPopupAd from "./components/home/EntryPopupAd";
import { TrainIcon } from "@/components/icons/TrainIcon";
import BlockWrapper from "@/app/admin/(protected)/layout/BlockWrapper";
import HeroFloatingIconsEditor from "@/app/admin/(protected)/layout/HeroFloatingIconsEditor";
import type { AdminLayoutCanvasConfig } from "@/app/admin/(protected)/layout/adminLayoutCanvasTypes";

export type { AdminLayoutCanvasConfig } from "@/app/admin/(protected)/layout/adminLayoutCanvasTypes";

/** 首頁 Hero 底部：課程關鍵字搜尋（導向 /courses?q=） */
function HeroCourseSearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  useEffect(() => {
    router.prefetch("/courses");
  }, [router]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = q.trim();
    router.push(t ? `/courses?q=${encodeURIComponent(t)}` : "/courses");
  };
  return (
    <form
      onSubmit={submit}
      className="mt-2 flex w-full items-center gap-0 overflow-visible rounded-full border-2 border-[#4a3428] bg-white py-1.5 pl-1 pr-1 shadow-sm sm:mt-2.5 md:mt-2"
    >
      <div className="flex shrink-0 items-center justify-center pl-1 pr-1" aria-hidden>
        <Star className="h-9 w-9 fill-amber-300 text-amber-400" strokeWidth={1.5} />
      </div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜尋關鍵字"
        className="min-w-0 flex-1 bg-transparent text-[15px] text-gray-700 outline-none placeholder:text-gray-400"
        enterKeyHint="search"
        aria-label="搜尋課程關鍵字"
      />
      <button
        type="submit"
        className="flex shrink-0 items-center justify-center rounded-none bg-transparent p-2 text-[#4a3428] transition-opacity hover:opacity-90"
        aria-label="搜尋"
      >
        <Search className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </form>
  );
}

const HERO_HEADING_SHADOW =
  "0 0 2px #fff, 0 0 4px #fff, 1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 2px 0 0 #fff, -2px 0 0 #fff, 0 2px 0 #fff, 0 -2px 0 #fff";

/** 首頁 Hero 標題＋搜尋（桌機覆蓋層／手機主圖下方共用） */
function HeroHeadingAndSearch({
  heroTitle,
  siteName,
  wrapperClassName,
}: {
  heroTitle: string | null;
  siteName: string;
  wrapperClassName: string;
}) {
  return (
    <div className={wrapperClassName}>
      <h2
        className="mx-auto w-max max-w-full text-center text-xl font-extrabold tracking-wide text-[#4a3428] sm:text-2xl md:mx-0 md:text-left md:text-3xl"
        style={{ textShadow: HERO_HEADING_SHADOW }}
      >
        {(heroTitle && heroTitle.trim()) || `探索${siteName}，一起冒險吧！`}
      </h2>
      <HeroCourseSearchBar />
    </div>
  );
}

function pickPrimaryAgeTag(tags: string[] | undefined): string | null {
  const t = (tags ?? []).map((x) => String(x).trim()).filter(Boolean);
  return t[0] ?? null;
}

/** LINE 圖示（lucide 無內建，用 SVG 以 currentColor 套主色） */
function LineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.127h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

const CAROUSEL_INTERVAL_MS = 4000;
const ACTIVITY_CARD_WIDTH = 280;
const ACTIVITY_GAP = 16;
const ACTIVITY_AUTO_SCROLL_MS = 4500;
/** 首頁精選課程區：一大圖右側最多顯示的小卡數量 */
const HOME_FEATURED_SECONDARY_MAX = 6;

/** 從主圖取背景色（取圖上方與四角採樣平均），回傳 hex；失敗回傳 null */
function getHeroBackgroundColor(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = 0.2;
        canvas.width = Math.max(1, Math.floor(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.floor(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const w = canvas.width;
        const h = canvas.height;
        const data = ctx.getImageData(0, 0, w, h).data;
        const samples: [number, number, number][] = [];
        const topY = Math.floor(h * 0.08);
        for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 8))) {
          const i = (topY * w + x) * 4;
          samples.push([data[i], data[i + 1], data[i + 2]]);
        }
        const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
        for (const [cx, cy] of corners) {
          const i = (cy * w + cx) * 4;
          samples.push([data[i], data[i + 1], data[i + 2]]);
        }
        let r = 0, g = 0, b = 0;
        for (const [sr, sg, sb] of samples) {
          r += sr;
          g += sg;
          b += sb;
        }
        const n = samples.length;
        r = Math.round(r / n);
        g = Math.round(g / n);
        b = Math.round(b / n);
        const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
        resolve(hex);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl.startsWith("http") ? imageUrl : `${typeof window !== "undefined" ? window.location.origin : ""}${imageUrl}`;
  });
}

type Props = {
  initialFrontendSettings: FrontendSettings;
  initialActivities: HomePageActivity[];
  adminLayoutCanvas?: AdminLayoutCanvasConfig | null;
};

export default function WonderVoyageHomePage({
  initialFrontendSettings,
  initialActivities,
  adminLayoutCanvas = null,
}: Props) {
  const {
    siteName,
    primaryColor,
    backgroundColor: storeBackgroundColor,
    socialFbUrl,
    socialIgUrl,
    socialLineUrl,
    contactEmail,
    contactPhone,
    contactAddress,
  } = useStoreSettings();
  const hasSocialLinks = !!(socialFbUrl || socialIgUrl || socialLineUrl);
  const hasContact = !!(contactPhone || contactEmail || contactAddress);
  const mapEmbedUrl = googleMapsEmbedSrcFromAddress(contactAddress) ?? "";
  const [wallIndex, setWallIndex] = useState(0);
  const [activityIndex, setActivityIndex] = useState(0);
  const activities = initialActivities;
  const [newCourseActivities] = useState<HomePageActivity[]>(() =>
    pickRandomSubset(initialActivities, 8)
  );
  const activityScrollRef = useRef<HTMLDivElement>(null);
  const [heroImageUrl] = useState<string | null>(initialFrontendSettings.heroImageUrl);
  const [carouselItems] = useState<CarouselItem[]>(
    initialFrontendSettings.carouselItems.length > 0
      ? initialFrontendSettings.carouselItems
      : [
          { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
          { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
          { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
        ]
  );
  const [heroTitle] = useState<string | null>(initialFrontendSettings.heroTitle ?? null);
  const [aboutContent] = useState<string | null>(initialFrontendSettings.aboutContent ?? null);
  /** 前台：僅初次 hydration；後台畫布：每輪 render 與父層 blocks 一致，勿用 effect 同步（避免上傳後一幀狀態不一致觸發異常） */
  const [layoutBlocksSnapshot] = useState<LayoutBlock[]>(() =>
    coalesceLayoutBlocks(initialFrontendSettings.layoutBlocks)
  );
  const layoutBlocks = adminLayoutCanvas
    ? coalesceLayoutBlocks(initialFrontendSettings.layoutBlocks)
    : layoutBlocksSnapshot;
  const floatingLayerViewport: "desktop" | "mobile" | undefined = adminLayoutCanvas
    ? (adminLayoutCanvas.floatingIconsCoordinateMode ?? "desktop")
    : undefined;
  const [featuredCategories] = useState<FeaturedCategory[]>(
    initialFrontendSettings.featuredCategories?.length ? initialFrontendSettings.featuredCategories : []
  );
  const [featuredIconUrl] = useState<string | null>(initialFrontendSettings.featuredSectionIconUrl ?? null);
  const [homeHotCoursesIconUrl] = useState<string | null>(initialFrontendSettings.homeHotCoursesIconUrl ?? null);
  const [homeNewCoursesIconUrl] = useState<string | null>(initialFrontendSettings.homeNewCoursesIconUrl ?? null);
  const [heroBackgroundUrl] = useState<string | null>(initialFrontendSettings.heroBackgroundUrl ?? null);
  const [heroBackgroundMobileUrl] = useState<string | null>(
    initialFrontendSettings.heroBackgroundMobileUrl ?? null
  );
  const [homeFeaturedTopBackgroundUrl] = useState<string | null>(initialFrontendSettings.homeFeaturedTopBackgroundUrl ?? null);
  const [homeFeaturedTopBackgroundMobileUrl] = useState<string | null>(
    initialFrontendSettings.homeFeaturedTopBackgroundMobileUrl ?? null
  );
  const [homeFeaturedGridBackgroundUrl] = useState<string | null>(initialFrontendSettings.homeFeaturedGridBackgroundUrl ?? null);
  const [homeMidBannerImageUrl] = useState<string | null>(initialFrontendSettings.homeMidBannerImageUrl ?? null);
  const [homeMidBannerLinkUrl] = useState<string | null>(initialFrontendSettings.homeMidBannerLinkUrl ?? null);
  const [homeMidBannerSectionBackgroundUrl] = useState<string | null>(
    initialFrontendSettings.homeMidBannerSectionBackgroundUrl ?? null
  );
  const [homeCoursesBlockBackgroundUrl] = useState<string | null>(initialFrontendSettings.homeCoursesBlockBackgroundUrl ?? null);
  const [homeCoursesBlockBackgroundMobileUrl] = useState<string | null>(
    initialFrontendSettings.homeCoursesBlockBackgroundMobileUrl ?? null
  );
  const [homeCarouselSectionBackgroundUrl] = useState<string | null>(
    initialFrontendSettings.homeCarouselSectionBackgroundUrl ?? null
  );
  const [homeCarouselMidStripBackgroundUrl] = useState<string | null>(
    initialFrontendSettings.homeCarouselMidStripBackgroundUrl ?? null
  );
  const [heroBgColor, setHeroBgColor] = useState<string | null>(null);
  const [selectedFeaturedCategoryId, setSelectedFeaturedCategoryId] = useState<string | null>(null);
  const router = useRouter();

  /** 預先載入首頁課程詳情 RSC，點擊卡片時較少卡在「載入課程」 */
  useEffect(() => {
    if (adminLayoutCanvas) return;
    const seen = new Set<string>();
    for (const a of activities) {
      if (a.id.startsWith("placeholder-")) continue;
      const href = a.detailHref?.trim();
      if (!href?.startsWith("/course/")) continue;
      seen.add(href);
    }
    const hrefs = Array.from(seen).slice(0, 32);
    for (let i = 0; i < hrefs.length; i++) {
      router.prefetch(hrefs[i]!);
    }
  }, [activities, adminLayoutCanvas, router]);

  // 避免瀏覽器 reload 時恢復到頁尾（例如聯絡區）造成「先看到聯絡區再跳回首頁」的體驗
  useEffect(() => {
    if (typeof window === "undefined") return;
    // 只在沒有 hash 的一般刷新時拉回頂部，避免影響 #contact 等錨點導覽
    if (!window.location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    }
  }, []);

  /** 首頁帶 #faq / #about / #contact 時，補強捲動（Next 導覽與行動裝置常未自動對準錨點） */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const scrollToHashElement = () => {
      const raw = window.location.hash?.replace(/^#/, "") ?? "";
      if (!raw) return;
      const el = document.getElementById(decodeURIComponent(raw));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    const t0 = window.setTimeout(scrollToHashElement, 0);
    const t1 = window.setTimeout(scrollToHashElement, 120);
    const t2 = window.setTimeout(scrollToHashElement, 400);
    const onHashChange = () => scrollToHashElement();
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("hashchange", onHashChange);
    };
    // 僅依賴掛載／卸載；勿綁 aboutContent 等，否則無關內容更新會重跑計時、與使用者捲動位置競爭（手機尤明顯）
  }, []);

  // 從主圖取背景色（僅套用在 Hero 區塊，不覆蓋全站背景色）
  useEffect(() => {
    if (!heroImageUrl?.trim()) return;
    let cancelled = false;
    getHeroBackgroundColor(heroImageUrl).then((hex) => {
      if (cancelled || !hex) return;
      setHeroBgColor(hex);
    });
    return () => {
      cancelled = true;
    };
  }, [heroImageUrl]);

  const getBlock = (id: string) => layoutBlocks.find((b) => b.id === id);
  /**
   * 後台畫布拖曳用的區塊高度（heightPx）僅在 adminLayoutCanvas 時套成 min-height。
   * 前台若套用，窄螢幕會把輪播／橫幅區拉成巨幅空白；裝飾圖層為 absolute inset-0 以 % 定位，會整段錯位（Safari 上尤明顯）。
   */
  const layoutCanvasMinHeightPx = (b: LayoutBlock | undefined): React.CSSProperties => {
    if (!adminLayoutCanvas || !b?.heightPx || b.heightPx <= 0) return {};
    return { minHeight: b.heightPx };
  };
  const getBlockStyle = (id: string): React.CSSProperties => {
    const b = getBlock(id);
    if (!b) return {};
    return {
      ...layoutCanvasMinHeightPx(b),
      ...(b.backgroundImageUrl ? { backgroundImage: `url(${b.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
    };
  };

  /**
   * 精選課程區：前台已上傳「標題＋分類 icon 段背景」時，勿再疊加首頁版面畫布的 `backgroundImage`（cover）。
   * 否則同一張或相近圖會以 cover 鋪滿整段 section，與頂部 img 兩層錯位，視覺成「雙重波浪／接縫」。
   */
  const getFeaturedCategoriesSectionStyle = (blockId: string): React.CSSProperties => {
    const b = getBlock(blockId);
    if (!b) return {};
    const minH = layoutCanvasMinHeightPx(b);
    const hasFeaturedTopBg =
      (homeFeaturedTopBackgroundUrl && isValidImageUrl(homeFeaturedTopBackgroundUrl)) ||
      (homeFeaturedTopBackgroundMobileUrl && isValidImageUrl(homeFeaturedTopBackgroundMobileUrl));
    if (hasFeaturedTopBg) {
      return minH;
    }
    return {
      ...minH,
      ...(b.backgroundImageUrl
        ? {
            backgroundImage: `url(${b.backgroundImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }
        : {}),
    };
  };

  /** 熱門／新上架課程區：桌機與手機可分流背景圖（手機專用圖僅 md 以下顯示） */
  const coursesBlockDesktopBg = isValidImageUrl(homeCoursesBlockBackgroundUrl) ? homeCoursesBlockBackgroundUrl : null;
  const coursesBlockMobileBg = isValidImageUrl(homeCoursesBlockBackgroundMobileUrl)
    ? homeCoursesBlockBackgroundMobileUrl
    : null;
  const coursesBlockMobileLayerUrl = coursesBlockMobileBg ?? coursesBlockDesktopBg;
  const hasCoursesBlockSharedBg = !!(coursesBlockDesktopBg || coursesBlockMobileBg);
  const getCoursesBlockSectionStyle = (id: string): React.CSSProperties => {
    if (hasCoursesBlockSharedBg) {
      const b = getBlock(id);
      return {
        ...layoutCanvasMinHeightPx(b),
      };
    }
    return getBlockStyle(id);
  };

  const defaultCarousel: CarouselItem[] = [
    { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
    { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
    { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
  ];
  const carouselList = (carouselItems.length > 0 ? carouselItems : defaultCarousel).filter((item) => item.visible !== false);
  useEffect(() => {
    if (carouselList.length === 0) return;
    const timer = setInterval(() => {
      setWallIndex((i) => (i + 1) % carouselList.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [carouselList.length]);

  // 熱門課程：自動輪播捲動
  useEffect(() => {
    if (activities.length === 0) return;
    const timer = setInterval(() => {
      setActivityIndex((i) => (i + 1) % activities.length);
    }, ACTIVITY_AUTO_SCROLL_MS);
    return () => clearInterval(timer);
  }, [activities.length]);

  /** 依精選分館名稱篩選：主題分類（marketplace_category）或 sidebar_option 內標記，與 /courses?category= 一致 */
  const getActivitiesForCategory = (categoryName: string | null): HomePageActivity[] => {
    if (!categoryName?.trim() || activities.length === 0) return activities;
    const normalized = categoryName.trim();
    return activities.filter((a) => homeActivityMatchesFeaturedCategory(a, normalized));
  };

  useEffect(() => {
    const el = activityScrollRef.current;
    if (!el || activities.length === 0) return;
    const step = ACTIVITY_CARD_WIDTH + ACTIVITY_GAP;
    el.scrollTo({ left: Math.min(activityIndex, activities.length - 1) * step, behavior: "smooth" });
  }, [activityIndex, activities.length]);

  /** 依後台「首頁版面」積木順序，只渲染已加入且啟用的區塊（不含 header/footer） */
  const sortedBlocks = [...layoutBlocks]
    .sort((a, b) => a.order - b.order)
    .filter((b) => b.id !== "header" && b.id !== "footer" && b.enabled !== false);

  /**
   * 裝飾圖編輯層須與 HeroFloatingIconsLayer 共用同一個定位父層（% 座標才與底圖一致）。
   * 勿再掛在 BlockWrapper 外層 div，否則全寬 breakout／內容欄 與編輯器寬度不一致會導致點擊區偏移。
   */
  const renderFloatingIconsEditor = (block: LayoutBlock): ReactNode => {
    if (!adminLayoutCanvas) return null;
    if (adminLayoutCanvas.selectedBlockId !== block.id) return null;
    if ((block.floatingIcons?.length ?? 0) === 0) return null;
    return (
      <HeroFloatingIconsEditor
        overlayMode
        icons={block.floatingIcons ?? []}
        onChange={(next) => adminLayoutCanvas.onBlockFloatingIconsChange(block.id, next)}
        coordinateMode={adminLayoutCanvas.floatingIconsCoordinateMode ?? "desktop"}
        horizontalCenterSlots1Based={
          block.id === "about" ? ABOUT_FLOATING_ICONS_HORIZONTAL_CENTER_SLOTS_1_BASED : undefined
        }
        horizontalRowGroups1Based={
          block.id === "about" ? ABOUT_FLOATING_ICON_HORIZONTAL_ROW_GROUPS_1_BASED : undefined
        }
        verticalNudgePxBySlot1Based={
          block.id === "about" ? ABOUT_FLOATING_ICON_VERTICAL_NUDGE_PX_BY_SLOT_1_BASED : undefined
        }
        selectedIconId={adminLayoutCanvas.selectedFloatingIconId ?? null}
        onIconPointerDown={(id) => adminLayoutCanvas.onSelectFloatingIcon?.(block.id, id)}
      />
    );
  };

  /** 單一區塊內容（依 block.id 回傳對應 JSX，block.title 為區塊標題） */
  const renderBlockContent = (block: LayoutBlock) => {
    /** 後台版面畫布：內容寬為 designWidthPx + scale，勿用 100vw／breakout，否則全寬區塊會對齊瀏覽器視窗而非畫布 */
    const isLayoutCanvasPreview = Boolean(adminLayoutCanvas);
    const blockTitle = block.title?.trim() || null;
    const sectionTitle = (fallback: string) => blockTitle || fallback;
    switch (block.id) {
      case "hero": {
        return (
          <section className="w-full overflow-x-hidden" style={getBlockStyle(block.id)}>
            {/* 主圖區塊：僅後台有上傳主圖時顯示圖片，否則僅顯示背景色與標題/熱門搜尋 */}
            <div
              className={
                isLayoutCanvasPreview
                  ? "relative w-full min-w-0 min-h-[min(72svh,640px)] md:min-h-[calc(98svh+50px)] flex items-center justify-center overflow-hidden"
                  : "relative w-screen min-w-screen min-h-[min(72svh,640px)] md:min-h-[calc(98svh+50px)] flex items-center justify-center overflow-hidden"
              }
              style={{
                ...(isLayoutCanvasPreview ? {} : { marginLeft: "calc(-50vw + 50%)" }),
                backgroundColor: heroBgColor ?? storeBackgroundColor,
              }}
            >
              {(heroBackgroundUrl || heroBackgroundMobileUrl) &&
                (() => {
                  const desk =
                    heroBackgroundUrl?.trim() && isValidImageUrl(heroBackgroundUrl)
                      ? heroBackgroundUrl
                      : null;
                  const mob =
                    heroBackgroundMobileUrl?.trim() && isValidImageUrl(heroBackgroundMobileUrl)
                      ? heroBackgroundMobileUrl
                      : null;
                  const imgSrc = mob ?? desk;
                  if (!imgSrc) return null;
                  return (
                    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
                      <picture className="absolute inset-0 block">
                        {desk && mob ? <source media="(min-width: 768px)" srcSet={desk} /> : null}
                        {/* 等比例鋪滿、置中裁切；勿用 object-fill／h-[135%] 以免與 16:9 等比例素材互相拉伸 */}
                        <img
                          src={imgSrc}
                          alt=""
                          className="absolute inset-0 z-0 h-full w-full object-cover object-center"
                          fetchPriority="high"
                          decoding="async"
                        />
                      </picture>
                    </div>
                  );
                })()}
              {isValidImageUrl(heroImageUrl) && (
                <div className="absolute inset-0 z-[1] max-md:-translate-y-[30px] md:-translate-y-[90px]">
                  {/* 手機放大 10%、桌機縮小 20%；scale 在此層以免覆蓋 hero-float 的 transform；外層 overflow-hidden 裁切邊界 */}
                  <div className="absolute inset-0 origin-center max-md:scale-[1.1] md:scale-[0.8]">
                    <div className="absolute inset-0 animate-hero-float">
                      <Image
                        src={heroImageUrl}
                        alt="Hero"
                        fill
                        className="object-contain object-center"
                        sizes="100vw"
                        priority
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 z-20 hidden pointer-events-none md:flex md:flex-row md:items-center md:justify-start">
                <div className="mx-auto flex h-full w-full max-w-7xl flex-col px-4 sm:px-6 md:items-start md:justify-center md:px-8 lg:px-12 xl:pl-16 2xl:pl-20">
                  {/*
                    網頁版：標題＋搜尋疊在主圖左側；手機版見下方 absolute bottom 區塊
                  */}
                  <HeroHeadingAndSearch
                    heroTitle={heroTitle}
                    siteName={siteName}
                    wrapperClassName="pointer-events-auto mx-auto flex w-max min-w-0 max-w-full flex-col md:mx-0 md:-translate-y-[min(5svh,3rem)]"
                  />
                </div>
              </div>
              {/*
                手機：標題＋搜尋貼容器下緣；與主圖 translate 為兄弟節點，調整主圖位移不會改變此層的定位基準。
                先前改為容器外獨立區塊時，會接在整段 min-height 之後，造成主圖與文案之間一大段空白。
              */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] md:hidden">
                <HeroHeadingAndSearch
                  heroTitle={heroTitle}
                  siteName={siteName}
                  wrapperClassName="pointer-events-auto mx-auto flex w-max min-w-0 max-w-full flex-col items-center"
                />
              </div>
              <HeroFloatingIconsLayer coordinateViewport={floatingLayerViewport} icons={block.floatingIcons} />
              {renderFloatingIconsEditor(block)}
            </div>
          </section>
        );
      }
      case "featured_categories":
        {
          const enabledCategories =
            featuredCategories.length > 0
              ? featuredCategories.filter((c) => c.enabled !== false)
              : [];
          const selectedCategory =
            (selectedFeaturedCategoryId &&
              enabledCategories.find((c) => c.id === selectedFeaturedCategoryId)) ||
            enabledCategories[0] ||
            null;

          const activeFeaturedCategoryId =
            selectedFeaturedCategoryId ?? enabledCategories[0]?.id ?? null;

          const globalHasCourses = activities.length > 0;
          const rawCategoryActivities = selectedCategory
            ? getActivitiesForCategory(selectedCategory.name)
            : activities;
          const categoryHasCourses = rawCategoryActivities.length > 0;
          const usePlaceholders = !globalHasCourses;
          const fallbackActivities: HomePageActivity[] = usePlaceholders
            ? Array.from({ length: 7 }).map((_, i) => ({
                id: `placeholder-${i}`,
                title: "尚無課程，這裡會顯示精選課程卡片",
                price: 0,
                stock: 0,
                imageUrl: null,
                detailHref: "#",
                ageTags: [],
                category: "課程",
                description: undefined,
              }))
            : [];
          const categoryActivities = usePlaceholders
            ? fallbackActivities
            : selectedCategory
              ? rawCategoryActivities
              : activities;
          const hasRealActivities = !usePlaceholders && categoryHasCourses;

          const [mainActivity, ...restActivities] = categoryActivities;
          const secondaryActivities = restActivities;
          const visibleSecondaryActivities = secondaryActivities.slice(0, HOME_FEATURED_SECONDARY_MAX);
          const showMoreToIntro =
            secondaryActivities.length > HOME_FEATURED_SECONDARY_MAX && hasRealActivities;

          const featuredTopDesk =
            homeFeaturedTopBackgroundUrl && isValidImageUrl(homeFeaturedTopBackgroundUrl)
              ? homeFeaturedTopBackgroundUrl
              : null;
          const featuredTopMob =
            homeFeaturedTopBackgroundMobileUrl && isValidImageUrl(homeFeaturedTopBackgroundMobileUrl)
              ? homeFeaturedTopBackgroundMobileUrl
              : null;
          const hasFeaturedTopBgLayer = !!(featuredTopDesk || featuredTopMob);

          const gridSectionSurfaceClass =
            homeFeaturedGridBackgroundUrl != null && homeFeaturedGridBackgroundUrl !== ""
              ? ""
              : hasFeaturedTopBgLayer
                ? "bg-transparent"
                : "bg-transparent max-md:bg-page";

          const courseGridSection =
            selectedCategory && mainActivity ? (
              <section className={`relative z-10 w-full overflow-hidden ${gridSectionSurfaceClass}`}>
                  {homeFeaturedGridBackgroundUrl ? (
                    <div className="pointer-events-none absolute inset-0 z-0">
                      <div className="relative h-full w-full">
                        <Image
                          src={homeFeaturedGridBackgroundUrl}
                          alt=""
                          fill
                          className="object-cover object-center"
                          sizes="100vw"
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="relative z-10 mx-auto max-w-[1320px] px-4 pb-0 md:px-6 md:pb-10">
                    {/* 手機版：一大圖 + 其餘橫向輪播牆；底不留 padding，避免與下方輪播牆之間露主背景白縫 */}
                    <div className="space-y-3 md:hidden">
                      <div className="flex justify-center">
                        <Link
                          href={mainActivity.detailHref}
                          prefetch={true}
                          className="group relative rounded-2xl overflow-hidden shadow-md bg-white"
                        >
                          <div className="relative w-[260px] sm:w-[360px] aspect-square bg-gray-100 overflow-hidden">
                            {isValidImageUrl(mainActivity.imageUrl) ? (
                              <Image
                                src={mainActivity.imageUrl}
                                alt={mainActivity.title}
                                fill
                                sizes="(max-width:640px) 360px, 532px"
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                尚無圖片
                              </div>
                            )}
                            {!mainActivity.id.startsWith("placeholder-") ? (
                              <CourseCoverBadgesCompact
                                isFull={mainActivity.stock === 0}
                                badgeNew={!!mainActivity.badgeNew}
                                badgeHot={!!mainActivity.badgeHot}
                                badgeFeatured={!!mainActivity.badgeFeatured}
                                primaryAgeTag={pickPrimaryAgeTag(mainActivity.ageTags)}
                              />
                            ) : null}
                          </div>
                        </Link>
                      </div>
                      {visibleSecondaryActivities.length > 0 && (
                        <div className="relative max-md:-mb-1">
                          <div className="flex gap-4 overflow-x-auto pb-0 md:pb-2">
                            {visibleSecondaryActivities.map((act) => (
                              <Link
                                key={act.id}
                                href={act.detailHref}
                                prefetch={true}
                                className="group rounded-2xl overflow-hidden bg-page/60 flex-shrink-0"
                              >
                                <div className="relative w-[160px] sm:w-[200px] aspect-square bg-gray-100 overflow-hidden rounded-xl shadow-sm">
                                  {isValidImageUrl(act.imageUrl) ? (
                                    <Image
                                      src={act.imageUrl}
                                      alt={act.title}
                                      fill
                                      sizes="(max-width:640px) 200px, 240px"
                                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                      尚無圖片
                                    </div>
                                  )}
                                  {!act.id.startsWith("placeholder-") ? (
                                    <CourseCoverBadgesCompact
                                      isFull={act.stock === 0}
                                      badgeNew={!!act.badgeNew}
                                      badgeHot={!!act.badgeHot}
                                      badgeFeatured={!!act.badgeFeatured}
                                      primaryAgeTag={pickPrimaryAgeTag(act.ageTags)}
                                    />
                                  ) : null}
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 平板 / 桌機版：一大圖 + 右側六小圖網格 */}
                    <div className="hidden md:grid md:grid-cols-[auto_minmax(0,1fr)] gap-y-4 gap-x-5 lg:gap-x-5">
                      <div className="flex justify-start -ml-5 lg:-ml-5">
                        <Link
                          href={mainActivity.detailHref}
                          prefetch={true}
                          className="group relative rounded-2xl overflow-hidden shadow-md bg-white"
                        >
                          <div className="relative w-[360px] lg:w-[532px] aspect-square bg-gray-100 overflow-hidden">
                            {isValidImageUrl(mainActivity.imageUrl) ? (
                              <Image
                                src={mainActivity.imageUrl}
                                alt={mainActivity.title}
                                fill
                                sizes="(max-width:1024px) 360px, 532px"
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                                尚無圖片
                              </div>
                            )}
                            {!mainActivity.id.startsWith("placeholder-") ? (
                              <CourseCoverBadgesCompact
                                isFull={mainActivity.stock === 0}
                                badgeNew={!!mainActivity.badgeNew}
                                badgeHot={!!mainActivity.badgeHot}
                                badgeFeatured={!!mainActivity.badgeFeatured}
                                primaryAgeTag={pickPrimaryAgeTag(mainActivity.ageTags)}
                              />
                            ) : null}
                          </div>
                        </Link>
                      </div>

                      <div className="grid grid-cols-3 gap-4 lg:gap-5 justify-items-center content-between">
                        {visibleSecondaryActivities.map((act) => (
                          <Link
                            key={act.id}
                            href={act.detailHref}
                            prefetch={true}
                            className="group rounded-2xl bg-page/80 p-2"
                          >
                            <div className="relative w-[210px] lg:w-[240px] aspect-square bg-gray-100 overflow-hidden rounded-xl shadow-sm">
                              {isValidImageUrl(act.imageUrl) ? (
                                <Image
                                  src={act.imageUrl}
                                  alt={act.title}
                                  fill
                                  sizes="(max-width:1024px) 210px, 240px"
                                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                  尚無圖片
                                </div>
                              )}
                              {!act.id.startsWith("placeholder-") ? (
                                <CourseCoverBadgesCompact
                                  isFull={act.stock === 0}
                                  badgeNew={!!act.badgeNew}
                                  badgeHot={!!act.badgeHot}
                                  badgeFeatured={!!act.badgeFeatured}
                                  primaryAgeTag={pickPrimaryAgeTag(act.ageTags)}
                                />
                              ) : null}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                    {showMoreToIntro ? (
                      <div className="flex justify-center pt-6 md:pt-8">
                        <Link
                          href="/courses/intro"
                          prefetch={true}
                          className="text-sm font-medium text-brand hover:underline underline-offset-4"
                        >
                          顯示更多
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </section>
            ) : null;

          return (
            <section
              className="relative z-10 w-full -mt-8 md:-mt-[156px]"
              style={getFeaturedCategoriesSectionStyle(block.id)}
            >
              {hasFeaturedTopBgLayer ? (
                <div className="relative w-full">
                  {/*
                    精選課程「標題＋分類 icon」段背景：勿用 fill + object-cover。
                    勿用 w-full：會把「寬度小於視窗」的圖強制拉寬（上採樣），波浪邊易出現橫向斷層／接縫。
                    用 w-auto + max-w min(100%,2400px)：至多等寬縮小、不放大超過原圖；flex items-start 避免 stretch 與 object-fit 留白。
                    手機可另傳專用圖（md 以下顯示），未傳則全寬沿用桌機圖。
                  */}
                  <div
                    className="pointer-events-none absolute left-0 right-0 top-0 z-0 flex w-full items-start justify-center"
                    aria-hidden
                  >
                    {featuredTopDesk && featuredTopMob ? (
                      <>
                        <img
                          src={featuredTopDesk}
                          alt=""
                          className="mx-auto hidden h-auto w-auto max-w-[min(100%,2400px)] shrink-0 select-none md:block [transform:translateZ(0)]"
                          loading="eager"
                          decoding="async"
                          draggable={false}
                          fetchPriority="high"
                        />
                        <img
                          src={featuredTopMob}
                          alt=""
                          className="mx-auto block h-auto w-auto max-w-[min(100%,2400px)] shrink-0 select-none md:hidden [transform:translateZ(0)]"
                          loading="eager"
                          decoding="async"
                          draggable={false}
                          fetchPriority="high"
                        />
                      </>
                    ) : (
                      <img
                        src={(featuredTopDesk ?? featuredTopMob)!}
                        alt=""
                        className="mx-auto block h-auto w-auto max-w-[min(100%,2400px)] shrink-0 select-none [transform:translateZ(0)]"
                        loading="eager"
                        decoding="async"
                        draggable={false}
                        fetchPriority="high"
                      />
                    )}
                  </div>
                  <div className="relative z-10">
                    <FeaturedCategoriesSection
                      categories={enabledCategories}
                      sectionTitle={sectionTitle("精選課程")}
                      sectionIconUrl={featuredIconUrl ?? undefined}
                      activeCategoryId={activeFeaturedCategoryId}
                      onCategoryClick={(cat) => setSelectedFeaturedCategoryId(cat.id)}
                      onCategoryHover={(cat) => setSelectedFeaturedCategoryId(cat.id)}
                      surfaceClassName="bg-transparent"
                    />
                    {courseGridSection}
                  </div>
                </div>
              ) : (
                <>
                  <FeaturedCategoriesSection
                    categories={enabledCategories}
                    sectionTitle={sectionTitle("精選課程")}
                    sectionIconUrl={featuredIconUrl ?? undefined}
                    activeCategoryId={activeFeaturedCategoryId}
                    onCategoryClick={(cat) => setSelectedFeaturedCategoryId(cat.id)}
                    onCategoryHover={(cat) => setSelectedFeaturedCategoryId(cat.id)}
                    surfaceClassName="bg-transparent"
                  />
                  {courseGridSection}
                </>
              )}
              {/*
                裝飾圖 % 與「精選課程」內容欄（max-w-7xl px-4）一致；勿相對整段 w-full section。
                垂直仍用 section 全高，與輪播牆／橫幅條同款。
              */}
              <div className="pointer-events-none absolute inset-0 z-[30] flex justify-center">
                <div className="relative h-full w-full max-w-7xl px-4">
                  <HeroFloatingIconsLayer coordinateViewport={floatingLayerViewport} icons={block.floatingIcons} />
                  {renderFloatingIconsEditor(block)}
                </div>
              </div>
            </section>
          );
        }
      case "carousel":
      case "carousel_2":
        if (carouselList.length === 0) return null;
        {
          const carouselN = carouselList.length;
          const carouselShowArrows = carouselN > 1;
          const carouselFrame = (
            <div className="relative w-full md:w-[95%] md:mx-auto aspect-[12/5] rounded-xl overflow-hidden [contain:layout]">
              {carouselShowArrows ? (
                <>
                  <button
                    type="button"
                    onClick={() => setWallIndex((i) => (i === 0 ? carouselN - 1 : i - 1))}
                    aria-label="上一張輪播圖"
                    className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-transparent shadow-none border border-transparent flex items-center justify-center text-gray-600 hover:bg-brand hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setWallIndex((i) => (i + 1) % carouselN)}
                    aria-label="下一張輪播圖"
                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-transparent shadow-none border border-transparent flex items-center justify-center text-gray-600 hover:bg-brand hover:text-white transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </>
              ) : null}
              {/* 手機：translateX 橫移，避免 opacity 切換造成閃爍／跳動 */}
              <div className="absolute inset-0 md:hidden overflow-hidden">
                <div
                  className="flex h-full backface-hidden transition-transform duration-300 ease-out motion-reduce:transition-none"
                  style={{
                    width: `${carouselN * 100}%`,
                    transform: `translate3d(-${wallIndex * (100 / carouselN)}%,0,0)`,
                  }}
                >
                  {carouselList.map((item, i) => {
                    const isActive = i === wallIndex;
                    const linkHref = isActive ? normalizeUserFacingHref(item.linkUrl) : null;
                    return (
                      <div
                        key={`mob-${item.id}`}
                        className={`relative h-full shrink-0 ${isValidImageUrl(item.imageUrl) ? "bg-gray-900" : "bg-amber-100"} ${
                          isActive ? "" : "pointer-events-none"
                        }`}
                        style={{ width: `${100 / carouselN}%` }}
                      >
                        {linkHref ? (
                          <a
                            href={linkHref}
                            {...(isAbsoluteHttpUrl(linkHref)
                              ? { target: "_blank" as const, rel: "noopener noreferrer" }
                              : {})}
                            className="absolute inset-0 z-20 flex flex-col items-center justify-center outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-brand"
                          >
                            {isValidImageUrl(item.imageUrl) ? (
                              <div className="absolute inset-0 z-0">
                                <div className="relative h-full w-full">
                                  <Image
                                    src={item.imageUrl}
                                    alt=""
                                    fill
                                    className="object-cover"
                                    sizes="(max-width:768px) 100vw, min(95vw, 1200px)"
                                    priority={isActive && i === 0}
                                  />
                                </div>
                              </div>
                            ) : (
                              <ImageIcon className="w-12 h-12 text-gray-400 relative z-10" strokeWidth={1.5} />
                            )}
                            <span className="sr-only">
                              {(item.title?.trim() || item.subtitle?.trim() || "開啟連結").slice(0, 120)}
                            </span>
                          </a>
                        ) : (
                          <>
                            {isValidImageUrl(item.imageUrl) ? (
                              <div className="absolute inset-0 z-0">
                                <div className="relative h-full w-full">
                                  <Image
                                    src={item.imageUrl}
                                    alt=""
                                    fill
                                    className="object-cover"
                                    sizes="(max-width:768px) 100vw, min(95vw, 1200px)"
                                    priority={isActive && i === 0}
                                  />
                                </div>
                              </div>
                            ) : (
                              <ImageIcon className="w-12 h-12 text-gray-400 relative z-10" strokeWidth={1.5} />
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* 桌機：維持 opacity 淡入淡出 */}
              <div className="absolute inset-0 hidden md:block">
                {carouselList.map((item, i) => {
                  const isActive = i === wallIndex;
                  const linkHref = isActive ? normalizeUserFacingHref(item.linkUrl) : null;
                  return (
                    <div
                      key={item.id}
                      className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${
                        isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                      } ${isValidImageUrl(item.imageUrl) ? "bg-gray-900" : "bg-amber-100"}`}
                    >
                      {linkHref ? (
                        <a
                          href={linkHref}
                          {...(isAbsoluteHttpUrl(linkHref)
                            ? { target: "_blank" as const, rel: "noopener noreferrer" }
                            : {})}
                          className="absolute inset-0 z-20 flex flex-col items-center justify-center outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          {isValidImageUrl(item.imageUrl) ? (
                            <div className="absolute inset-0 z-0">
                              <div className="relative h-full w-full">
                                <Image
                                  src={item.imageUrl}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="(max-width:768px) 100vw, min(95vw, 1200px)"
                                  priority={isActive && i === 0}
                                />
                              </div>
                            </div>
                          ) : (
                            <ImageIcon className="w-12 h-12 text-gray-400 relative z-10" strokeWidth={1.5} />
                          )}
                          <span className="sr-only">
                            {(item.title?.trim() || item.subtitle?.trim() || "開啟連結").slice(0, 120)}
                          </span>
                        </a>
                      ) : (
                        <>
                          {isValidImageUrl(item.imageUrl) ? (
                            <div className="absolute inset-0 z-0">
                              <div className="relative h-full w-full">
                                <Image
                                  src={item.imageUrl}
                                  alt=""
                                  fill
                                  className="object-cover"
                                  sizes="(max-width:768px) 100vw, min(95vw, 1200px)"
                                  priority={isActive && i === 0}
                                />
                              </div>
                            </div>
                          ) : (
                            <ImageIcon className="w-12 h-12 text-gray-400 relative z-10" strokeWidth={1.5} />
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1.5">
                {carouselList.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setWallIndex(i)}
                    aria-label={`第 ${i + 1} 張`}
                    className={`h-2 rounded-full transition-all ${
                      i === wallIndex ? "w-6 bg-brand" : "w-2 bg-white/80 hover:bg-white"
                    }`}
                  />
                ))}
              </div>
            </div>
          );

          if (block.id === "carousel_2") {
            const stripBg2 =
              homeCarouselSectionBackgroundUrl ?? homeCarouselMidStripBackgroundUrl;
            if (stripBg2) {
              return (
                <section
                  className={
                    isLayoutCanvasPreview
                      ? "relative z-10 max-md:z-[30] w-full overflow-x-clip overflow-y-visible bg-transparent max-md:-mt-3 max-md:pb-10 pb-8 md:pt-5 md:pb-28 [overflow-anchor:none]"
                      : "relative z-10 max-md:z-[30] w-screen max-w-[100vw] overflow-x-clip overflow-y-visible bg-transparent max-md:-mt-3 max-md:pb-10 pb-8 md:pt-5 md:pb-28 [overflow-anchor:none]"
                  }
                  style={{
                    ...(isLayoutCanvasPreview ? {} : { marginLeft: "calc(-50vw + 50%)" }),
                    ...getBlockStyle(block.id),
                  }}
                >
                  <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
                    <div className="relative h-full w-full">
                      <Image
                        src={stripBg2}
                        alt=""
                        fill
                        className="object-cover object-center max-md:object-top"
                        sizes="100vw"
                      />
                    </div>
                  </div>
                  <div className="relative z-10 mx-auto max-w-7xl px-4 flex flex-col items-center justify-center max-md:pt-2 max-md:pb-6 md:pt-12 md:pb-8">
                    <div className="w-full max-md:translate-y-[75px] md:translate-y-[50px]">{carouselFrame}</div>
                  </div>
                  <div className="pointer-events-none absolute inset-0 z-[30] flex justify-center">
                    <div className="relative h-full w-full max-w-7xl px-4">
                      <HeroFloatingIconsLayer coordinateViewport={floatingLayerViewport} icons={block.floatingIcons} />
                      {renderFloatingIconsEditor(block)}
                    </div>
                  </div>
                </section>
              );
            }
            return (
              <section className="relative px-0 pt-0 pb-4" style={getBlockStyle(block.id)}>
                <div className="max-md:translate-y-[75px] md:translate-y-[50px]">{carouselFrame}</div>
                <HeroFloatingIconsLayer coordinateViewport={floatingLayerViewport} icons={block.floatingIcons} />
                {renderFloatingIconsEditor(block)}
              </section>
            );
          }

          const effectiveFirstStrip =
            homeCarouselMidStripBackgroundUrl ??
            homeCarouselSectionBackgroundUrl ??
            homeMidBannerSectionBackgroundUrl;
          const useMergedStrip =
            Boolean(effectiveFirstStrip) || Boolean(homeMidBannerImageUrl);

          if (useMergedStrip) {
            return (
              <section
                className={
                  isLayoutCanvasPreview
                    ? "relative z-10 max-md:z-[30] w-full overflow-x-clip overflow-y-visible bg-transparent pb-6 max-md:-mt-3 max-md:pb-8 md:pt-5 md:pb-32 [overflow-anchor:none]"
                    : "relative z-10 max-md:z-[30] w-screen max-w-[100vw] overflow-x-clip overflow-y-visible bg-transparent pb-6 max-md:-mt-3 max-md:pb-8 md:pt-5 md:pb-32 [overflow-anchor:none]"
                }
                style={{
                  ...(isLayoutCanvasPreview ? {} : { marginLeft: "calc(-50vw + 50%)" }),
                  ...getBlockStyle(block.id),
                }}
              >
                {effectiveFirstStrip ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 z-0 max-md:bottom-0 md:bottom-[160px]"
                    aria-hidden
                  >
                    <div className="relative h-full w-full">
                      <Image
                        src={effectiveFirstStrip}
                        alt=""
                        fill
                        className="object-cover object-center max-md:object-top"
                        sizes="100vw"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 bottom-0 z-0 bg-transparent md:bottom-[160px]"
                    aria-hidden
                  />
                )}
                <div className="relative z-10 mx-auto max-w-[1720px] lg:max-w-[1514px] px-2 md:px-3 w-full">
                  <div className="flex flex-col items-center justify-center w-full max-md:pt-2 max-md:pb-6 md:pt-12 md:pb-8">
                    {/*
                      勿在父層對輪播＋橫幅用 isolate + 整段 translate：Safari 在輪播 transform 動畫後易重算合成層，
                      與全區裝飾圖層競爭時橫幅會短暫可見再像被蓋掉。窄螢改以 padding 推開。
                    */}
                    <div className="flex w-full max-w-[1720px] lg:max-w-[1514px] flex-col items-center max-md:pt-[50px] md:translate-y-[50px]">
                      <div className="relative z-20 w-full max-md:translate-y-[25px] md:translate-y-0 overflow-hidden [transform:translateZ(0)]">
                        {carouselFrame}
                      </div>
                      {isValidImageUrl(homeMidBannerImageUrl) ? (
                        <div className="relative z-10 max-md:z-[40] w-full mt-6 md:mt-8 pb-1 md:pb-2 md:translate-y-[50px] [transform:translateZ(0)]">
                          {(() => {
                            const bannerHref = normalizeUserFacingHref(homeMidBannerLinkUrl);
                            const img = (
                              <div className="relative w-full overflow-hidden rounded-2xl aspect-[2000/348] max-h-[240px] sm:max-h-[300px] md:max-h-[360px]">
                                <Image
                                  src={homeMidBannerImageUrl}
                                  alt=""
                                  fill
                                  sizes="(max-width:768px) 100vw, min(95vw, 1200px)"
                                  className="object-cover"
                                />
                              </div>
                            );
                            const mobileShift = "max-md:translate-y-[45px] max-md:-mb-[45px]";
                            const inner = !bannerHref ? (
                              img
                            ) : (
                              <a
                                href={bannerHref}
                                {...(isAbsoluteHttpUrl(bannerHref)
                                  ? { target: "_blank" as const, rel: "noopener noreferrer" }
                                  : {})}
                                className="block rounded-2xl outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-brand"
                              >
                                {img}
                                <span className="sr-only">開啟橫幅連結</span>
                              </a>
                            );
                            return <div className={mobileShift}>{inner}</div>;
                          })()}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                {/*
                  裝飾圖 % 須與「內容欄寬度」一致（輪播在 max-w-[1720px] 內），勿相對整段 w-screen；
                  垂直仍用 section 全高。窄螢幕裝飾層低於橫幅 (max-md:z-[40])，避免 WebKit 合成順序錯亂蓋住橫幅。
                */}
                <div className="pointer-events-none absolute inset-0 z-[25] max-md:z-[25] md:z-[30] flex justify-center">
                  <div className="relative h-full w-full max-w-[1720px] lg:max-w-[1514px] px-2 md:px-3">
                    <HeroFloatingIconsLayer coordinateViewport={floatingLayerViewport} icons={block.floatingIcons} />
                    {renderFloatingIconsEditor(block)}
                  </div>
                </div>
              </section>
            );
          }

          return (
            <section className="relative px-0 pt-0 pb-4" style={getBlockStyle(block.id)}>
              <div className="max-md:translate-y-[75px] md:translate-y-[50px]">{carouselFrame}</div>
              <HeroFloatingIconsLayer coordinateViewport={floatingLayerViewport} icons={block.floatingIcons} />
              {renderFloatingIconsEditor(block)}
            </section>
          );
        }
      case "courses":
        return (
          <section
            className={`w-full relative max-md:pb-1 md:pb-4 ${
              hasCoursesBlockSharedBg
                ? /* 窄螢幕少往上疊，讓橫幅區維持在上層視覺，熱門區整體較下 */
                  `max-md:-mt-10 max-md:pt-8 md:-mt-[180px] md:pt-[380px]${coursesBlockDesktopBg ? "" : " md:bg-page"}`
                : "bg-page max-md:pt-6 md:pt-[200px]"
            }`}
            style={getCoursesBlockSectionStyle(block.id)}
          >
            {hasCoursesBlockSharedBg ? (
              <>
                {coursesBlockDesktopBg ? (
                  <div className="pointer-events-none absolute inset-0 z-0 hidden md:block" aria-hidden>
                    <div className="relative h-full w-full">
                      <Image
                        src={coursesBlockDesktopBg}
                        alt=""
                        fill
                        className="object-cover object-center"
                        sizes="100vw"
                      />
                    </div>
                  </div>
                ) : null}
                {coursesBlockMobileLayerUrl ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 top-24 z-0 md:hidden"
                    aria-hidden
                  >
                    {/*
                      勿用 inset-0：與 -mt 疊到輪播／橫幅區時，底圖會蓋住橫幅。頂端留白只影響此層背景，不挪橫幅 DOM。
                    */}
                    <div className="relative h-full w-full">
                      <Image
                        src={coursesBlockMobileLayerUrl}
                        alt=""
                        fill
                        className="object-cover object-center"
                        sizes="100vw"
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
            <div
              className={`max-md:translate-y-[80px] md:translate-y-0 ${
                hasCoursesBlockSharedBg ? "relative z-10 md:-mt-5" : "md:-mt-5"
              }`}
            >
            <div className="max-w-7xl mx-auto px-4 mb-4 max-md:pt-0">
              <div className="-translate-y-[30px]">
                <div className="mb-2 md:mb-0 flex justify-center max-md:mt-[50px] max-md:translate-y-[20px] md:-mt-[100px] md:-translate-y-[30px]">
                  {isValidImageUrl(homeHotCoursesIconUrl) ? (
                    <Image
                      src={homeHotCoursesIconUrl}
                      alt="熱門課程圖示"
                      width={600}
                      height={224}
                      sizes="(max-width:768px) 88vw, 50vw"
                      className="h-auto w-auto max-w-full max-md:max-w-[88%] md:max-w-[50%] aspect-[600/224] object-contain"
                    />
                  ) : (
                    <TrainIcon width={270} height={203} className="h-auto" />
                  )}
                </div>
                <h2 className="md:-mt-5 text-lg font-semibold text-gray-800 text-center">熱門課程</h2>
              </div>
            </div>
            <div className="relative w-full">
              <button
                type="button"
                onClick={() =>
                  setActivityIndex((i) => (i === 0 ? Math.max(0, activities.length - 1) : i - 1))
                }
                aria-label="上一則課程"
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-brand hover:text-white transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setActivityIndex((i) =>
                    i >= Math.max(0, activities.length - 1) ? 0 : i + 1
                  )
                }
                aria-label="下一則課程"
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-brand hover:text-white transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div
                ref={activityScrollRef}
                className="w-full overflow-x-auto scrollbar-hide px-4 sm:px-12 snap-x snap-mandatory scroll-smooth"
              >
                <div className="flex gap-4 min-w-max py-2">
                  {activities.length === 0 ? (
                    <div className="shrink-0 w-[280px] snap-start bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
                      尚無課程，請至後台新增課程
                    </div>
                  ) : (
                    activities.map((activity) => {
                      const isSoldOut = activity.stock === 0;
                      return (
                        <article
                          key={activity.id}
                          className="shrink-0 w-[280px] snap-start bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                        >
                          <div className="aspect-square relative bg-gray-200 flex items-center justify-center overflow-hidden">
                            {isValidImageUrl(activity.imageUrl) ? (
                              <Image
                                src={activity.imageUrl}
                                alt=""
                                fill
                                sizes="280px"
                                className="object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-14 h-14 text-gray-400" strokeWidth={1.5} />
                            )}
                            <CourseCoverBadgesCompact
                              isFull={isSoldOut}
                              badgeNew={!!activity.badgeNew}
                              badgeHot={!!activity.badgeHot}
                              badgeFeatured={!!activity.badgeFeatured}
                              primaryAgeTag={pickPrimaryAgeTag(activity.ageTags)}
                            />
                          </div>
                          <div className="p-3 flex-1 flex flex-col min-h-0">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              {activity.category && (
                                <span className="text-xs text-gray-500 truncate">{activity.category}</span>
                              )}
                            </div>
                            <h3 className="font-medium text-gray-800 line-clamp-2 mb-2 text-sm">{activity.title}</h3>
                            {activity.description && (
                              <p className="text-xs text-gray-600 line-clamp-2 mb-2 leading-relaxed">
                                {activity.description}
                              </p>
                            )}
                            <div className="flex items-center justify-end gap-2 mb-3">
                              <p className="text-brand font-semibold text-sm">
                                NT$ {activity.price.toLocaleString()} 起
                              </p>
                            </div>
                            <Link
                              href={activity.detailHref}
                              prefetch={true}
                              className={`mt-auto w-full py-2.5 rounded-lg text-sm font-medium text-center transition-colors block ${
                                isSoldOut
                                  ? "bg-gray-200 text-gray-500 cursor-not-allowed pointer-events-none"
                                  : "bg-brand text-white hover:bg-brand-hover"
                              }`}
                            >
                              立即報名
                            </Link>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="max-w-7xl mx-auto px-4 flex justify-center gap-2 max-md:mt-2 md:mt-4">
              {activities.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActivityIndex(i)}
                  aria-label={`第 ${i + 1} 個課程`}
                  className={`h-2 rounded-full transition-all ${
                    i === activityIndex ? "w-6 bg-brand" : "w-2 bg-gray-300 hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>
            </div>
            <div className="pointer-events-none absolute inset-0 z-[30] flex justify-center">
              <div className="relative h-full w-full max-w-7xl px-4">
                <HeroFloatingIconsLayer coordinateViewport={floatingLayerViewport} icons={block.floatingIcons} />
                {renderFloatingIconsEditor(block)}
              </div>
            </div>
          </section>
        );
      case "new_courses":
        return (
          <section
            className={`w-full relative ${
              hasCoursesBlockSharedBg
                ? `max-md:mt-4 max-md:pt-3 pb-[150px] md:pt-[calc(1.5rem+180px)]${coursesBlockDesktopBg ? "" : " md:bg-page"}`
                : "bg-page max-md:py-2 max-md:pb-3 md:py-6 pb-4"
            }`}
            style={getCoursesBlockSectionStyle(block.id)}
          >
            {hasCoursesBlockSharedBg ? (
              <>
                {coursesBlockDesktopBg ? (
                  <div className="pointer-events-none absolute inset-0 z-0 hidden md:block" aria-hidden>
                    <div className="relative h-full w-full">
                      <Image
                        src={coursesBlockDesktopBg}
                        alt=""
                        fill
                        className="object-cover object-center"
                        sizes="100vw"
                      />
                    </div>
                  </div>
                ) : null}
                {coursesBlockMobileLayerUrl ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 top-24 z-0 md:hidden"
                    aria-hidden
                  >
                    <div className="relative h-full w-full">
                      <Image
                        src={coursesBlockMobileLayerUrl}
                        alt=""
                        fill
                        className="object-cover object-center"
                        sizes="100vw"
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
            <div className={hasCoursesBlockSharedBg ? "relative z-10" : undefined}>
            <div className="max-w-7xl mx-auto px-4 mb-4 max-md:pt-0">
              {isValidImageUrl(homeNewCoursesIconUrl) ? (
                <div className="mb-2 flex justify-center max-md:mt-[120px] md:-mt-[100px]">
                  <Image
                    src={homeNewCoursesIconUrl}
                    alt="新上架課程圖示"
                    width={600}
                    height={224}
                    sizes="(max-width:768px) 88vw, 40vw"
                    className="h-auto w-auto max-w-full max-md:max-w-[88%] md:max-w-[40%] aspect-[600/224] object-contain"
                  />
                </div>
              ) : null}
              <h2 className="text-lg font-semibold text-gray-800 text-center">{sectionTitle("新上架課程")}</h2>
            </div>
            <div className="max-w-7xl mx-auto px-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {newCourseActivities.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-gray-500 text-sm">尚無課程</div>
                ) : (
                  newCourseActivities.map((activity) => {
                    const isSoldOut = activity.stock === 0;
                    return (
                      <article
                        key={activity.id}
                        className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                      >
                        <div className="aspect-square relative bg-gray-200 flex items-center justify-center overflow-hidden">
                          {isValidImageUrl(activity.imageUrl) ? (
                            <Image
                              src={activity.imageUrl}
                              alt=""
                              fill
                              sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
                              className="object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-14 h-14 text-gray-400" strokeWidth={1.5} />
                          )}
                          <CourseCoverBadgesCompact
                            isFull={isSoldOut}
                            badgeNew={!!activity.badgeNew}
                            badgeHot={!!activity.badgeHot}
                            badgeFeatured={!!activity.badgeFeatured}
                            primaryAgeTag={pickPrimaryAgeTag(activity.ageTags)}
                          />
                        </div>
                        <div className="p-3 flex-1 flex flex-col min-h-0">
                          <h3 className="font-medium text-gray-800 line-clamp-2 mb-2 text-sm">{activity.title}</h3>
                          <div className="flex justify-end gap-2 mb-3 mt-auto">
                            <p className="text-brand font-semibold text-sm">
                              NT$ {activity.price.toLocaleString()}{activity.price > 0 ? " 起" : ""}
                            </p>
                          </div>
                          <Link
                            href={activity.detailHref}
                            prefetch={true}
                            className={`w-full py-2.5 rounded-lg text-sm font-medium text-center transition-colors block ${
                              isSoldOut
                                ? "bg-gray-200 text-gray-500 cursor-not-allowed pointer-events-none"
                                : "bg-brand text-white hover:bg-brand-hover"
                            }`}
                          >
                            {isSoldOut ? "不開放報名" : "立即報名"}
                          </Link>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
            </div>
            <div className="pointer-events-none absolute inset-0 z-[30] flex justify-center">
              <div className="relative h-full w-full max-w-7xl px-4">
                <HeroFloatingIconsLayer coordinateViewport={floatingLayerViewport} icons={block.floatingIcons} />
                {renderFloatingIconsEditor(block)}
              </div>
            </div>
          </section>
        );
      case "popular_experiences":
        return (
          <section className="w-full py-6 pb-8 relative bg-white border-t border-gray-100" style={getBlockStyle(block.id)}>
            <div className="max-w-7xl mx-auto px-4 mb-4">
              <h2 className="text-lg font-semibold text-gray-800">{sectionTitle("熱門體驗")}</h2>
            </div>
            <div className="max-w-7xl mx-auto px-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {activities.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-gray-500 text-sm">尚無課程</div>
                ) : (
                  activities.map((activity, idx) => {
                    const isSoldOut = activity.stock === 0;
                    const showCoupon = idx < 2;
                    return (
                      <article
                        key={activity.id}
                        className="relative bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                      >
                        {showCoupon && (
                          <span className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded bg-brand text-white text-xs font-medium">
                            優惠券
                          </span>
                        )}
                        <div className="aspect-square relative bg-gray-200 flex items-center justify-center overflow-hidden">
                          {isValidImageUrl(activity.imageUrl) ? (
                            <Image
                              src={activity.imageUrl}
                              alt=""
                              fill
                              sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
                              className="object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-14 h-14 text-gray-400" strokeWidth={1.5} />
                          )}
                          <CourseCoverBadgesCompact
                            isFull={isSoldOut}
                            badgeNew={!!activity.badgeNew}
                            badgeHot={!!activity.badgeHot}
                            badgeFeatured={!!activity.badgeFeatured}
                            primaryAgeTag={pickPrimaryAgeTag(activity.ageTags)}
                          />
                        </div>
                        <div className="p-3 flex-1 flex flex-col min-h-0">
                          <h3 className="font-medium text-gray-800 line-clamp-2 mb-2 text-sm">{activity.title}</h3>
                          <div className="flex justify-end gap-2 mb-3 mt-auto">
                            <p className="text-brand font-semibold text-sm">
                              NT$ {activity.price.toLocaleString()}{activity.price > 0 ? " 起" : ""}
                            </p>
                          </div>
                          <Link
                            href={activity.detailHref}
                            prefetch={true}
                            className={`w-full py-2.5 rounded-lg text-sm font-medium text-center transition-colors block ${
                              isSoldOut
                                ? "bg-gray-200 text-gray-500 cursor-not-allowed pointer-events-none"
                                : "bg-brand text-white hover:bg-brand-hover"
                            }`}
                          >
                            {isSoldOut ? "不開放報名" : "立即報名"}
                          </Link>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 z-[30] flex justify-center">
              <div className="relative h-full w-full max-w-7xl px-4">
                <HeroFloatingIconsLayer coordinateViewport={floatingLayerViewport} icons={block.floatingIcons} />
                {renderFloatingIconsEditor(block)}
              </div>
            </div>
          </section>
        );
      case "courses_grid":
      case "courses_list":
        return (
          <section className="w-full pt-[200px] py-6 pb-8 relative bg-page" style={getBlockStyle(block.id)}>
            <div className="max-w-7xl mx-auto px-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">熱門課程</h2>
              <div className={block.id === "courses_list" ? "space-y-4" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"}>
                {activities.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 text-sm">尚無課程</div>
                ) : (
                  activities.map((activity) => {
                    const isSoldOut = activity.stock === 0;
                    return (
                      <article
                        key={activity.id}
                        className={`bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col ${block.id === "courses_list" ? "flex-row sm:flex-row gap-4 p-4" : ""}`}
                      >
                        <div
                          className={`aspect-square relative bg-gray-200 flex items-center justify-center overflow-hidden ${block.id === "courses_list" ? "w-full sm:w-40 shrink-0" : ""}`}
                        >
                          {isValidImageUrl(activity.imageUrl) ? (
                            <Image
                              src={activity.imageUrl}
                              alt=""
                              fill
                              sizes={
                                block.id === "courses_list"
                                  ? "(max-width:640px) 100vw, 160px"
                                  : "(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
                              }
                              className="object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-14 h-14 text-gray-400" strokeWidth={1.5} />
                          )}
                          <CourseCoverBadgesCompact
                            isFull={isSoldOut}
                            badgeNew={!!activity.badgeNew}
                            badgeHot={!!activity.badgeHot}
                            badgeFeatured={!!activity.badgeFeatured}
                            primaryAgeTag={pickPrimaryAgeTag(activity.ageTags)}
                          />
                        </div>
                        <div className="p-3 flex-1 flex flex-col min-h-0">
                          <h3 className="font-medium text-gray-800 line-clamp-2 mb-2 text-sm">{activity.title}</h3>
                          <p className="text-brand font-semibold text-sm mb-2">NT$ {activity.price.toLocaleString()} 起</p>
                          <Link
                            href={activity.detailHref}
                            prefetch={true}
                            className={`mt-auto w-full py-2.5 rounded-lg text-sm font-medium text-center transition-colors block ${
                              isSoldOut ? "bg-gray-200 text-gray-500 cursor-not-allowed pointer-events-none" : "bg-brand text-white hover:bg-brand-hover"
                            }`}
                          >
                            {isSoldOut ? "不開放報名" : "立即報名"}
                          </Link>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 z-[30] flex justify-center">
              <div className="relative h-full w-full max-w-7xl px-4">
                <HeroFloatingIconsLayer coordinateViewport={floatingLayerViewport} icons={block.floatingIcons} />
                {renderFloatingIconsEditor(block)}
              </div>
            </div>
          </section>
        );
      case "about": {
        // 關於內容已放在獨立頁（預設 /about）時，首頁不再重複顯示此區塊
        if (normalizeAboutPageUrl(initialFrontendSettings.aboutPageUrl) === DEFAULT_ABOUT_PAGE_URL) {
          return null;
        }
        const hasAboutBody = aboutContent != null && aboutContent.trim() !== "";
        const hasAboutFloats = !!(block.floatingIcons && block.floatingIcons.length > 0);
        if (!hasAboutBody && !hasAboutFloats) return null;
        return (
          <section
            id="about"
            className="about-page-vertical relative isolate bg-transparent pt-0 pb-0 px-0 scroll-mt-20"
            style={getBlockStyle(block.id)}
          >
            <div className="relative z-10 w-full min-w-0 max-w-none">
              {hasAboutBody ? (
                <AboutRichTextHtml html={aboutContent!} className="home-rich-text about-page-rich-text w-full min-w-0" />
              ) : null}
              {hasAboutBody || hasAboutFloats ? <AboutWeBelieveBesideSlot13 /> : null}
            </div>
            <HeroFloatingIconsLayer
              coordinateViewport={floatingLayerViewport}
              icons={block.floatingIcons}
              horizontalCenterSlots1Based={ABOUT_FLOATING_ICONS_HORIZONTAL_CENTER_SLOTS_1_BASED}
              horizontalRowGroups1Based={ABOUT_FLOATING_ICON_HORIZONTAL_ROW_GROUPS_1_BASED}
              verticalNudgePxBySlot1Based={ABOUT_FLOATING_ICON_VERTICAL_NUDGE_PX_BY_SLOT_1_BASED}
            />
            {renderFloatingIconsEditor(block)}
          </section>
        );
      }
      case "faq":
        return (
          <section id="faq" className="relative bg-white py-12 px-4 scroll-mt-20" style={getBlockStyle(block.id)}>
            <div className="mx-auto max-w-7xl">
              <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">常見問題</h2>
              <FAQ />
            </div>
            <div className="pointer-events-none absolute inset-0 z-[30] flex justify-center px-4">
              <div className="relative h-full w-full max-w-7xl">
                <HeroFloatingIconsLayer coordinateViewport={floatingLayerViewport} icons={block.floatingIcons} />
                {renderFloatingIconsEditor(block)}
              </div>
            </div>
          </section>
        );
      case "contact":
        return (
          <section id="contact" className="relative bg-page border-t border-gray-100 py-12 px-4 scroll-mt-20" style={getBlockStyle(block.id)}>
            <div className="mx-auto max-w-7xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                  {(hasContact || hasSocialLinks) && (
                    <>
                      <p className="text-xl font-bold text-brand">{siteName}</p>
                      {hasContact && (
                        <div className="text-gray-700 text-sm space-y-2">
                          {contactPhone && <p>聯絡電話：{contactPhone}</p>}
                          {contactEmail && (
                            <p>
                              信箱：{" "}
                              <a href={`mailto:${contactEmail}`} className="text-brand hover:underline">
                                {contactEmail}
                              </a>
                            </p>
                          )}
                          {contactAddress && <p>地址：{contactAddress}</p>}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-6">
                        {socialFbUrl && (
                          <a href={socialFbUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 text-gray-600 hover:opacity-80 transition-opacity" aria-label="Facebook">
                            <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm" style={{ color: primaryColor }}>
                              <Facebook className="w-5 h-5" strokeWidth={2} />
                            </span>
                            <span className="text-xs font-medium">Facebook</span>
                          </a>
                        )}
                        {socialIgUrl && (
                          <a href={socialIgUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 text-gray-600 hover:opacity-80 transition-opacity" aria-label="Instagram">
                            <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm" style={{ color: primaryColor }}>
                              <Instagram className="w-5 h-5" strokeWidth={2} />
                            </span>
                            <span className="text-xs font-medium">Instagram</span>
                          </a>
                        )}
                        {socialLineUrl && (
                          <a href={socialLineUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5 text-gray-600 hover:opacity-80 transition-opacity" aria-label="LINE">
                            <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm" style={{ color: primaryColor }}>
                              <LineIcon className="w-5 h-5" />
                            </span>
                            <span className="text-xs font-medium">LINE</span>
                          </a>
                        )}
                      </div>
                    </>
                  )}
                  {!hasContact && !hasSocialLinks && (
                    <p className="text-sm text-gray-500">請至後台「基本資料」填寫聯絡資訊與社群連結。</p>
                  )}
                </div>
                {mapEmbedUrl && (
                  <div className="w-full min-h-0 rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm flex flex-col max-h-[320px]">
                    <iframe src={mapEmbedUrl} title="地圖" className="w-full h-full min-h-[240px] max-h-[320px] border-0" allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                  </div>
                )}
              </div>
              <div className="mt-8 pt-6 border-t border-gray-200 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-gray-600">
                <Link href="/privacy" className="hover:text-brand hover:underline">隱私權條款</Link>
                <Link href="/terms" className="hover:text-brand hover:underline">服務條款</Link>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 z-[30] flex justify-center px-4">
              <div className="relative h-full w-full max-w-7xl">
                <HeroFloatingIconsLayer coordinateViewport={floatingLayerViewport} icons={block.floatingIcons} />
                {renderFloatingIconsEditor(block)}
              </div>
            </div>
          </section>
        );
      case "full_width_image":
        return null; // 由 getFrontendSettings.fullWidthImageUrl 控制，可之後補上
      default:
        return null;
    }
  };

  /** 首頁整頁加高（非主圖區）：僅外層 min-height，不改 hero 區塊高度 */
  /** svh：避免手機網址列顯示／隱藏時 dvh／vh 變動造成整頁與下方輪播／橫幅上下跳動 */
  const homeRootMinHClass = adminLayoutCanvas ? "min-h-svh" : "min-h-[calc(100svh+100px)]";

  return (
    <div className={`flex ${homeRootMinHClass} flex-col bg-transparent`}>
      {!adminLayoutCanvas && (
        <EntryPopupAd
          enabled={initialFrontendSettings.entryPopupEnabled === true}
          imageUrl={initialFrontendSettings.entryPopupImageUrl ?? null}
          linkUrl={initialFrontendSettings.entryPopupLinkUrl ?? null}
        />
      )}
      {/* 主內容：依後台「首頁版面」積木順序動態渲染（僅啟用區塊）；版頭由根 layout PublicGlobalHeader 統一渲染 */}
      <main className="relative z-0 flex-1 w-full">
        {sortedBlocks.map((block) => {
          const content = renderBlockContent(block);
          if (content == null) return null;
          /** 輪播＋橫幅需全寬，勿包在 max-w-7xl：否則內層 w-screen 的 breakout 會相對錯誤寬度，兩側出現白邊 */
          const isFullWidth =
            block.id === "hero" || block.id === "carousel" || block.id === "carousel_2";
          const isCarouselStripBlock = block.id === "carousel" || block.id === "carousel_2";
          const isCoursesBlock = block.id === "courses" || block.id === "new_courses";

          const wrapped = adminLayoutCanvas ? (
            <BlockWrapper
              block={block}
              isSelected={adminLayoutCanvas.selectedBlockId === block.id}
              onSelect={() => adminLayoutCanvas.onSelectBlock(block.id)}
              onResizeHeight={(heightPx) => adminLayoutCanvas.onBlockResizeHeight(block.id, heightPx)}
              blockLabel={LAYOUT_SECTION_LABELS[block.id] ?? block.id}
              skipBackgroundImage={false}
            >
              {content}
            </BlockWrapper>
          ) : (
            content
          );

          return (
            <div
              key={block.id}
              className={
                isFullWidth
                  ? `w-full${
                      isCarouselStripBlock
                        ? " relative max-md:z-[40] md:z-20"
                        : ""
                    }`
                  : isCoursesBlock
                    ? "relative w-full max-md:z-0"
                    : undefined
              }
            >
              {wrapped}
            </div>
          );
        })}
      </main>

    </div>
  );
}
