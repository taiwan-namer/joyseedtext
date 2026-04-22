"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import Link from "next/link";
import { ChevronLeft, ChevronUp, ChevronDown, Loader2, Save, Plus, Image as ImageIcon, GripVertical, ExternalLink, Pencil, X } from "lucide-react";
import {
  getFrontendSettings,
  updateLayoutBlocks,
  updateFullWidthImageUrl,
  updateHeroImageUrl,
  updateLogoUrl,
  updateHeaderBackgroundUrls,
  updateCarouselItemsPersist,
  uploadFullWidthImage,
  uploadHeroLayoutImage,
  uploadLogoLayoutImage,
  uploadHeaderBackgroundDesktop,
  uploadHeaderBackgroundMobile,
  uploadCarouselSlideImage,
  uploadHeroFloatingIcon,
  uploadLayoutBlockBackground,
} from "@/app/actions/frontendSettingsActions";
import { getCoursesForHomepage } from "@/app/actions/productActions";
import {
  LAYOUT_ADMIN_PREVIEW_VIEWPORT_WIDTH_PX,
  LAYOUT_SECTION_LABELS,
  DEFAULT_ABOUT_PAGE_URL,
  estimateIntrinsicMinHeightPxForBranchHomeBlock,
  getDefaultLayoutBlocks,
  normalizeAboutPageUrl,
  type CarouselItem,
  type FeaturedCategory,
  type HeroFloatingIcon,
  type LayoutBlock,
  formatFloatingIconSlotLabel,
} from "@/app/lib/frontendSettingsShared";
import { JOYSEED_ISLAND_WEB_URL } from "@/lib/mainSiteCanonical";
import type { Activity } from "@/app/lib/homeSectionTypes";
import { readImageNaturalSizeFromFile } from "@/lib/readImageNaturalSizeFromFile";
import LayoutCanvas from "./LayoutCanvas";
import {
  LAYOUT_MOBILE_PREVIEW_WIDTH_PX,
  LAYOUT_PREVIEW_BLOCK_HEIGHT,
  LAYOUT_PREVIEW_FLOATING_ICONS,
  LAYOUT_PREVIEW_READY,
  LAYOUT_PREVIEW_REQUEST_SYNC,
  LAYOUT_PREVIEW_SELECT_BLOCK,
  LAYOUT_PREVIEW_SELECT_FLOATING_ICON,
  LAYOUT_PREVIEW_SELECT_VIEWPORT_FLOATING_ICON,
  LAYOUT_PREVIEW_SYNC_TYPE,
  LAYOUT_PREVIEW_VIEWPORT_FLOATING_ICONS,
  type LayoutPreviewSyncPayload,
} from "./layoutPreviewSync";

/** 分站訪客首頁會顯示的區塊（與 `BranchSiteHomeView` 前台一致） */
const BRANCH_HOME_CANVAS_BLOCK_IDS: string[] = [
  "header",
  "hero",
  "featured_categories",
  "carousel",
  "courses_grid",
  "about",
  "faq",
  "contact",
];

/** 側欄「可加入」主清單：分站首頁會顯示的區塊 */
const ACTIVE_HOME_BLOCK_IDS: string[] = [...BRANCH_HOME_CANVAS_BLOCK_IDS];

/** 可從側欄額外加入的區塊（總站延伸版型） */
const OPTIONAL_LAYOUT_BLOCK_IDS: string[] = [
  "carousel_2",
  "full_width_image",
  "courses_list",
];

const ALL_ADDABLE_BLOCK_IDS = [...ACTIVE_HOME_BLOCK_IDS, ...OPTIONAL_LAYOUT_BLOCK_IDS];

/** 首頁版面編輯：圖檔建議尺寸（給店家） */
const HERO_MAIN_IMAGE_SIZE_HINT = "建議尺寸：寬 1920 px × 高 600 px";
const BLOCK_BACKGROUND_IMAGE_SIZE_HINT = "建議尺寸：寬 1920 px × 高 800 px";
/** 與畫布輪播區 aspect 12/5 一致 */
const CAROUSEL_SLIDE_IMAGE_SIZE_HINT = "建議尺寸：寬 1920 px × 高 800 px";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string" && result.trim()) {
        resolve(result);
        return;
      }
      reject(new Error("主圖轉換失敗"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("主圖轉換失敗"));
    reader.readAsDataURL(file);
  });
}

/** 側欄不顯示「裝飾圖座標／上傳裝飾圖」的區塊（主圖／輪播主圖除外；其餘多為固定版型或網格） */
const LAYOUT_BLOCKS_HIDE_FLOATING_ICONS_PANEL = new Set<string>([
  "featured_categories",
  "carousel",
  "carousel_2",
  "courses_grid",
  "new_courses",
  "popular_experiences",
  "faq",
  "contact",
  "footer",
]);

/** 依 block id 對應到「編輯內容」的後台頁面 */
const BLOCK_EDIT_LINKS: Record<string, { href: string; label: string }> = {
  featured_categories: { href: "/admin/layout", label: "首頁版面" },
  courses: { href: "/admin", label: "商品管理（課程）" },
  new_courses: { href: "/admin", label: "商品管理（課程）" },
  popular_experiences: { href: "/admin", label: "商品管理（課程）" },
  about: { href: "/admin/about", label: "關於我們" },
  faq: { href: "/admin/faq", label: "常見問題" },
  contact: { href: "/admin/settings", label: "基本資料（聯絡資訊）" },
  footer: { href: "/admin/layout", label: "首頁版面（頁尾內容）" },
  courses_grid: { href: "/admin", label: "商品管理（課程）" },
  courses_list: { href: "/admin", label: "商品管理（課程）" },
};

/** 桌機／手機各渲染一份，勿共用同一個 React element 物件（會導致互動異常） */
function BlockFloatingIconsPanel({
  block,
  heroFloatUploading,
  onUploadClick,
  editViewport,
  previewPxFromStored,
  storedPxFromPreview,
  onPatchIcon,
  onRemoveIcon,
  focusedIconId = null,
}: {
  block: LayoutBlock;
  heroFloatUploading: boolean;
  onUploadClick: () => void;
  /** 側欄編輯桌機或手機專用座標（與畫布點選連動） */
  editViewport: "desktop" | "mobile";
  previewPxFromStored: (n: number) => number;
  storedPxFromPreview: (n: number) => number;
  onPatchIcon: (iconId: string, patch: Partial<HeroFloatingIcon>) => void;
  onRemoveIcon: (iconId: string) => void;
  /** 與畫布點選連動，捲動側欄至該筆 */
  focusedIconId?: string | null;
}) {
  /** 寬高在輸入過程勿即時 clamp 為 16，否則打「50」會先變「16」再變「1650」 */
  const [dimDrafts, setDimDrafts] = useState<Record<string, string>>({});
  const [dimFocus, setDimFocus] = useState<string | null>(null);
  const dimKey = (iconId: string, axis: "w" | "h") => `${iconId}:${axis}`;
  const iconRowRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    if (!focusedIconId) return;
    const el = iconRowRefs.current[focusedIconId];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedIconId]);

  return (
    <div className="rounded-lg border border-amber-200/80 bg-white/90 p-3 space-y-3">
      <p className="text-xs text-gray-600 leading-relaxed">
        {editViewport === "mobile"
          ? "手機專用座標；尺寸依手機畫布縮放換算。完成後請按「儲存版面」。"
          : "尺寸依目前桌機畫布縮放換算（例：50% 時輸入 100px → 儲存為前台 200px）。完成後請按「儲存版面」。側欄「編號」與畫布區塊順序一致。"}
      </p>
      <div>
        <button
          type="button"
          onClick={onUploadClick}
          disabled={heroFloatUploading}
          className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          {heroFloatUploading ? "上傳中…" : "上傳裝飾圖"}
        </button>
      </div>
      {(block.floatingIcons?.length ?? 0) > 0 ? (
        <ul className="max-h-52 space-y-2 overflow-y-auto text-xs">
          {(block.floatingIcons ?? []).map((ic, idx) => {
            const wStored = editViewport === "mobile" ? (ic.widthPxMobile ?? ic.widthPx) : ic.widthPx;
            const hStored =
              editViewport === "mobile"
                ? (ic.heightPxMobile ?? ic.heightPx ?? ic.widthPx)
                : (ic.heightPx ?? ic.widthPx);
            return (
            <li
              key={ic.id}
              ref={(el) => {
                iconRowRefs.current[ic.id] = el;
              }}
              className={`flex flex-wrap items-center gap-2 border-b border-gray-100 pb-2 last:border-0 rounded-md transition-colors ${
                focusedIconId === ic.id ? "bg-amber-50 ring-2 ring-amber-400/80 -mx-1 px-1" : ""
              }`}
            >
              <span className="w-14 shrink-0 font-semibold text-amber-900 tabular-nums">
                {formatFloatingIconSlotLabel(idx)}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ic.imageUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded bg-gray-50 object-contain"
              />
              <label className="flex items-center gap-1">
                寬
                <input
                  type="number"
                  step={1}
                  value={
                    dimFocus === dimKey(ic.id, "w")
                      ? (dimDrafts[dimKey(ic.id, "w")] ?? String(previewPxFromStored(wStored)))
                      : previewPxFromStored(wStored)
                  }
                  onFocus={() => {
                    const k = dimKey(ic.id, "w");
                    setDimFocus(k);
                    setDimDrafts((d) => ({ ...d, [k]: String(previewPxFromStored(wStored)) }));
                  }}
                  onChange={(e) => {
                    setDimDrafts((d) => ({ ...d, [dimKey(ic.id, "w")]: e.target.value }));
                  }}
                  onBlur={() => {
                    const k = dimKey(ic.id, "w");
                    const raw = dimDrafts[k] ?? String(previewPxFromStored(wStored));
                    setDimFocus((f) => (f === k ? null : f));
                    setDimDrafts((d) => {
                      const n = { ...d };
                      delete n[k];
                      return n;
                    });
                    const v = parseInt(String(raw).trim(), 10);
                    if (Number.isFinite(v)) {
                      onPatchIcon(ic.id, { widthPx: storedPxFromPreview(Math.max(16, v)) });
                    }
                  }}
                  className="w-20 rounded border border-gray-300 px-1 py-0.5"
                />
                px(畫布)
              </label>
              <label className="flex items-center gap-1">
                高
                <input
                  type="number"
                  step={1}
                  value={
                    dimFocus === dimKey(ic.id, "h")
                      ? (dimDrafts[dimKey(ic.id, "h")] ?? String(previewPxFromStored(hStored)))
                      : previewPxFromStored(hStored)
                  }
                  onFocus={() => {
                    const k = dimKey(ic.id, "h");
                    setDimFocus(k);
                    setDimDrafts((d) => ({
                      ...d,
                      [k]: String(previewPxFromStored(hStored)),
                    }));
                  }}
                  onChange={(e) => {
                    setDimDrafts((d) => ({ ...d, [dimKey(ic.id, "h")]: e.target.value }));
                  }}
                  onBlur={() => {
                    const k = dimKey(ic.id, "h");
                    const raw = dimDrafts[k] ?? String(previewPxFromStored(hStored));
                    setDimFocus((f) => (f === k ? null : f));
                    setDimDrafts((d) => {
                      const n = { ...d };
                      delete n[k];
                      return n;
                    });
                    const v = parseInt(String(raw).trim(), 10);
                    if (Number.isFinite(v)) {
                      onPatchIcon(ic.id, { heightPx: storedPxFromPreview(Math.max(16, v)) });
                    }
                  }}
                  className="w-20 rounded border border-gray-300 px-1 py-0.5"
                />
                px(畫布)
              </label>
              <button
                type="button"
                className="ml-auto text-red-600 hover:underline"
                onClick={() => onRemoveIcon(ic.id)}
              >
                刪除
              </button>
            </li>
          );
          })}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">尚無裝飾圖，可先上傳一張。</p>
      )}
    </div>
  );
}

export default function AdminLayoutPage() {
  const [blocks, setBlocks] = useState<LayoutBlock[]>(getDefaultLayoutBlocks());
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const heroFloatFileRef = useRef<HTMLInputElement | null>(null);
  const viewportFloatFileRef = useRef<HTMLInputElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const mobilePreviewIframeRef = useRef<HTMLIFrameElement | null>(null);
  /** iframe postMessage 監聽器必須呼叫「當次 render」的同步函式，不可閉包舊的 postLayoutPreviewToIframe */
  const postLayoutPreviewToIframeRef = useRef<(() => void) | null>(null);
  const blockListItemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const rightEditorRef = useRef<HTMLDivElement | null>(null);
  const [editorPos, setEditorPos] = useState<{ top: number; left: number }>({ top: 96, left: 0 });
  const [canvasZoomPct, setCanvasZoomPct] = useState(50);
  /** 桌機畫布與手機 iframe 同步：固定模擬寬螢幕瀏覽器寬，主內容 max-w-7xl 置中，與前台左右留白一致 */
  const desktopCanvasViewportWidthPx = LAYOUT_ADMIN_PREVIEW_VIEWPORT_WIDTH_PX;
  /** 手機寬度 iframe 預覽專用，與桌機畫布預覽比例分開；預設 100% 以貼近前台手機 1:1 呈現。 */
  const [mobileCanvasZoomPct, setMobileCanvasZoomPct] = useState(100);
  /** 手機 iframe 目前實際可視寬度（px），用來同步手機版畫布設計寬。 */
  const [mobilePreviewViewportWidthPx, setMobilePreviewViewportWidthPx] = useState(
    LAYOUT_MOBILE_PREVIEW_WIDTH_PX
  );
  /** 側欄裝飾圖編輯：與「畫布開關」同步（桌機版／手機版） */
  const [floatingEditViewport, setFloatingEditViewport] = useState<"desktop" | "mobile">("desktop");
  /** 僅顯示一種畫布，避免同時捲動兩段預覽 */
  const [canvasViewportMode, setCanvasViewportMode] = useState<"desktop" | "mobile">("desktop");
  const canvasViewportModeRef = useRef<"desktop" | "mobile">("desktop");
  canvasViewportModeRef.current = canvasViewportMode;
  const [selectedFloatingIconId, setSelectedFloatingIconId] = useState<string | null>(null);
  const [viewportFloatingIcons, setViewportFloatingIcons] = useState<HeroFloatingIcon[]>([]);
  const [viewportSelectedFloatingIconId, setViewportSelectedFloatingIconId] = useState<string | null>(null);
  const [viewportFloatUploading, setViewportFloatUploading] = useState(false);
  /** 全螢幕裝飾：下拉選擇後按刪除 */
  const [viewportDeletePick, setViewportDeletePick] = useState<string>("");
  const mobileCanvasSectionRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const iframe = mobilePreviewIframeRef.current;
    if (!iframe) return;
    const measure = () => {
      const w = Math.max(320, Math.round(iframe.clientWidth || LAYOUT_MOBILE_PREVIEW_WIDTH_PX));
      setMobilePreviewViewportWidthPx((prev) => (prev === w ? prev : w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(iframe);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [canvasViewportMode]);
  useEffect(() => {
    if (viewportDeletePick && !viewportFloatingIcons.some((x) => x.id === viewportDeletePick)) {
      setViewportDeletePick("");
    }
  }, [viewportFloatingIcons, viewportDeletePick]);
  useEffect(() => {
    setFloatingEditViewport(canvasViewportMode === "mobile" ? "mobile" : "desktop");
  }, [canvasViewportMode]);
  const canvasScale = Math.min(100, Math.max(25, canvasZoomPct)) / 100;
  const mobileCanvasScale = Math.min(100, Math.max(25, mobileCanvasZoomPct)) / 100;
  /** 區塊高度輸入：與目前可見畫布（桌機／手機）預覽縮放一致 */
  const layoutHeightScale =
    canvasViewportMode === "mobile" ? mobileCanvasScale : canvasScale;
  const previewScaleForPanel = floatingEditViewport === "mobile" ? mobileCanvasScale : canvasScale;
  const previewPxFromStored = (storedPx: number): number =>
    Math.max(1, Math.round(storedPx * previewScaleForPanel));
  const storedPxFromPreview = (previewPx: number): number =>
    Math.max(16, Math.round(previewPx / Math.max(0.01, previewScaleForPanel)));

  /** 畫布上視覺高度（螢幕 px）≈ 前台 heightPx × 預覽縮放，僅供說明用 */
  const blockHeightCanvasPreviewPx = (stored: number | null | undefined) =>
    stored != null && stored > 0 ? Math.round(stored * layoutHeightScale) : null;
  /** 與側欄「目前高度」文案一致：前台為主；未設定時附內建版型概算高度 */
  const layoutBlockHeightStatusLine = (storedPx: number | null | undefined, blockId?: string | null) => {
    const approx =
      blockId != null && blockId !== ""
        ? estimateIntrinsicMinHeightPxForBranchHomeBlock(blockId)
        : null;
    if (storedPx == null || storedPx <= 0) {
      if (approx != null) {
        return `自動（前台此區內建版面約 ${approx} px；須大於此值才會明顯加高）`;
      }
      return "自動";
    }
    if (layoutHeightScale >= 0.999) return `前台 ${storedPx} px（與畫布 1:1）`;
    const preview = blockHeightCanvasPreviewPx(storedPx) ?? 0;
    const pct = Math.round(layoutHeightScale * 100);
    return `前台 ${storedPx} px；畫布預覽約 ${preview} px（預覽縮放 ${pct}%）`;
  };

  const layoutBlockHeightInputPlaceholder = (blockId: string) => {
    const a = estimateIntrinsicMinHeightPxForBranchHomeBlock(blockId);
    return a != null ? `留空＝自動（內建約 ${a} px）` : "自動";
  };

  // 畫布用資料（與前台一致）
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
  const [aboutContent, setAboutContent] = useState<string | null>(null);
  const [navAboutLabel, setNavAboutLabel] = useState("關於我們");
  const [aboutPageUrl, setAboutPageUrl] = useState(DEFAULT_ABOUT_PAGE_URL);
  const [navCoursesLabel, setNavCoursesLabel] = useState("課程資訊");
  const [navBookingLabel, setNavBookingLabel] = useState("課程預約");
  const [navFaqLabel, setNavFaqLabel] = useState("常見問題");
  const [fullWidthImageUrl, setFullWidthImageUrl] = useState<string | null>(null);
  /** 選檔後本機預覽（blob:）；儲存版面時再上傳 R2 */
  const [fullWidthImageDraftUrl, setFullWidthImageDraftUrl] = useState<string | null>(null);
  const [fullWidthImagePendingFile, setFullWidthImagePendingFile] = useState<File | null>(null);
  const fullWidthImageFileRef = useRef<HTMLInputElement | null>(null);
  /** 首頁主圖：選檔預覽，儲存時上傳 R2 */
  const [heroImageDraftUrl, setHeroImageDraftUrl] = useState<string | null>(null);
  /** 手機 iframe 預覽需跨 document，blob URL 可能不可用，改用 data URL 同步。 */
  const [heroImageDraftMobilePreviewUrl, setHeroImageDraftMobilePreviewUrl] = useState<string | null>(null);
  const [heroImagePendingFile, setHeroImagePendingFile] = useState<File | null>(null);
  const heroImageFileRef = useRef<HTMLInputElement | null>(null);
  /** LOGO／頁首背景 */
  const [logoDraftUrl, setLogoDraftUrl] = useState<string | null>(null);
  const [logoPendingFile, setLogoPendingFile] = useState<File | null>(null);
  const logoFileRef = useRef<HTMLInputElement | null>(null);
  const [headerBgDeskDraftUrl, setHeaderBgDeskDraftUrl] = useState<string | null>(null);
  const [headerBgDeskPendingFile, setHeaderBgDeskPendingFile] = useState<File | null>(null);
  const headerBgDeskFileRef = useRef<HTMLInputElement | null>(null);
  const [headerBgMobDraftUrl, setHeaderBgMobDraftUrl] = useState<string | null>(null);
  const [headerBgMobPendingFile, setHeaderBgMobPendingFile] = useState<File | null>(null);
  const headerBgMobFileRef = useRef<HTMLInputElement | null>(null);
  /** 輪播各則圖：index → blob 預覽／待上傳檔 */
  const [carouselSlideDraftUrls, setCarouselSlideDraftUrls] = useState<Record<number, string>>({});
  const [carouselSlidePendingFiles, setCarouselSlidePendingFiles] = useState<Record<number, File>>({});
  const carouselSlideIndexRef = useRef(0);
  const carouselSlideFileRef = useRef<HTMLInputElement | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [featuredCategories, setFeaturedCategories] = useState<FeaturedCategory[]>([]);
  const [featuredSectionIconUrl, setFeaturedSectionIconUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [headerBackgroundUrl, setHeaderBackgroundUrl] = useState<string | null>(null);
  const [headerBackgroundMobileUrl, setHeaderBackgroundMobileUrl] = useState<string | null>(null);
  const [showProductMenu, setShowProductMenu] = useState(false);
  const [pageBackgroundUrl, setPageBackgroundUrl] = useState<string | null>(null);
  const [pageBackgroundMobileUrl, setPageBackgroundMobileUrl] = useState<string | null>(null);
  const [pageBackgroundExtensionColor, setPageBackgroundExtensionColor] = useState<string | null>(null);
  const [footerBackgroundUrl, setFooterBackgroundUrl] = useState<string | null>(null);
  const [footerBackgroundMobileUrl, setFooterBackgroundMobileUrl] = useState<string | null>(null);
  const [heroBackgroundUrl, setHeroBackgroundUrl] = useState<string | null>(null);
  const [heroBackgroundMobileUrl, setHeroBackgroundMobileUrl] = useState<string | null>(null);
  const [canvasHeroTitle, setCanvasHeroTitle] = useState<string | null>(null);
  const [homeCarouselMidStripBackgroundUrl, setHomeCarouselMidStripBackgroundUrl] = useState<string | null>(null);
  const [homeCarouselSectionBackgroundUrl, setHomeCarouselSectionBackgroundUrl] = useState<string | null>(null);
  const [homeMidBannerSectionBackgroundUrl, setHomeMidBannerSectionBackgroundUrl] = useState<string | null>(null);
  const [homeMidBannerImageUrl, setHomeMidBannerImageUrl] = useState<string | null>(null);
  const [homeMidBannerLinkUrl, setHomeMidBannerLinkUrl] = useState<string | null>(null);
  const [homeCoursesBlockBackgroundUrl, setHomeCoursesBlockBackgroundUrl] = useState<string | null>(null);
  const [homeCoursesBlockBackgroundMobileUrl, setHomeCoursesBlockBackgroundMobileUrl] = useState<string | null>(null);
  const [homeNewCoursesIconUrl, setHomeNewCoursesIconUrl] = useState<string | null>(null);
  const [heroFloatUploading, setHeroFloatUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getFrontendSettings(), getCoursesForHomepage()])
      .then(([s, coursesRes]) => {
        if (cancelled) return;
        // 先拿後台已儲存的積木，若沒有就用預設；再同步成「目前首頁實際使用」的區塊集合
        // 以資料庫儲存為準；勿強制補回預設積木（否則刪除並儲存後重新整理會復原）
        const nextBlocks =
          s.layoutBlocks.length > 0
            ? [...s.layoutBlocks].sort((a, b) => a.order - b.order).map((b, i) => ({ ...b, order: i }))
            : [];
        setBlocks(nextBlocks);
        setHeroImageUrl(s.heroImageUrl);
        setCarouselItems(s.carouselItems.length > 0 ? s.carouselItems : [
          { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
          { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
          { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
        ]);
        setAboutContent(s.aboutContent ?? null);
        setNavAboutLabel(s.navAboutLabel || "關於我們");
        setAboutPageUrl(normalizeAboutPageUrl(s.aboutPageUrl));
        setNavCoursesLabel(s.navCoursesLabel || "課程資訊");
        setNavBookingLabel(s.navBookingLabel || "課程預約");
        setNavFaqLabel(s.navFaqLabel || "常見問題");
        setFullWidthImageUrl(s.fullWidthImageUrl ?? null);
        setFeaturedCategories(s.featuredCategories?.length ? s.featuredCategories : []);
        setFeaturedSectionIconUrl(s.featuredSectionIconUrl ?? null);
        setLogoUrl(s.logoUrl ?? null);
        setHeaderBackgroundUrl(s.headerBackgroundUrl ?? null);
        setHeaderBackgroundMobileUrl(s.headerBackgroundMobileUrl ?? null);
        setShowProductMenu(s.showProductMenu === true);
        setPageBackgroundUrl(s.pageBackgroundUrl ?? null);
        setPageBackgroundMobileUrl(s.pageBackgroundMobileUrl ?? null);
        setPageBackgroundExtensionColor(s.pageBackgroundExtensionColor ?? null);
        setFooterBackgroundUrl(s.footerBackgroundUrl ?? null);
        setFooterBackgroundMobileUrl(s.footerBackgroundMobileUrl ?? null);
        setHeroBackgroundUrl(s.heroBackgroundUrl ?? null);
        setHeroBackgroundMobileUrl(s.heroBackgroundMobileUrl ?? null);
        setCanvasHeroTitle(s.heroTitle ?? null);
        setHomeCarouselMidStripBackgroundUrl(s.homeCarouselMidStripBackgroundUrl ?? null);
        setHomeCarouselSectionBackgroundUrl(s.homeCarouselSectionBackgroundUrl ?? null);
        setHomeMidBannerSectionBackgroundUrl(s.homeMidBannerSectionBackgroundUrl ?? null);
        setHomeMidBannerImageUrl(s.homeMidBannerImageUrl ?? null);
        setHomeMidBannerLinkUrl(s.homeMidBannerLinkUrl ?? null);
        setHomeCoursesBlockBackgroundUrl(s.homeCoursesBlockBackgroundUrl ?? null);
        setHomeCoursesBlockBackgroundMobileUrl(s.homeCoursesBlockBackgroundMobileUrl ?? null);
        setHomeNewCoursesIconUrl(s.homeNewCoursesIconUrl ?? null);
        setViewportFloatingIcons(s.viewportFloatingIcons ?? []);
        if (coursesRes.success && coursesRes.data.length > 0) {
          setActivities(
            coursesRes.data.map((c) => ({
              id: c.id,
              title: c.title,
              price: c.salePrice != null && c.price != null && c.salePrice < c.price ? c.salePrice : c.price ?? 0,
              stock: c.capacity ?? 0,
              imageUrl: c.imageUrl ?? null,
              detailHref: `/course/${c.slug ?? c.id}`,
              ageTags: c.sidebarOptionLabels ?? c.ageTags ?? [],
              category: "課程",
            }))
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBlocks(getDefaultLayoutBlocks());
          setAboutPageUrl(DEFAULT_ABOUT_PAGE_URL);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentIds = blocks.map((b) => b.id);
  const availableToAdd = ALL_ADDABLE_BLOCK_IDS.filter((id) => !currentIds.includes(id));
  const availableBranchHome = availableToAdd.filter((id) => BRANCH_HOME_CANVAS_BLOCK_IDS.includes(id));
  const availableOptionalBlocks = availableToAdd.filter((id) => OPTIONAL_LAYOUT_BLOCK_IDS.includes(id));

  const addBlock = (sectionId: string) => {
    const nextOrder = blocks.length;
    setBlocks([
      ...blocks,
      {
        id: sectionId,
        order: nextOrder,
        heightPx: null,
        backgroundImageUrl: null,
        enabled: true,
        title: LAYOUT_SECTION_LABELS[sectionId] ?? null,
        floatingIcons: [],
      },
    ]);
    setMessage(null);
  };

  const getBlockIndex = (blockId: string) => blocks.findIndex((b) => b.id === blockId);

  /** 依畫布內被選區塊的視窗座標定位浮動編輯面板；`measuredPanelHeight` 有值時可避免底部被裁切 */
  const computeEditorPosition = (blockId: string, measuredPanelHeight?: number): { top: number; left: number } => {
    const root = canvasWrapRef.current;
    const panelWidth = 320;
    const viewportPadding = 16;
    const defaultLeft = Math.max(viewportPadding, window.innerWidth - panelWidth - viewportPadding);
    if (!root) return { top: 96, left: defaultLeft };
    const target = root.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
    if (!target) return { top: 96, left: defaultLeft };
    const rect = target.getBoundingClientRect();
    let left = rect.right + 12;
    if (left + panelWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - panelWidth - viewportPadding;
    }
    left = Math.max(viewportPadding, left);

    const margin = 12;
    /** 面板頂部略高於區塊頂部，較容易看到與點選 */
    const aboveBlockPx = 16;
    const fallbackH = Math.min(460, Math.max(200, window.innerHeight - margin * 2));
    const panelH =
      measuredPanelHeight != null && measuredPanelHeight > 48
        ? measuredPanelHeight
        : rightEditorRef.current?.offsetHeight && rightEditorRef.current.offsetHeight > 48
          ? rightEditorRef.current.offsetHeight
          : fallbackH;

    let top = rect.top - aboveBlockPx;
    const minTop = margin;
    const maxTop = window.innerHeight - margin - panelH;
    if (maxTop >= minTop) {
      top = Math.max(minTop, Math.min(top, maxTop));
    } else {
      top = minTop;
    }
    return { top, left };
  };

  const handleSelectBlock = (
    blockId: string,
    options?: { scrollCanvasIntoView?: boolean; editViewport?: "desktop" | "mobile" }
  ) => {
    const ev =
      options?.editViewport ??
      (canvasViewportModeRef.current === "mobile" ? "mobile" : "desktop");
    setFloatingEditViewport(ev);
    setSelectedBlockId(blockId);
    setViewportSelectedFloatingIconId(null);
    if (typeof window !== "undefined") {
      setEditorPos(computeEditorPosition(blockId));
    }
    if (!options?.scrollCanvasIntoView) return;
    if (canvasViewportModeRef.current === "mobile") {
      mobileCanvasSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      const root = canvasWrapRef.current;
      if (!root) return;
      const target = root.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const ph = rightEditorRef.current?.offsetHeight;
          setEditorPos(computeEditorPosition(blockId, ph));
        });
      });
    }
  };

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };
  const handleDragLeave = () => setDragOverIndex(null);
  const handleDrop = (toIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(null);
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (Number.isNaN(fromIndex) || fromIndex === toIndex) return;
    const next = [...blocks];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    setBlocks(next.map((b, i) => ({ ...b, order: i })));
    setMessage(null);
  };
  const handleDragEnd = () => setDragOverIndex(null);

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return;
    if (selectedBlockId === blocks[index]?.id) setSelectedBlockId(null);
    const next = blocks.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i }));
    setBlocks(next);
    setMessage(null);
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...blocks];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setBlocks(next.map((b, i) => ({ ...b, order: i })));
    setMessage(null);
  };

  const moveDown = (index: number) => {
    if (index >= blocks.length - 1) return;
    const next = [...blocks];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setBlocks(next.map((b, i) => ({ ...b, order: i })));
    setMessage(null);
  };

  const setBlockHeightByIndex = (index: number, heightPx: number | null) => {
    const next = [...blocks];
    next[index] = { ...next[index], heightPx: heightPx && heightPx > 0 ? heightPx : null };
    setBlocks(next);
  };

  const setBlockBackgroundUrlByIndex = (index: number, url: string | null) => {
    const next = [...blocks];
    next[index] = { ...next[index], backgroundImageUrl: url };
    setBlocks(next);
  };

  const setBlockEnabledByIndex = (index: number, enabled: boolean) => {
    const next = [...blocks];
    next[index] = { ...next[index], enabled };
    setBlocks(next);
  };

  const setBlockTitleByIndex = (index: number, title: string | null) => {
    const next = [...blocks];
    next[index] = { ...next[index], title: title && title.trim() ? title.trim() : null };
    setBlocks(next);
  };

  const onBlockResizeHeight = (blockId: string, heightPx: number | null) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, heightPx: heightPx && heightPx > 0 ? heightPx : null } : b))
    );
  };

  const handleBackgroundUpload = async (file: File) => {
    if (selectedBlockId == null) return;
    const index = getBlockIndex(selectedBlockId);
    if (index < 0) return;
    setUploadingBlockId(selectedBlockId);
    setMessage(null);
    const formData = new FormData();
    formData.set("background_image", file);
    try {
      const result = await uploadLayoutBlockBackground(formData);
      if (result.success) {
        setBlockBackgroundUrlByIndex(index, result.url);
        setMessage({ type: "success", text: "背景圖已上傳至 R2，請按「儲存版面」寫入資料庫" });
      } else {
        setMessage({ type: "error", text: result.error });
      }
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "上傳失敗" });
    } finally {
      setUploadingBlockId(null);
    }
  };

  const updateBlockFloatingIcons = (
    blockId: string,
    updater: (prev: HeroFloatingIcon[]) => HeroFloatingIcon[]
  ) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, floatingIcons: updater(b.floatingIcons ?? []) } : b))
    );
  };

  const patchFloatingIcon = useCallback(
    (blockId: string, iconId: string, patch: Partial<HeroFloatingIcon>) => {
      if (floatingEditViewport === "mobile") {
        const m: Partial<HeroFloatingIcon> = {};
        if (patch.widthPx != null) m.widthPxMobile = patch.widthPx;
        if (patch.heightPx != null) m.heightPxMobile = patch.heightPx;
        if (patch.leftPct != null) m.leftPctMobile = patch.leftPct;
        if (patch.topPct != null) m.topPctMobile = patch.topPct;
        updateBlockFloatingIcons(blockId, (icons) =>
          icons.map((x) => (x.id === iconId ? { ...x, ...m } : x))
        );
        return;
      }
      updateBlockFloatingIcons(blockId, (icons) =>
        icons.map((x) => (x.id === iconId ? { ...x, ...patch } : x))
      );
    },
    [floatingEditViewport, updateBlockFloatingIcons]
  );

  const handleSelectBlockRef = useRef(handleSelectBlock);
  handleSelectBlockRef.current = handleSelectBlock;

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as Record<string, unknown>;
      if (!d || typeof d !== "object") return;
      if (d.type === LAYOUT_PREVIEW_READY || d.type === LAYOUT_PREVIEW_REQUEST_SYNC) {
        postLayoutPreviewToIframeRef.current?.();
        return;
      }
      if (d.type === LAYOUT_PREVIEW_SELECT_BLOCK) {
        handleSelectBlockRef.current(String(d.blockId), {
          scrollCanvasIntoView: false,
          editViewport: "mobile",
        });
        return;
      }
      if (d.type === LAYOUT_PREVIEW_SELECT_FLOATING_ICON) {
        setCanvasViewportMode("mobile");
        setSelectedFloatingIconId(String(d.iconId));
        handleSelectBlockRef.current(String(d.blockId), {
          scrollCanvasIntoView: false,
          editViewport: "mobile",
        });
        return;
      }
      if (d.type === LAYOUT_PREVIEW_FLOATING_ICONS) {
        setFloatingEditViewport("mobile");
        const blockId = String(d.blockId);
        const icons = d.icons as HeroFloatingIcon[];
        setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, floatingIcons: icons } : b)));
        return;
      }
      if (d.type === LAYOUT_PREVIEW_BLOCK_HEIGHT) {
        setFloatingEditViewport("mobile");
        const blockId = String(d.blockId);
        const heightPx = d.heightPx as number | null | undefined;
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === blockId ? { ...b, heightPx: heightPx && heightPx > 0 ? heightPx : null } : b
          )
        );
        return;
      }
      if (d.type === LAYOUT_PREVIEW_VIEWPORT_FLOATING_ICONS) {
        setFloatingEditViewport("mobile");
        setViewportFloatingIcons(d.icons as HeroFloatingIcon[]);
        return;
      }
      if (d.type === LAYOUT_PREVIEW_SELECT_VIEWPORT_FLOATING_ICON) {
        setCanvasViewportMode("mobile");
        setViewportSelectedFloatingIconId(
          d.id == null || d.id === "" ? null : String(d.id)
        );
        setSelectedBlockId(null);
        setSelectedFloatingIconId(null);
        return;
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const handleViewportFloatFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setViewportFloatUploading(true);
    setMessage(null);
    try {
      const natural = await readImageNaturalSizeFromFile(file).catch(() => ({ width: 72, height: 72 }));
      const widthPx = Math.max(16, Math.round(natural.width));
      const heightPx = Math.max(16, Math.round(natural.height));
      const fd = new FormData();
      fd.set("float_image", file);
      const r = await uploadHeroFloatingIcon(fd);
      if (r.success) {
        const id =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `vf-${Date.now()}`;
        setViewportFloatingIcons((prev) => [
          ...prev,
          {
            id,
            imageUrl: r.url,
            leftPct: 92,
            topPct: 40,
            widthPx,
            heightPx,
            enabled: true,
          },
        ]);
        setViewportSelectedFloatingIconId(id);
        setSelectedBlockId(null);
        setMessage({ type: "success", text: "全螢幕裝飾圖已上傳，請在畫布拖曳定位後按「儲存版面」。" });
      } else {
        setMessage({ type: "error", text: r.error });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "上傳失敗" });
    } finally {
      setViewportFloatUploading(false);
    }
  };

  const handleFloatFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || selectedBlockId == null) return;
    setHeroFloatUploading(true);
    setMessage(null);
    try {
      const natural = await readImageNaturalSizeFromFile(file).catch(() => ({ width: 72, height: 72 }));
      const widthPx = Math.max(16, Math.round(natural.width));
      const heightPx = Math.max(16, Math.round(natural.height));
      const fd = new FormData();
      fd.set("float_image", file);
      const r = await uploadHeroFloatingIcon(fd);
      if (r.success) {
        const id =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `hf-${Date.now()}`;
        updateBlockFloatingIcons(selectedBlockId, (prev) => [
          ...prev,
          {
            id,
            imageUrl: r.url,
            leftPct: 50,
            topPct: 35,
            widthPx,
            heightPx,
            enabled: true,
          },
        ]);
        setMessage({ type: "success", text: "裝飾圖已上傳，請在畫布拖曳定位後按「儲存版面」。" });
      } else {
        setMessage({ type: "error", text: r.error });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "上傳失敗" });
    } finally {
      setHeroFloatUploading(false);
    }
  };

  const displayFullWidthImageUrl = useMemo(
    () => fullWidthImageDraftUrl ?? fullWidthImageUrl,
    [fullWidthImageDraftUrl, fullWidthImageUrl]
  );

  const displayHeroImageUrl = useMemo(
    () => heroImageDraftUrl ?? heroImageUrl,
    [heroImageDraftUrl, heroImageUrl]
  );
  const mobilePreviewHeroImageUrl = useMemo(() => {
    if (displayHeroImageUrl?.startsWith("blob:")) {
      return heroImageDraftMobilePreviewUrl;
    }
    return displayHeroImageUrl;
  }, [displayHeroImageUrl, heroImageDraftMobilePreviewUrl]);

  const displayLogoUrl = useMemo(() => logoDraftUrl ?? logoUrl, [logoDraftUrl, logoUrl]);

  const displayHeaderBackgroundUrl = useMemo(
    () => headerBgDeskDraftUrl ?? headerBackgroundUrl,
    [headerBgDeskDraftUrl, headerBackgroundUrl]
  );

  const displayHeaderBackgroundMobileUrl = useMemo(
    () => headerBgMobDraftUrl ?? headerBackgroundMobileUrl,
    [headerBgMobDraftUrl, headerBackgroundMobileUrl]
  );

  const displayCarouselItems = useMemo(
    () =>
      carouselItems.map((item, i) => ({
        ...item,
        imageUrl: (carouselSlideDraftUrls[i] ?? item.imageUrl) as string | null,
      })),
    [carouselItems, carouselSlideDraftUrls]
  );

  const handleFullWidthImageFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "請選擇圖片檔案" });
      return;
    }
    setFullWidthImageDraftUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setFullWidthImagePendingFile(file);
    setMessage(null);
  };

  const clearFullWidthImageDraft = () => {
    setFullWidthImageDraftUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFullWidthImagePendingFile(null);
  };

  const handleHeroImageFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "請選擇圖片檔案" });
      return;
    }
    setHeroImageDraftUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setHeroImageDraftMobilePreviewUrl(null);
    void readFileAsDataUrl(file)
      .then((url) => {
        setHeroImageDraftMobilePreviewUrl(url);
      })
      .catch(() => {
        setMessage({ type: "error", text: "主圖預覽轉換失敗，請重新選擇檔案" });
      });
    setHeroImagePendingFile(file);
    setMessage(null);
  };

  const clearHeroImageDraft = () => {
    setHeroImageDraftUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setHeroImageDraftMobilePreviewUrl(null);
    setHeroImagePendingFile(null);
  };

  const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "請選擇圖片檔案" });
      return;
    }
    setLogoDraftUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setLogoPendingFile(file);
    setMessage(null);
  };

  const clearLogoDraft = () => {
    setLogoDraftUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setLogoPendingFile(null);
  };

  const handleHeaderBgDeskFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "請選擇圖片檔案" });
      return;
    }
    setHeaderBgDeskDraftUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setHeaderBgDeskPendingFile(file);
    setMessage(null);
  };

  const clearHeaderBgDeskDraft = () => {
    setHeaderBgDeskDraftUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setHeaderBgDeskPendingFile(null);
  };

  const handleHeaderBgMobFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "請選擇圖片檔案" });
      return;
    }
    setHeaderBgMobDraftUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setHeaderBgMobPendingFile(file);
    setMessage(null);
  };

  const clearHeaderBgMobDraft = () => {
    setHeaderBgMobDraftUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setHeaderBgMobPendingFile(null);
  };

  const handleCarouselSlideFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "請選擇圖片檔案" });
      return;
    }
    const idx = carouselSlideIndexRef.current;
    setCarouselSlideDraftUrls((prev) => {
      const next = { ...prev };
      const old = next[idx];
      if (old) URL.revokeObjectURL(old);
      next[idx] = URL.createObjectURL(file);
      return next;
    });
    setCarouselSlidePendingFiles((prev) => ({ ...prev, [idx]: file }));
    setMessage(null);
  };

  const clearCarouselSlideDraft = (index: number) => {
    setCarouselSlideDraftUrls((prev) => {
      const u = prev[index];
      if (u) URL.revokeObjectURL(u);
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setCarouselSlidePendingFiles((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      if (fullWidthImagePendingFile) {
        const fd = new FormData();
        fd.set("full_width_image", fullWidthImagePendingFile);
        const up = await uploadFullWidthImage(fd);
        if (!up.success) {
          setMessage({ type: "error", text: up.error });
          return;
        }
        const savedMeta = await updateFullWidthImageUrl(up.url);
        if (!savedMeta.success) {
          setMessage({ type: "error", text: savedMeta.error });
          return;
        }
        setFullWidthImageUrl(up.url);
        setFullWidthImageDraftUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setFullWidthImagePendingFile(null);
      }

      if (heroImagePendingFile) {
        const fd = new FormData();
        fd.set("hero_image", heroImagePendingFile);
        const up = await uploadHeroLayoutImage(fd);
        if (!up.success) {
          setMessage({ type: "error", text: up.error });
          return;
        }
        const savedMeta = await updateHeroImageUrl(up.url);
        if (!savedMeta.success) {
          setMessage({ type: "error", text: savedMeta.error });
          return;
        }
        setHeroImageUrl(up.url);
        setHeroImageDraftUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setHeroImagePendingFile(null);
      }

      const pendingCarouselKeys = Object.keys(carouselSlidePendingFiles);
      if (pendingCarouselKeys.length > 0) {
        let nextCarousel = carouselItems.map((c) => ({ ...c }));
        for (const k of pendingCarouselKeys) {
          const i = Number(k);
          const file = carouselSlidePendingFiles[i];
          if (!file) continue;
          const fd = new FormData();
          fd.set("carousel_slide_image", file);
          fd.set("carousel_upload_index", String(i));
          const up = await uploadCarouselSlideImage(fd);
          if (!up.success) {
            setMessage({ type: "error", text: up.error });
            return;
          }
          if (nextCarousel[i]) {
            nextCarousel[i] = { ...nextCarousel[i], imageUrl: up.url };
          }
        }
        const savedC = await updateCarouselItemsPersist(nextCarousel);
        if (!savedC.success) {
          setMessage({ type: "error", text: savedC.error });
          return;
        }
        setCarouselItems(nextCarousel);
        setCarouselSlideDraftUrls((prev) => {
          for (const k of pendingCarouselKeys) {
            const u = prev[Number(k)];
            if (u) URL.revokeObjectURL(u);
          }
          return {};
        });
        setCarouselSlidePendingFiles({});
      }

      if (logoPendingFile) {
        const fd = new FormData();
        fd.set("store_logo", logoPendingFile);
        const up = await uploadLogoLayoutImage(fd);
        if (!up.success) {
          setMessage({ type: "error", text: up.error });
          return;
        }
        const savedMeta = await updateLogoUrl(up.url);
        if (!savedMeta.success) {
          setMessage({ type: "error", text: savedMeta.error });
          return;
        }
        setLogoUrl(up.url);
        setLogoDraftUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setLogoPendingFile(null);
      }

      let deskUrl = headerBackgroundUrl;
      let mobUrl = headerBackgroundMobileUrl;
      if (headerBgDeskPendingFile) {
        const fd = new FormData();
        fd.set("header_background", headerBgDeskPendingFile);
        const up = await uploadHeaderBackgroundDesktop(fd);
        if (!up.success) {
          setMessage({ type: "error", text: up.error });
          return;
        }
        deskUrl = up.url;
      }
      if (headerBgMobPendingFile) {
        const fd = new FormData();
        fd.set("header_background_mobile", headerBgMobPendingFile);
        const up = await uploadHeaderBackgroundMobile(fd);
        if (!up.success) {
          setMessage({ type: "error", text: up.error });
          return;
        }
        mobUrl = up.url;
      }
      if (headerBgDeskPendingFile || headerBgMobPendingFile) {
        const savedH = await updateHeaderBackgroundUrls(deskUrl, mobUrl);
        if (!savedH.success) {
          setMessage({ type: "error", text: savedH.error });
          return;
        }
        setHeaderBackgroundUrl(deskUrl);
        setHeaderBackgroundMobileUrl(mobUrl);
        setHeaderBgDeskDraftUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setHeaderBgDeskPendingFile(null);
        setHeaderBgMobDraftUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setHeaderBgMobPendingFile(null);
      }

      const result = await updateLayoutBlocks(blocks, viewportFloatingIcons);
      if (result.success) {
        setMessage({ type: "success", text: result.message ?? "已儲存" });
        /** 與 DB／前台解析結果對齊：避免儲存後桌機畫布本地 state 與 `getFrontendSettings` 解析後不一致 */
        try {
          const s = await getFrontendSettings();
          setViewportFloatingIcons(s.viewportFloatingIcons ?? []);
          if (s.layoutBlocks.length > 0) {
            setBlocks(
              [...s.layoutBlocks].sort((a, b) => a.order - b.order).map((b, i) => ({ ...b, order: i }))
            );
          }
        } catch {
          /* 略：保留本地狀態；重新整理後仍會與 DB 一致 */
        }
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  };

  const selectedBlock = selectedBlockId ? blocks.find((b) => b.id === selectedBlockId) : null;
  const selectedIndex = selectedBlockId != null ? getBlockIndex(selectedBlockId) : -1;
  const editLink = selectedBlockId ? BLOCK_EDIT_LINKS[selectedBlockId] : null;

  const fullWidthImageEditorBlock =
    selectedBlockId === "full_width_image" ? (
      <div className="space-y-2 rounded-lg border border-amber-200/80 bg-white/90 p-3">
        <p className="text-xs text-gray-600 leading-relaxed">
          選圖後會立即顯示於畫布；按「儲存版面」時再上傳至 R2 並寫入前台網址。
        </p>
        <button
          type="button"
          onClick={() => fullWidthImageFileRef.current?.click()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
        >
          <ImageIcon className="h-4 w-4 shrink-0" />
          {displayFullWidthImageUrl ? "更換單張大圖" : "上傳單張大圖"}
        </button>
        {fullWidthImagePendingFile ? (
          <p className="text-[11px] text-amber-800">
            待上傳：{fullWidthImagePendingFile.name}（須按「儲存版面」）
          </p>
        ) : null}
        {displayFullWidthImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayFullWidthImageUrl}
            alt=""
            className="w-full max-h-36 rounded-md border border-gray-200 object-contain bg-gray-50"
          />
        ) : null}
        {fullWidthImagePendingFile || fullWidthImageDraftUrl ? (
          <button
            type="button"
            onClick={clearFullWidthImageDraft}
            className="text-xs text-gray-600 hover:text-red-600 underline"
          >
            取消待上傳預覽
          </button>
        ) : null}
      </div>
    ) : null;

  const heroImageEditorBlock =
    selectedBlockId === "hero" || selectedBlockId === "hero_carousel" ? (
      <div className="space-y-2 rounded-lg border border-amber-200/80 bg-white/90 p-3">
        <p className="text-xs text-gray-600 leading-relaxed">
          首頁主圖：選檔後立即顯示於畫布；按「儲存版面」時再上傳至 R2。{HERO_MAIN_IMAGE_SIZE_HINT}。
        </p>
        <button
          type="button"
          onClick={() => heroImageFileRef.current?.click()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
        >
          <ImageIcon className="h-4 w-4 shrink-0" />
          {displayHeroImageUrl ? "更換首頁主圖" : "上傳首頁主圖"}
        </button>
        {heroImagePendingFile ? (
          <p className="text-[11px] text-amber-800">
            待上傳：{heroImagePendingFile.name}（須按「儲存版面」）
          </p>
        ) : null}
        {displayHeroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayHeroImageUrl}
            alt=""
            className="w-full max-h-36 rounded-md border border-gray-200 object-cover bg-gray-50"
          />
        ) : null}
        {heroImagePendingFile || heroImageDraftUrl ? (
          <button
            type="button"
            onClick={clearHeroImageDraft}
            className="text-xs text-gray-600 hover:text-red-600 underline"
          >
            取消待上傳預覽
          </button>
        ) : null}
      </div>
    ) : null;

  const headerAssetEditorBlock =
    selectedBlockId === "header" ? (
      <div className="space-y-3 rounded-lg border border-amber-200/80 bg-white/90 p-3">
        <p className="text-xs text-gray-600 leading-relaxed">
          LOGO 與頁首背景：預覽於畫布；按「儲存版面」時再上傳至 R2 並寫入設定。
        </p>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-gray-700">LOGO</span>
          <button
            type="button"
            onClick={() => logoFileRef.current?.click()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            <ImageIcon className="h-4 w-4 shrink-0" />
            {displayLogoUrl ? "更換 LOGO" : "上傳 LOGO"}
          </button>
          {logoPendingFile ? (
            <p className="text-[11px] text-amber-800">待上傳：{logoPendingFile.name}</p>
          ) : null}
          {displayLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayLogoUrl}
              alt=""
              className="max-h-16 w-auto rounded border border-gray-200 object-contain bg-gray-50"
            />
          ) : null}
          {logoPendingFile || logoDraftUrl ? (
            <button type="button" onClick={clearLogoDraft} className="text-xs text-gray-600 hover:text-red-600 underline">
              取消 LOGO 預覽
            </button>
          ) : null}
        </div>
        <div className="space-y-1.5 border-t border-amber-100/80 pt-2">
          <span className="text-xs font-medium text-gray-700">頁首背景（桌機）</span>
          <button
            type="button"
            onClick={() => headerBgDeskFileRef.current?.click()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <ImageIcon className="h-4 w-4 shrink-0" />
            {displayHeaderBackgroundUrl ? "更換桌機背景" : "上傳桌機背景"}
          </button>
          {headerBgDeskPendingFile ? (
            <p className="text-[11px] text-amber-800">待上傳：{headerBgDeskPendingFile.name}</p>
          ) : null}
          {displayHeaderBackgroundUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayHeaderBackgroundUrl}
              alt=""
              className="w-full max-h-20 rounded object-cover border border-gray-200"
            />
          ) : null}
          {headerBgDeskPendingFile || headerBgDeskDraftUrl ? (
            <button
              type="button"
              onClick={clearHeaderBgDeskDraft}
              className="text-xs text-gray-600 hover:text-red-600 underline"
            >
              取消桌機背景預覽
            </button>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-gray-700">頁首背景（手機，可選）</span>
          <button
            type="button"
            onClick={() => headerBgMobFileRef.current?.click()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <ImageIcon className="h-4 w-4 shrink-0" />
            {displayHeaderBackgroundMobileUrl ? "更換手機背景" : "上傳手機背景"}
          </button>
          {headerBgMobPendingFile ? (
            <p className="text-[11px] text-amber-800">待上傳：{headerBgMobPendingFile.name}</p>
          ) : null}
          {displayHeaderBackgroundMobileUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayHeaderBackgroundMobileUrl}
              alt=""
              className="w-full max-h-20 rounded object-cover border border-gray-200"
            />
          ) : null}
          {headerBgMobPendingFile || headerBgMobDraftUrl ? (
            <button
              type="button"
              onClick={clearHeaderBgMobDraft}
              className="text-xs text-gray-600 hover:text-red-600 underline"
            >
              取消手機背景預覽
            </button>
          ) : null}
        </div>
      </div>
    ) : null;

  const carouselSlidesEditorBlock =
    selectedBlockId === "carousel" || selectedBlockId === "carousel_2" ? (
      <div className="space-y-3 rounded-lg border border-amber-200/80 bg-white/90 p-3">
        <p className="text-xs text-gray-600 leading-relaxed">
          輪播圖：每一則可單獨選圖，預覽於畫布；{CAROUSEL_SLIDE_IMAGE_SIZE_HINT}。按「儲存版面」時再上傳至 R2。
        </p>
        <ul className="space-y-3 max-h-64 overflow-y-auto">
          {displayCarouselItems.map((item, index) => (
            <li
              key={item.id}
              className="rounded-md border border-gray-200 bg-gray-50/80 p-2 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-700">第 {index + 1} 則</span>
                {carouselSlidePendingFiles[index] ? (
                  <span className="text-[10px] text-amber-800 truncate">{carouselSlidePendingFiles[index].name}</span>
                ) : null}
              </div>
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="w-full max-h-24 rounded object-cover border border-gray-200 bg-white"
                />
              ) : (
                <p className="text-[11px] text-gray-500">尚未設定圖片</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    carouselSlideIndexRef.current = index;
                    carouselSlideFileRef.current?.click();
                  }}
                  className="text-xs font-medium text-amber-800 hover:underline"
                >
                  選擇／更換圖片
                </button>
                {carouselSlidePendingFiles[index] || carouselSlideDraftUrls[index] ? (
                  <button
                    type="button"
                    onClick={() => clearCarouselSlideDraft(index)}
                    className="text-xs text-gray-600 hover:text-red-600 underline"
                  >
                    取消此則預覽
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  useEffect(() => {
    setSelectedFloatingIconId(null);
  }, [selectedBlockId]);

  useEffect(() => {
    if (!selectedBlockId) return;
    const node = blockListItemRefs.current[selectedBlockId];
    if (!node) return;
    node.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [selectedBlockId]);

  useEffect(() => {
    if (!rightEditorRef.current) return;
    rightEditorRef.current.scrollTo({ top: 0, behavior: "auto" });
  }, [selectedBlockId]);

  /** 面板內容高度變化或選區變更後，依實際高度重算位置，避免底部超出視窗 */
  useLayoutEffect(() => {
    if (!selectedBlockId) return;
    const id = selectedBlockId;
    const run = () => {
      const ph = rightEditorRef.current?.offsetHeight;
      setEditorPos(computeEditorPosition(id, ph));
    };
    run();
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedBlockId, blocks, canvasZoomPct, canvasViewportMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedBlockId) return;
    const onResize = () => {
      const ph = rightEditorRef.current?.offsetHeight;
      setEditorPos(computeEditorPosition(selectedBlockId, ph));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [selectedBlockId]);

  /** 畫布或整頁捲動時依區塊視窗座標更新浮動面板 */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedBlockId) return;
    const root = canvasWrapRef.current;
    const onScroll = () => {
      const ph = rightEditorRef.current?.offsetHeight;
      setEditorPos(computeEditorPosition(selectedBlockId, ph));
    };
    root?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [selectedBlockId]);

  const layoutPreviewPayload = useMemo(
    (): LayoutPreviewSyncPayload => ({
      blocks,
      selectedBlockId,
      selectedFloatingIconId,
      mobileCanvasZoomPct,
      mobilePreviewViewportWidthPx,
      desktopCanvasZoomPct: canvasZoomPct,
      desktopCanvasViewportWidthPx,
      heroImageUrl: mobilePreviewHeroImageUrl,
      heroImageFile: heroImagePendingFile,
      carouselItems: displayCarouselItems,
      aboutContent,
      navAboutLabel,
      navCoursesLabel,
      navBookingLabel,
      navFaqLabel,
      activities,
      fullWidthImageUrl: displayFullWidthImageUrl,
      logoUrl: displayLogoUrl,
      headerBackgroundUrl: displayHeaderBackgroundUrl,
      headerBackgroundMobileUrl: displayHeaderBackgroundMobileUrl,
      showProductMenu,
      pageBackgroundUrl,
      pageBackgroundMobileUrl,
      pageBackgroundExtensionColor,
      footerBackgroundUrl,
      footerBackgroundMobileUrl,
      featuredCategories,
      featuredSectionIconUrl,
      heroBackgroundUrl,
      heroBackgroundMobileUrl,
      heroTitle: canvasHeroTitle,
      homeCarouselMidStripBackgroundUrl,
      homeCarouselSectionBackgroundUrl,
      homeMidBannerSectionBackgroundUrl,
      homeMidBannerImageUrl,
      homeMidBannerLinkUrl,
      homeCoursesBlockBackgroundUrl,
      homeCoursesBlockBackgroundMobileUrl,
      homeNewCoursesIconUrl,
      aboutPageUrl,
      viewportFloatingIcons,
      viewportSelectedFloatingIconId,
    }),
    [
      blocks,
      selectedBlockId,
      selectedFloatingIconId,
      mobileCanvasZoomPct,
      mobilePreviewViewportWidthPx,
      canvasZoomPct,
      desktopCanvasViewportWidthPx,
      mobilePreviewHeroImageUrl,
      heroImagePendingFile,
      displayCarouselItems,
      aboutContent,
      navAboutLabel,
      navCoursesLabel,
      navBookingLabel,
      navFaqLabel,
      activities,
      displayFullWidthImageUrl,
      displayLogoUrl,
      displayHeaderBackgroundUrl,
      displayHeaderBackgroundMobileUrl,
      showProductMenu,
      pageBackgroundUrl,
      pageBackgroundMobileUrl,
      pageBackgroundExtensionColor,
      footerBackgroundUrl,
      footerBackgroundMobileUrl,
      featuredCategories,
      featuredSectionIconUrl,
      heroBackgroundUrl,
      heroBackgroundMobileUrl,
      canvasHeroTitle,
      homeCarouselMidStripBackgroundUrl,
      homeCarouselSectionBackgroundUrl,
      homeMidBannerSectionBackgroundUrl,
      homeMidBannerImageUrl,
      homeMidBannerLinkUrl,
      homeCoursesBlockBackgroundUrl,
      homeCoursesBlockBackgroundMobileUrl,
      homeNewCoursesIconUrl,
      aboutPageUrl,
      viewportFloatingIcons,
      viewportSelectedFloatingIconId,
    ]
  );

  const postLayoutPreviewToIframe = useCallback(() => {
    const w = mobilePreviewIframeRef.current?.contentWindow;
    if (!w) return;
    w.postMessage(
      { type: LAYOUT_PREVIEW_SYNC_TYPE, payload: layoutPreviewPayload },
      window.location.origin
    );
  }, [layoutPreviewPayload]);

  const postLayoutPreviewToIframeWithZoom = useCallback(
    (nextZoomPct: number) => {
      const w = mobilePreviewIframeRef.current?.contentWindow;
      if (!w) return;
      w.postMessage(
        {
          type: LAYOUT_PREVIEW_SYNC_TYPE,
          payload: { ...layoutPreviewPayload, mobileCanvasZoomPct: nextZoomPct },
        },
        window.location.origin
      );
    },
    [layoutPreviewPayload]
  );

  postLayoutPreviewToIframeRef.current = postLayoutPreviewToIframe;

  useEffect(() => {
    postLayoutPreviewToIframe();
  }, [postLayoutPreviewToIframe]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        載入中…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          返回後台
        </Link>
      </div>

      <h1 className="text-xl font-bold text-gray-900">首頁版面</h1>
      <p className="text-sm text-gray-600 max-w-xl">
        拖曳左側順序、點畫布調整區塊；區塊高度請依目前畫布「預覽比例」輸入（會換算為前台實際像素）。完成後按「儲存版面」。
      </p>

      {message && (
        <div
          role="alert"
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/*
        桌機與手機各有一份編輯面板時，不可在兩處重複掛同一個 ref 的 <input type="file" />（React 只會保留最後一個，導致上傳按鈕失效）。
      */}
      <input
        ref={heroFloatFileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleFloatFile}
      />
      <input
        ref={viewportFloatFileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleViewportFloatFile}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleBackgroundUpload(file);
          e.target.value = "";
        }}
      />
      <input
        ref={fullWidthImageFileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleFullWidthImageFileChange}
      />
      <input
        ref={heroImageFileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleHeroImageFileChange}
      />
      <input
        ref={logoFileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleLogoFileChange}
      />
      <input
        ref={headerBgDeskFileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleHeaderBgDeskFileChange}
      />
      <input
        ref={headerBgMobFileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleHeaderBgMobFileChange}
      />
      <input
        ref={carouselSlideFileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={handleCarouselSlideFileChange}
      />

      {/* 左側鎖定 + 中間畫布；右側改成點積木才浮出編輯面板 */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:min-h-[420px]">
        {/* 左側：固定鎖在左邊，畫布滑到最下方也看得到 */}
        <aside className="md:w-44 xl:w-56 shrink-0">
          <div className="flex flex-col gap-4 md:fixed md:top-20 md:w-44 xl:w-56 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto pr-1">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 shrink-0">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">可加入的積木</h2>
            {availableToAdd.length === 0 ? (
              <p className="text-xs text-gray-500">已全部加入</p>
            ) : (
              <div className="space-y-3">
                {availableBranchHome.length > 0 ? (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                      分站首頁會顯示
                    </h3>
                    <ul className="space-y-1.5">
                      {availableBranchHome.map((id) => (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => addBlock(id)}
                            className="w-full flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 hover:bg-amber-50 hover:border-amber-200 transition-colors"
                          >
                            <Plus className="h-4 w-4 shrink-0 text-amber-600" />
                            {LAYOUT_SECTION_LABELS[id] ?? id}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {availableOptionalBlocks.length > 0 ? (
                  <div className="mt-3 pt-3 border-t border-gray-200/80">
                    <ul className="space-y-1.5">
                      {availableOptionalBlocks.map((id) => (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => addBlock(id)}
                            className="w-full flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 hover:bg-amber-50 hover:border-amber-200 transition-colors"
                          >
                            <Plus className="h-4 w-4 shrink-0 text-amber-600" />
                            {LAYOUT_SECTION_LABELS[id] ?? id}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold text-gray-800 mb-3 shrink-0">目前的積木</h2>
            <p className="text-xs text-gray-500 mb-2 shrink-0">拖曳左側 ⋮⋮ 可調整順序</p>
            <ul className="space-y-1 overflow-y-auto flex-1 min-h-0">
              {blocks.map((b, i) => (
                <li
                  key={`${b.id}-${i}`}
                  ref={(el) => {
                    blockListItemRefs.current[b.id] = el;
                  }}
                  className={`flex items-center gap-0 rounded-lg border transition-colors ${
                    dragOverIndex === i ? "border-amber-400 bg-amber-50" : selectedBlockId === b.id ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300" : "border-transparent"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverIndex(i);
                  }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={handleDrop(i)}
                >
                  <div
                    draggable
                    onDragStart={handleDragStart(i)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleSelectBlock(b.id, { scrollCanvasIntoView: true })}
                    className={`flex items-center gap-2 flex-1 min-w-0 py-1.5 pl-2 pr-1 cursor-pointer hover:bg-gray-100 rounded-l-lg ${
                      dragOverIndex === i ? "bg-amber-50" : selectedBlockId === b.id ? "bg-amber-50" : ""
                    }`}
                    title="點選可編輯此區塊 · 拖曳 ⋮⋮ 可調整順序"
                  >
                    <GripVertical className="h-4 w-4 text-gray-500 shrink-0" aria-hidden />
                    <span className="flex-1 text-sm text-gray-700 truncate">
                      <span className="text-gray-400 font-medium tabular-nums mr-1">編號 {i + 1}</span>
                      {LAYOUT_SECTION_LABELS[b.id] ?? b.id}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBlock(i);
                    }}
                    disabled={blocks.length <= 1}
                    className="p-1.5 rounded-r-lg hover:bg-red-100 text-red-600 disabled:opacity-40 text-xs shrink-0"
                    aria-label="移除"
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          </div>
          </div>
        </aside>

        {/* 中間：畫布（保留左側空間；右側浮窗改覆蓋不壓縮畫布） */}
        <div className="flex-1 min-w-0 flex flex-col items-stretch overflow-x-visible">
          <div className="w-full shrink-0 mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-sm font-semibold text-gray-800">編輯畫布</span>
            <div
              className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 shadow-sm"
              role="group"
              aria-label="切換桌機或手機畫布"
            >
              <button
                type="button"
                onClick={() => setCanvasViewportMode("desktop")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  canvasViewportMode === "desktop"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-gray-700 hover:bg-amber-50"
                }`}
              >
                桌機版
              </button>
              <button
                type="button"
                onClick={() => setCanvasViewportMode("mobile")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  canvasViewportMode === "mobile"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-gray-700 hover:bg-amber-50"
                }`}
              >
                手機版
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-l border-gray-200 pl-2 sm:pl-3">
              <button
                type="button"
                onClick={() => viewportFloatFileRef.current?.click()}
                disabled={viewportFloatUploading}
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                {viewportFloatUploading ? "上傳中…" : "上傳裝飾圖"}
              </button>
              <select
                value={viewportDeletePick}
                onChange={(e) => setViewportDeletePick(e.target.value)}
                className="max-w-[min(100%,200px)] rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800"
                aria-label="選擇要刪除的全螢幕裝飾圖"
              >
                <option value="">選擇編號…</option>
                {viewportFloatingIcons.map((ic, idx) => (
                  <option key={ic.id} value={ic.id}>
                    編號 {idx + 1}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!viewportDeletePick}
                onClick={() => {
                  if (!viewportDeletePick) return;
                  setViewportFloatingIcons((prev) => prev.filter((x) => x.id !== viewportDeletePick));
                  setViewportSelectedFloatingIconId((cur) => (cur === viewportDeletePick ? null : cur));
                  setViewportDeletePick("");
                }}
                className="shrink-0 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                刪除選取
              </button>
            </div>
          </div>

          {canvasViewportMode === "desktop" ? (
          <div className="w-full max-w-full rounded-xl border border-gray-200 bg-gray-100 shadow-lg shrink-0">
            <div className="px-3 py-2 bg-gray-200 border-b border-gray-300 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
              <span className="text-center sm:text-left flex-1 min-w-[120px] text-gray-500">
                桌機預覽
              </span>
              <div className="flex flex-wrap items-center gap-1.5 justify-center">
                <span className="text-gray-500 shrink-0">預覽比例</span>
                {[40, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setCanvasZoomPct(pct)}
                    className={`rounded-md px-2 py-1 font-medium transition-colors ${
                      canvasZoomPct === pct
                        ? "bg-amber-500 text-white"
                        : "bg-white/90 text-gray-700 border border-gray-300 hover:bg-amber-50"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            <div
              ref={canvasWrapRef}
              className="max-h-[min(78vh,920px)] overflow-y-auto overflow-x-auto p-2 sm:p-3"
            >
              <LayoutCanvas
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                onSelectBlock={(id) => handleSelectBlock(id, { scrollCanvasIntoView: false })}
                onBlockResizeHeight={onBlockResizeHeight}
                stretchContainer
                floatingIconsCoordinateMode="desktop"
                selectedFloatingIconId={selectedFloatingIconId}
                onSelectFloatingIcon={(blockId, iconId) => {
                  setViewportSelectedFloatingIconId(null);
                  setSelectedFloatingIconId(iconId);
                  handleSelectBlock(blockId, { scrollCanvasIntoView: false });
                }}
                designWidthPx={LAYOUT_ADMIN_PREVIEW_VIEWPORT_WIDTH_PX}
                zoomPercent={canvasZoomPct}
                heroImageUrl={displayHeroImageUrl}
                carouselItems={displayCarouselItems}
                aboutContent={aboutContent}
                navAboutLabel={navAboutLabel}
                navCoursesLabel={navCoursesLabel}
                navBookingLabel={navBookingLabel}
                navFaqLabel={navFaqLabel}
                activities={activities}
                fullWidthImageUrl={displayFullWidthImageUrl}
                logoUrl={displayLogoUrl}
                headerBackgroundUrl={displayHeaderBackgroundUrl}
                headerBackgroundMobileUrl={displayHeaderBackgroundMobileUrl}
                showProductMenu={showProductMenu}
                pageBackgroundUrl={pageBackgroundUrl}
                pageBackgroundMobileUrl={pageBackgroundMobileUrl}
                pageBackgroundExtensionColor={pageBackgroundExtensionColor}
                footerBackgroundUrl={footerBackgroundUrl}
                footerBackgroundMobileUrl={footerBackgroundMobileUrl}
                featuredCategories={featuredCategories}
                featuredSectionIconUrl={featuredSectionIconUrl}
                heroBackgroundUrl={heroBackgroundUrl}
                heroBackgroundMobileUrl={heroBackgroundMobileUrl}
                heroTitle={canvasHeroTitle}
                homeCarouselMidStripBackgroundUrl={homeCarouselMidStripBackgroundUrl}
                homeCarouselSectionBackgroundUrl={homeCarouselSectionBackgroundUrl}
                homeMidBannerSectionBackgroundUrl={homeMidBannerSectionBackgroundUrl}
                homeMidBannerImageUrl={homeMidBannerImageUrl}
                homeMidBannerLinkUrl={homeMidBannerLinkUrl}
                homeCoursesBlockBackgroundUrl={homeCoursesBlockBackgroundUrl}
                homeCoursesBlockBackgroundMobileUrl={homeCoursesBlockBackgroundMobileUrl}
                homeNewCoursesIconUrl={homeNewCoursesIconUrl}
                aboutPageUrl={aboutPageUrl}
                onBlockFloatingIconsChange={(blockId, next) =>
                  setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, floatingIcons: next } : b)))
                }
                viewportFloatingIcons={viewportFloatingIcons}
                onViewportFloatingIconsChange={setViewportFloatingIcons}
                viewportSelectedFloatingIconId={viewportSelectedFloatingIconId}
                onSelectViewportFloatingIcon={(id) => {
                  setViewportSelectedFloatingIconId(id);
                  if (id !== null) {
                    setSelectedBlockId(null);
                    setSelectedFloatingIconId(null);
                  }
                }}
                onHeroImagePickRequest={() => {
                  handleSelectBlock("hero", { scrollCanvasIntoView: false });
                  heroImageFileRef.current?.click();
                }}
              />
            </div>
          </div>
          ) : null}

          {canvasViewportMode === "mobile" ? (
          <div ref={mobileCanvasSectionRef} className="w-full max-w-full rounded-xl border border-gray-200 bg-gray-100 shadow-lg shrink-0">
            <div className="px-3 py-2 bg-gray-200 border-b border-gray-300 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
              <div className="space-y-0.5 min-w-0 flex-1">
                <span className="font-medium text-gray-800">手機寬度預覽</span>
                <p className="text-gray-600 leading-snug">
                  寬度 {mobilePreviewViewportWidthPx}px；可在此 iframe 內點區塊、拖曳裝飾圖（寫入手機專用座標，與桌機分開）。下方比例僅影響此預覽。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 justify-end shrink-0">
                <span className="text-gray-500 shrink-0">手機預覽比例</span>
                {[40, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setMobileCanvasZoomPct(pct);
                      // 立即同步到 iframe，避免僅靠 effect 鏈造成視覺延遲或未更新。
                      postLayoutPreviewToIframeWithZoom(pct);
                    }}
                    className={`rounded-md px-2 py-1 font-medium transition-colors ${
                      mobileCanvasZoomPct === pct
                        ? "bg-amber-500 text-white"
                        : "bg-white/90 text-gray-700 border border-gray-300 hover:bg-amber-50"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 sm:p-4 flex justify-center overflow-x-auto">
              <iframe
                ref={mobilePreviewIframeRef}
                title="首頁版面手機寬度預覽"
                src="/admin/layout/preview"
                className="w-full max-w-[430px] border border-gray-300 rounded-lg bg-white shadow"
                style={{ height: "min(78vh, 920px)" }}
                onLoad={postLayoutPreviewToIframe}
              />
            </div>
          </div>
          ) : null}

          <div className="mt-4 flex items-center gap-3 shrink-0 pb-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isPending ? "儲存中…" : "儲存版面"}
            </button>
            <span className="text-sm text-gray-500">儲存後前台首頁將依此版面顯示</span>
          </div>
        </div>
        {/* 手機版：編輯面板仍顯示在畫布下方 */}
        <aside className="md:hidden w-full">
          {selectedBlock && selectedIndex >= 0 && (
            <div ref={rightEditorRef} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Pencil className="h-4 w-4 text-amber-600" />
                編輯此區塊
              </h2>
              <p className="text-xs text-gray-600">
                {LAYOUT_SECTION_LABELS[selectedBlock.id] ?? selectedBlock.id}
              </p>

              {selectedBlock.id !== "footer" ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700">啟用</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={selectedBlock.enabled !== false}
                      onClick={() => setBlockEnabledByIndex(selectedIndex, selectedBlock.enabled === false)}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
                        selectedBlock.enabled !== false ? "bg-amber-500 border-amber-500" : "bg-gray-200 border-gray-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                          selectedBlock.enabled !== false ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">區塊標題（前台顯示）</label>
                    <input
                      type="text"
                      value={selectedBlock.title ?? ""}
                      onChange={(e) => setBlockTitleByIndex(selectedIndex, e.target.value || null)}
                      placeholder={LAYOUT_SECTION_LABELS[selectedBlock.id] ?? ""}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-600 leading-relaxed rounded-lg border border-amber-100 bg-white/80 p-3">
                  頁尾為固定版權區塊，無法變更啟用、標題、高度、背景或裝飾圖。前台版權列下方附有
                  <a
                    href={JOYSEED_ISLAND_WEB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mx-0.5 font-medium text-amber-800 underline break-all"
                  >
                    童趣島官網
                  </a>
                  連結。
                </p>
              )}

              {fullWidthImageEditorBlock}
              {heroImageEditorBlock}
              {headerAssetEditorBlock}
              {carouselSlidesEditorBlock}

              {editLink && (
                <Link
                  href={editLink.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  {editLink.label}
                </Link>
              )}

              {!LAYOUT_BLOCKS_HIDE_FLOATING_ICONS_PANEL.has(selectedBlock.id) ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200/80 bg-white/90 p-2">
                    <span className="text-xs font-medium text-gray-700">裝飾圖座標（與上方畫布開關同步）：</span>
                    <button
                      type="button"
                      onClick={() => setCanvasViewportMode("desktop")}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                        canvasViewportMode === "desktop"
                          ? "bg-amber-500 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-amber-50"
                      }`}
                    >
                      桌機
                    </button>
                    <button
                      type="button"
                      onClick={() => setCanvasViewportMode("mobile")}
                      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                        canvasViewportMode === "mobile"
                          ? "bg-amber-500 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:bg-amber-50"
                      }`}
                    >
                      手機
                    </button>
                  </div>
                  <BlockFloatingIconsPanel
                    block={selectedBlock}
                    heroFloatUploading={heroFloatUploading}
                    onUploadClick={() => heroFloatFileRef.current?.click()}
                    editViewport={floatingEditViewport}
                    previewPxFromStored={previewPxFromStored}
                    storedPxFromPreview={storedPxFromPreview}
                    onPatchIcon={(iconId, patch) => patchFloatingIcon(selectedBlock.id, iconId, patch)}
                    onRemoveIcon={(iconId) =>
                      updateBlockFloatingIcons(selectedBlock.id, (p) => p.filter((x) => x.id !== iconId))
                    }
                    focusedIconId={selectedFloatingIconId}
                  />
                </>
              ) : null}

              {selectedBlock.id !== "footer" ? (
                <>
                  <div>
                    <p className="text-xs font-medium text-amber-700 mb-1">
                      目前高度：{layoutBlockHeightStatusLine(selectedBlock.heightPx, selectedBlock.id)}
                    </p>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      區塊最小高度（前台 px，與訪客畫面一致）
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={
                        selectedBlock.heightPx != null && selectedBlock.heightPx > 0
                          ? selectedBlock.heightPx
                          : ""
                      }
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        if (v === "") {
                          setBlockHeightByIndex(selectedIndex, null);
                          return;
                        }
                        const n = parseInt(v, 10);
                        if (!Number.isFinite(n) || n < 0) return;
                        setBlockHeightByIndex(selectedIndex, n === 0 ? null : Math.max(1, n));
                      }}
                      placeholder={layoutBlockHeightInputPlaceholder(selectedBlock.id)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <div className="mb-1 space-y-0.5">
                      <label className="block text-xs font-medium text-gray-700">區塊背景圖</label>
                      <p className="text-left text-[11px] leading-snug text-gray-500">{BLOCK_BACKGROUND_IMAGE_SIZE_HINT}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingBlockId === selectedBlockId}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {uploadingBlockId === selectedBlockId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                      {selectedBlock.backgroundImageUrl ? "更換背景圖" : "上傳背景圖"}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </aside>
      </div>

      {/* 桌機版：點積木時，編輯面板浮出在該積木右邊 */}
      {selectedBlock && selectedIndex >= 0 && (
        <div
          ref={rightEditorRef}
          className="hidden md:block fixed z-40 w-[320px]"
          style={{ top: editorPos.top, left: editorPos.left }}
        >
          <div className="relative rounded-xl border border-amber-200 bg-amber-50/95 backdrop-blur-sm p-4 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto shadow-xl">
            <button
              type="button"
              aria-label="關閉編輯面板"
              onClick={() => setSelectedBlockId(null)}
              className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-amber-100 hover:text-gray-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Pencil className="h-4 w-4 text-amber-600" />
              編輯此區塊
            </h2>
            <p className="text-xs text-gray-600">
              {LAYOUT_SECTION_LABELS[selectedBlock.id] ?? selectedBlock.id}
            </p>

            {selectedBlock.id !== "footer" ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-700">啟用</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={selectedBlock.enabled !== false}
                    onClick={() => setBlockEnabledByIndex(selectedIndex, selectedBlock.enabled === false)}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
                      selectedBlock.enabled !== false ? "bg-amber-500 border-amber-500" : "bg-gray-200 border-gray-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                        selectedBlock.enabled !== false ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">區塊標題（前台顯示）</label>
                  <input
                    type="text"
                    value={selectedBlock.title ?? ""}
                    onChange={(e) => setBlockTitleByIndex(selectedIndex, e.target.value || null)}
                    placeholder={LAYOUT_SECTION_LABELS[selectedBlock.id] ?? ""}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-600 leading-relaxed rounded-lg border border-amber-100 bg-white/80 p-3">
                頁尾為固定版權區塊，無法變更啟用、標題、高度、背景或裝飾圖。前台版權列下方附有
                <a
                  href={JOYSEED_ISLAND_WEB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mx-0.5 font-medium text-amber-800 underline break-all"
                >
                  童趣島官網
                </a>
                連結。
              </p>
            )}

            {fullWidthImageEditorBlock}
            {heroImageEditorBlock}
            {headerAssetEditorBlock}
            {carouselSlidesEditorBlock}

            {editLink && (
              <Link
                href={editLink.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                {editLink.label}
              </Link>
            )}

            {!LAYOUT_BLOCKS_HIDE_FLOATING_ICONS_PANEL.has(selectedBlock.id) ? (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200/80 bg-white/90 p-2">
                  <span className="text-xs font-medium text-gray-700">裝飾圖座標（與上方畫布開關同步）：</span>
                  <button
                    type="button"
                    onClick={() => setCanvasViewportMode("desktop")}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      canvasViewportMode === "desktop"
                        ? "bg-amber-500 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-amber-50"
                    }`}
                  >
                    桌機
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasViewportMode("mobile")}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      canvasViewportMode === "mobile"
                        ? "bg-amber-500 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:bg-amber-50"
                    }`}
                  >
                    手機
                  </button>
                </div>
                <BlockFloatingIconsPanel
                  block={selectedBlock}
                  heroFloatUploading={heroFloatUploading}
                  onUploadClick={() => heroFloatFileRef.current?.click()}
                  editViewport={floatingEditViewport}
                  previewPxFromStored={previewPxFromStored}
                  storedPxFromPreview={storedPxFromPreview}
                  onPatchIcon={(iconId, patch) => patchFloatingIcon(selectedBlock.id, iconId, patch)}
                  onRemoveIcon={(iconId) =>
                    updateBlockFloatingIcons(selectedBlock.id, (p) => p.filter((x) => x.id !== iconId))
                  }
                  focusedIconId={selectedFloatingIconId}
                />
              </>
            ) : null}

            {selectedBlock.id !== "footer" ? (
              <>
                <div>
                  <p className="text-xs font-medium text-amber-700 mb-1">
                    目前高度：{layoutBlockHeightStatusLine(selectedBlock.heightPx, selectedBlock.id)}
                  </p>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    區塊最小高度（前台 px，與訪客畫面一致）
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={
                      selectedBlock.heightPx != null && selectedBlock.heightPx > 0
                        ? selectedBlock.heightPx
                        : ""
                    }
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v === "") {
                        setBlockHeightByIndex(selectedIndex, null);
                        return;
                      }
                      const n = parseInt(v, 10);
                      if (!Number.isFinite(n) || n < 0) return;
                      setBlockHeightByIndex(selectedIndex, n === 0 ? null : Math.max(1, n));
                    }}
                    placeholder={layoutBlockHeightInputPlaceholder(selectedBlock.id)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <div className="mb-1 space-y-0.5">
                    <label className="block text-xs font-medium text-gray-700">區塊背景圖</label>
                    <p className="text-left text-[11px] leading-snug text-gray-500">{BLOCK_BACKGROUND_IMAGE_SIZE_HINT}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingBlockId === selectedBlockId}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {uploadingBlockId === selectedBlockId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                    {selectedBlock.backgroundImageUrl ? "更換背景圖" : "上傳背景圖"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
