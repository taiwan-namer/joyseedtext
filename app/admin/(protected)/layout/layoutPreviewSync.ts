import type { Activity } from "@/app/lib/homeSectionTypes";
import {
  LAYOUT_MOBILE_FLOATING_SCALE_WIDTH_PX,
  type CarouselItem,
  type FeaturedCategory,
  type HeroFloatingIcon,
  type LayoutBlock,
} from "@/app/lib/frontendSettingsShared";

/** 與後台「首頁版面」手機 iframe 預覽同步的訊息類型（postMessage） */
export const LAYOUT_PREVIEW_SYNC_TYPE = "layout-preview-sync" as const;
/** iframe → 父頁：手機預覽已掛載，請立即重送最新 payload */
export const LAYOUT_PREVIEW_READY = "layout-preview-ready" as const;
/** iframe → 父頁：主動請求最新同步（與 READY 並用；避免父頁 onLoad 漏送時閉包仍為舊 state） */
export const LAYOUT_PREVIEW_REQUEST_SYNC = "layout-preview-request-sync" as const;

/** iframe → 父頁：選取區塊（與手機座標編輯連動） */
export const LAYOUT_PREVIEW_SELECT_BLOCK = "layout-preview-select-block" as const;
/** iframe → 父頁：點選裝飾圖（與側欄編號連動） */
export const LAYOUT_PREVIEW_SELECT_FLOATING_ICON = "layout-preview-select-floating-icon" as const;
/** iframe → 父頁：裝飾圖變更 */
export const LAYOUT_PREVIEW_FLOATING_ICONS = "layout-preview-floating-icons" as const;
/** iframe → 父頁：區塊高度 */
export const LAYOUT_PREVIEW_BLOCK_HEIGHT = "layout-preview-block-height" as const;
/** iframe → 父頁：全螢幕裝飾圖列表變更 */
export const LAYOUT_PREVIEW_VIEWPORT_FLOATING_ICONS = "layout-preview-viewport-floating-icons" as const;
/** iframe → 父頁：選取全螢幕裝飾圖 */
export const LAYOUT_PREVIEW_SELECT_VIEWPORT_FLOATING_ICON =
  "layout-preview-select-viewport-floating-icon" as const;

/** 手機預覽 iframe 內 LayoutCanvas 的設計寬度（與常見手機 CSS 寬度一致，使 md: 以下斷點生效） */
export const LAYOUT_MOBILE_PREVIEW_WIDTH_PX = LAYOUT_MOBILE_FLOATING_SCALE_WIDTH_PX;

/** 可 JSON 序列化、由父頁傳入 iframe 的畫布狀態（不含 callback） */
export type LayoutPreviewSyncPayload = {
  blocks: LayoutBlock[];
  /** 目前選取的區塊 id（手機／桌機畫布共用狀態） */
  selectedBlockId: string | null;
  /** 目前選取之裝飾圖 id（畫布與側欄高亮連動） */
  selectedFloatingIconId?: string | null;
  /** 手機 iframe 預覽專用，與桌機畫布「預覽比例」分開 */
  mobileCanvasZoomPct: number;
  /** 手機 iframe 目前實際預覽寬度（px），用來貼近真實裝置寬度 */
  mobilePreviewViewportWidthPx: number;
  /** 桌機畫布縮放比例（用於需要與桌機 1:1 同步時）。 */
  desktopCanvasZoomPct: number;
  /** 桌機畫布視窗寬度（px，用於需要與桌機 1:1 同步時）。 */
  desktopCanvasViewportWidthPx: number;
  heroImageUrl: string | null;
  heroImageMobileUrl: string | null;
  /** 未儲存時同步主圖原檔，讓 iframe 內可自行建立 blob URL 預覽。 */
  heroImageFile?: File | null;
  heroImageMobileFile?: File | null;
  carouselItems: CarouselItem[];
  aboutContent: string | null;
  navAboutLabel: string;
  navCoursesLabel: string;
  navBookingLabel: string;
  navFaqLabel: string;
  activities: Activity[];
  fullWidthImageUrl: string | null;
  logoUrl: string | null;
  headerBackgroundUrl: string | null;
  headerBackgroundMobileUrl: string | null;
  showProductMenu: boolean;
  pageBackgroundUrl: string | null;
  pageBackgroundMobileUrl: string | null;
  pageBackgroundExtensionColor: string | null;
  footerBackgroundUrl: string | null;
  footerBackgroundMobileUrl: string | null;
  featuredCategories: FeaturedCategory[];
  featuredSectionIconUrl: string | null;
  heroBackgroundUrl: string | null;
  heroBackgroundMobileUrl: string | null;
  heroTitle: string | null;
  homeCarouselMidStripBackgroundUrl: string | null;
  homeCarouselSectionBackgroundUrl: string | null;
  homeMidBannerSectionBackgroundUrl: string | null;
  homeMidBannerImageUrl: string | null;
  homeMidBannerLinkUrl: string | null;
  homeCoursesBlockBackgroundUrl: string | null;
  homeCoursesBlockBackgroundMobileUrl: string | null;
  homeNewCoursesIconUrl: string | null;
  aboutPageUrl: string;
  /** 與桌機畫布共用：全螢幕裝飾圖 */
  viewportFloatingIcons: HeroFloatingIcon[];
  viewportSelectedFloatingIconId: string | null;
};
