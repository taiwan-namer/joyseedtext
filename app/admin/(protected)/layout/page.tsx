"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronUp, ChevronDown, Loader2, Save, Plus, Image as ImageIcon, GripVertical, ExternalLink, Pencil, X } from "lucide-react";
import {
  getFrontendSettings,
  updateLayoutBlocks,
  uploadHeroFloatingIcon,
  uploadLayoutBlockBackground,
} from "@/app/actions/frontendSettingsActions";
import { getCoursesForHomepage } from "@/app/actions/productActions";
import {
  LAYOUT_SECTION_LABELS,
  DEFAULT_ABOUT_PAGE_URL,
  getDefaultLayoutBlocks,
  normalizeAboutPageUrl,
  type FeaturedCategory,
  type HeroFloatingIcon,
  type LayoutBlock,
  formatFloatingIconSlotLabel,
} from "@/app/lib/frontendSettingsShared";
import type { CarouselItem } from "@/app/lib/frontendSettingsShared";
import type { Activity } from "@/app/lib/homeSectionTypes";
import { readImageNaturalSizeFromFile } from "@/lib/readImageNaturalSizeFromFile";
import LayoutCanvas from "./LayoutCanvas";
import {
  LAYOUT_MOBILE_PREVIEW_WIDTH_PX,
  LAYOUT_PREVIEW_BLOCK_HEIGHT,
  LAYOUT_PREVIEW_FLOATING_ICONS,
  LAYOUT_PREVIEW_SELECT_BLOCK,
  LAYOUT_PREVIEW_SELECT_FLOATING_ICON,
  LAYOUT_PREVIEW_SYNC_TYPE,
  type LayoutPreviewSyncPayload,
} from "./layoutPreviewSync";

/** 後台畫布預覽上限寬度（維持桌機版預覽比例） */
const CANVAS_MAX_WIDTH_PX = 1280;

/**
 * 畫布預覽與分站首頁（`app/page.tsx`／`BranchSiteHomeView`）一致：頁首、主圖、輪播、熱門課程列、關於／FAQ／聯絡、頁尾。
 * 側欄仍可管理其他區塊 ID（精選分館、新上架等），但該類區塊目前不在此分站首頁畫面中顯示。
 */
const ACTIVE_HOME_BLOCK_IDS: string[] = [
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

/** 可從側欄額外加入的區塊（不在預設完整首頁順序內） */
const OPTIONAL_LAYOUT_BLOCK_IDS: string[] = [
  "hero_carousel",
  "carousel_2",
  "full_width_image",
  "courses_grid",
  "courses_list",
];

const ALL_ADDABLE_BLOCK_IDS = [...ACTIVE_HOME_BLOCK_IDS, ...OPTIONAL_LAYOUT_BLOCK_IDS];

/** 依 block id 對應到「編輯內容」的後台頁面 */
const BLOCK_EDIT_LINKS: Record<string, { href: string; label: string }> = {
  header: { href: "/admin/frontend-settings", label: "前台設定（LOGO／頁首背景）" },
  hero: { href: "/admin/frontend-settings", label: "前台設定（首頁大圖）" },
  featured_categories: { href: "/admin/frontend-settings", label: "前台設定" },
  carousel: { href: "/admin/frontend-settings", label: "前台設定（輪播）" },
  courses: { href: "/admin", label: "商品管理（課程）" },
  new_courses: { href: "/admin", label: "商品管理（課程）" },
  popular_experiences: { href: "/admin", label: "商品管理（課程）" },
  about: { href: "/admin/about", label: "關於我們" },
  faq: { href: "/admin/faq", label: "常見問題" },
  contact: { href: "/admin/settings", label: "基本資料（聯絡資訊）" },
  footer: { href: "/admin/frontend-settings", label: "前台設定（頁尾內容）" },
  hero_carousel: { href: "/admin/frontend-settings", label: "前台設定（輪播）" },
  carousel_2: { href: "/admin/frontend-settings", label: "前台設定（輪播）" },
  full_width_image: { href: "/admin/frontend-settings", label: "前台設定" },
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
          ? "目前編輯「手機專用」座標（leftPctMobile 等）；未填時前台手機仍沿用桌機座標。尺寸以手機畫布縮放換算；拖曳手機 iframe 內裝飾圖亦會寫入此欄。完成後請按「儲存版面」。"
          : "尺寸欄位以「目前桌機畫布縮放後」為準（例如 50% 畫布輸入 100px，會自動換算為前台 200px）。拖曳虛線框調位置，完成後請按「儲存版面」。"}
        下方列表與畫布虛線框左上角「編號 1、編號 2…」順序一致。
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
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const mobilePreviewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const blockListItemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const rightEditorRef = useRef<HTMLDivElement | null>(null);
  const [editorPos, setEditorPos] = useState<{ top: number; left: number }>({ top: 96, left: 0 });
  const [canvasZoomPct, setCanvasZoomPct] = useState(50);
  /** 手機寬度 iframe 預覽專用，與桌機畫布預覽比例分開 */
  const [mobileCanvasZoomPct, setMobileCanvasZoomPct] = useState(50);
  /** 側欄裝飾圖編輯：與「畫布開關」同步（桌機版／手機版） */
  const [floatingEditViewport, setFloatingEditViewport] = useState<"desktop" | "mobile">("desktop");
  /** 僅顯示一種畫布，避免同時捲動兩段預覽 */
  const [canvasViewportMode, setCanvasViewportMode] = useState<"desktop" | "mobile">("desktop");
  const canvasViewportModeRef = useRef<"desktop" | "mobile">("desktop");
  canvasViewportModeRef.current = canvasViewportMode;
  const [selectedFloatingIconId, setSelectedFloatingIconId] = useState<string | null>(null);
  const mobileCanvasSectionRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setFloatingEditViewport(canvasViewportMode === "mobile" ? "mobile" : "desktop");
  }, [canvasViewportMode]);
  const canvasScale = Math.min(100, Math.max(25, canvasZoomPct)) / 100;
  const mobileCanvasScale = Math.min(100, Math.max(25, mobileCanvasZoomPct)) / 100;
  const previewScaleForPanel = floatingEditViewport === "mobile" ? mobileCanvasScale : canvasScale;
  const previewPxFromStored = (storedPx: number): number =>
    Math.max(1, Math.round(storedPx * previewScaleForPanel));
  const storedPxFromPreview = (previewPx: number): number =>
    Math.max(16, Math.round(previewPx / Math.max(0.01, previewScaleForPanel)));

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
    Promise.all([getFrontendSettings(), getCoursesForHomepage()])
      .then(([s, coursesRes]) => {
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
        setBlocks(getDefaultLayoutBlocks());
        setAboutPageUrl(DEFAULT_ABOUT_PAGE_URL);
      })
      .finally(() => setLoading(false));
  }, []);

  const currentIds = blocks.map((b) => b.id);
  const availableToAdd = ALL_ADDABLE_BLOCK_IDS.filter((id) => !currentIds.includes(id));

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

  const computeEditorPosition = (blockId: string): { top: number; left: number } => {
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
    const top = Math.max(80, Math.min(rect.top, window.innerHeight - 120));
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
        requestAnimationFrame(() => setEditorPos(computeEditorPosition(blockId)));
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
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

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

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateLayoutBlocks(blocks);
      if (result.success) {
        setMessage({ type: "success", text: result.message ?? "已儲存" });
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  };

  const selectedBlock = selectedBlockId ? blocks.find((b) => b.id === selectedBlockId) : null;
  const selectedIndex = selectedBlockId != null ? getBlockIndex(selectedBlockId) : -1;
  const editLink = selectedBlockId ? BLOCK_EDIT_LINKS[selectedBlockId] : null;

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedBlockId) return;
    const onResize = () => setEditorPos(computeEditorPosition(selectedBlockId));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [selectedBlockId]);

  const layoutPreviewPayload = useMemo(
    (): LayoutPreviewSyncPayload => ({
      blocks,
      selectedBlockId,
      selectedFloatingIconId,
      mobileCanvasZoomPct,
      heroImageUrl,
      carouselItems,
      aboutContent,
      navAboutLabel,
      navCoursesLabel,
      navBookingLabel,
      navFaqLabel,
      activities,
      fullWidthImageUrl,
      logoUrl,
      headerBackgroundUrl,
      headerBackgroundMobileUrl,
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
    }),
    [
      blocks,
      selectedBlockId,
      selectedFloatingIconId,
      mobileCanvasZoomPct,
      heroImageUrl,
      carouselItems,
      aboutContent,
      navAboutLabel,
      navCoursesLabel,
      navBookingLabel,
      navFaqLabel,
      activities,
      fullWidthImageUrl,
      logoUrl,
      headerBackgroundUrl,
      headerBackgroundMobileUrl,
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
      <p className="text-sm text-gray-600 max-w-2xl">
        畫布預覽含全站頁首、內文區背景圖與頁尾背景（與前台設定一致）。請用「桌機版／手機版」開關切換編輯畫布；同一時間只顯示一種，側欄裝飾圖寬高會與目前畫布一致（手機畫布寫入手機專用欄位）。點畫布上的裝飾圖可對應側欄編號並捲動至該列。儲存後首頁主內容區會套用。
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

      {/* 左側鎖定 + 中間畫布；右側改成點積木才浮出編輯面板 */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:min-h-[420px]">
        {/* 左側：固定鎖在左邊，畫布滑到最下方也看得到 */}
        <aside className="md:w-44 xl:w-56 shrink-0">
          <div className="flex flex-col gap-4 md:fixed md:top-20 md:w-44 xl:w-56 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto pr-1">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 shrink-0">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">可加入的積木</h2>
            <ul className="space-y-1.5">
              {availableToAdd.length === 0 ? (
                <li className="text-xs text-gray-500">已全部加入</li>
              ) : (
                availableToAdd.map((id) => (
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
                ))
              )}
            </ul>
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
        <div className="flex-1 min-w-0 flex flex-col items-start overflow-x-hidden">
          <div className="w-full shrink-0 mb-3 flex flex-wrap items-center gap-2">
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
          </div>

          {canvasViewportMode === "desktop" ? (
          <div className="w-full max-w-full rounded-xl border border-gray-200 bg-gray-100 shadow-lg shrink-0">
            <div className="px-3 py-2 bg-gray-200 border-b border-gray-300 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
              <span className="text-center sm:text-left flex-1 min-w-[200px]">
                完整首頁預覽與前台同一套頁面元件；可點區塊、調高度、拖曳裝飾圖。
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
            <div ref={canvasWrapRef} className="overflow-auto max-h-[min(78vh,920px)] p-3 sm:p-4">
              <LayoutCanvas
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                onSelectBlock={(id) => handleSelectBlock(id, { scrollCanvasIntoView: false })}
                onBlockResizeHeight={onBlockResizeHeight}
                floatingIconsCoordinateMode="desktop"
                selectedFloatingIconId={selectedFloatingIconId}
                onSelectFloatingIcon={(blockId, iconId) => {
                  setSelectedFloatingIconId(iconId);
                  handleSelectBlock(blockId, { scrollCanvasIntoView: false });
                }}
                designWidthPx={CANVAS_MAX_WIDTH_PX}
                zoomPercent={canvasZoomPct}
                heroImageUrl={heroImageUrl}
                carouselItems={carouselItems}
                aboutContent={aboutContent}
                navAboutLabel={navAboutLabel}
                navCoursesLabel={navCoursesLabel}
                navBookingLabel={navBookingLabel}
                navFaqLabel={navFaqLabel}
                activities={activities}
                fullWidthImageUrl={fullWidthImageUrl}
                logoUrl={logoUrl}
                headerBackgroundUrl={headerBackgroundUrl}
                headerBackgroundMobileUrl={headerBackgroundMobileUrl}
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
                  寬度 {LAYOUT_MOBILE_PREVIEW_WIDTH_PX}px；可在此 iframe 內點區塊、拖曳裝飾圖（寫入手機專用座標，與桌機分開）。下方比例僅影響此預覽。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 justify-end shrink-0">
                <span className="text-gray-500 shrink-0">手機預覽比例</span>
                {[40, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setMobileCanvasZoomPct(pct)}
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
                className="w-[min(100%,390px)] max-w-full border border-gray-300 rounded-lg bg-white shadow"
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

              <div>
                <p className="text-xs font-medium text-amber-700 mb-1">
                  目前高度: {selectedBlock.heightPx != null && selectedBlock.heightPx > 0 ? `${selectedBlock.heightPx} px` : "自動"}
                </p>
                <label className="block text-xs font-medium text-gray-700 mb-1">區塊高度 (px)</label>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={selectedBlock.heightPx ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setBlockHeightByIndex(selectedIndex, v === "" ? null : parseInt(v, 10));
                  }}
                  placeholder="自動"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">區塊背景圖</label>
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

            <div>
              <p className="text-xs font-medium text-amber-700 mb-1">
                目前高度: {selectedBlock.heightPx != null && selectedBlock.heightPx > 0 ? `${selectedBlock.heightPx} px` : "自動"}
              </p>
              <label className="block text-xs font-medium text-gray-700 mb-1">區塊高度 (px)</label>
              <input
                type="number"
                min={0}
                step={10}
                value={selectedBlock.heightPx ?? ""}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setBlockHeightByIndex(selectedIndex, v === "" ? null : parseInt(v, 10));
                }}
                placeholder="自動"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">區塊背景圖</label>
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
          </div>
        </div>
      )}
    </div>
  );
}
