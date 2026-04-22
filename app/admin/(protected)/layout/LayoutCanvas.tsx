"use client";

import { useLayoutEffect, useRef, useState } from "react";
import BranchSiteHomeView from "@/app/components/home/BranchSiteHomeView";
import type { CarouselItem, FeaturedCategory, HeroFloatingIcon, LayoutBlock } from "@/app/lib/frontendSettingsShared";
import CanvasPageBackground from "./CanvasPageBackground";
import type { Activity } from "@/app/lib/homeSectionTypes";

type LayoutCanvasProps = {
  blocks: LayoutBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onBlockResizeHeight: (
    blockId: string,
    heightPx: number | null,
    layoutViewport?: "desktop" | "mobile"
  ) => void;
  /** 模擬瀏覽器視窗寬度（建議 LAYOUT_ADMIN_PREVIEW_VIEWPORT_WIDTH_PX＝1920），非主內容欄寬 */
  designWidthPx: number;
  /** 預覽縮放 1–100（例如 50 表示視覺縮為一半，方便一覽整頁） */
  zoomPercent: number;
  heroImageUrl: string | null;
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
  onBlockFloatingIconsChange: (blockId: string, next: HeroFloatingIcon[]) => void;
  floatingIconsCoordinateMode?: "desktop" | "mobile";
  selectedFloatingIconId?: string | null;
  onSelectFloatingIcon?: (blockId: string, iconId: string) => void;
  /** 全螢幕裝飾圖（與首頁畫布同一預覽層） */
  viewportFloatingIcons?: HeroFloatingIcon[];
  onViewportFloatingIconsChange?: (next: HeroFloatingIcon[]) => void;
  viewportSelectedFloatingIconId?: string | null;
  onSelectViewportFloatingIcon?: (id: string | null) => void;
  /** 畫布主圖區點擊選檔或更換（主編輯頁傳入；手機 iframe 預覽可不傳） */
  onHeroImagePickRequest?: () => void;
  /** 後台桌機主畫布可用：容器吃滿可用寬度；手機 iframe 預覽請維持 false 以保留原縮放行為 */
  stretchContainer?: boolean;
  /** false 時以前台訪客模式渲染（不掛 admin 互動層），用於「前台一致預覽」。 */
  adminInteractive?: boolean;
};

const DEFAULT_CAROUSEL = [
  { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
  { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
  { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
];

/**
 * 後台畫布：與分站首頁（`BranchSiteHomeView`／`app/page.tsx`）同一套版面與區塊，
 * 外加 `CanvasPageBackground` 與縮放外框。
 * 內層寬度為模擬瀏覽器視窗（預設 1920px），主內容由 max-w-7xl 置中，與前台寬螢幕兩側留白一致。
 */
export default function LayoutCanvas(props: LayoutCanvasProps) {
  const {
    blocks,
    selectedBlockId,
    onSelectBlock,
    onBlockResizeHeight,
    designWidthPx,
    zoomPercent,
    heroImageUrl,
    fullWidthImageUrl,
    logoUrl,
    headerBackgroundUrl,
    headerBackgroundMobileUrl,
    activities,
    carouselItems,
    aboutContent,
    navAboutLabel,
    navCoursesLabel,
    navBookingLabel,
    navFaqLabel,
    pageBackgroundUrl,
    pageBackgroundMobileUrl,
    pageBackgroundExtensionColor,
    onBlockFloatingIconsChange,
    floatingIconsCoordinateMode = "desktop",
    selectedFloatingIconId = null,
    onSelectFloatingIcon,
    aboutPageUrl,
    viewportFloatingIcons = [],
    onViewportFloatingIconsChange,
    viewportSelectedFloatingIconId = null,
    onSelectViewportFloatingIcon,
    onHeroImagePickRequest,
    stretchContainer = false,
    adminInteractive = true,
  } = props;
  const coordMode = floatingIconsCoordinateMode;
  const carouselList = (carouselItems.length > 0 ? carouselItems : DEFAULT_CAROUSEL).filter(
    (item) => item.visible !== false
  );

  const scale = Math.min(100, Math.max(25, zoomPercent)) / 100;
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [innerHeight, setInnerHeight] = useState(0);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setInnerHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [
    blocks,
    scale,
    heroImageUrl,
    fullWidthImageUrl,
    activities?.length,
    carouselList.length,
    aboutContent,
    navAboutLabel,
    navCoursesLabel,
    navBookingLabel,
    navFaqLabel,
    logoUrl,
    headerBackgroundUrl,
    headerBackgroundMobileUrl,
  ]);

  const scaledH = innerHeight > 0 ? Math.ceil(innerHeight * scale) : Math.ceil(480 * scale);

  if (!stretchContainer) {
    return (
      <div
        className="mx-auto overflow-visible"
        style={{
          width: designWidthPx * scale,
          height: scaledH,
          minHeight: scaledH,
        }}
      >
        <div
          ref={innerRef}
          className="w-full space-y-0 rounded-b-lg"
          style={{
            width: designWidthPx,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <CanvasPageBackground
            pageBackgroundUrl={pageBackgroundUrl}
            pageBackgroundMobileUrl={pageBackgroundMobileUrl}
            pageBackgroundExtensionColor={pageBackgroundExtensionColor}
          >
            <BranchSiteHomeView
              layoutBlocks={blocks}
              heroImageUrl={heroImageUrl}
              fullWidthImageUrl={fullWidthImageUrl ?? null}
              previewHeader={{
                logoUrl: logoUrl ?? null,
                headerBackgroundUrl: headerBackgroundUrl ?? null,
                headerBackgroundMobileUrl: headerBackgroundMobileUrl ?? null,
              }}
              activities={activities}
              carouselItems={carouselItems}
              aboutContent={aboutContent}
              navAboutLabel={navAboutLabel}
              navCoursesLabel={navCoursesLabel}
              navBookingLabel={navBookingLabel}
              navFaqLabel={navFaqLabel}
              aboutPageUrl={aboutPageUrl}
              previewCoordinateViewport={adminInteractive ? undefined : coordMode}
              adminLayout={
                adminInteractive
                  ? {
                      selectedBlockId,
                      onSelectBlock,
                      onBlockResizeHeight,
                      onBlockFloatingIconsChange,
                      floatingIconsCoordinateMode: coordMode,
                      ...(coordMode === "mobile"
                        ? { mobileFloatingScaleReferenceWidthPx: designWidthPx }
                        : {}),
                      selectedFloatingIconId,
                      onSelectFloatingIcon,
                      canvasPreviewScale: scale,
                      viewportFloatingIcons,
                      onViewportFloatingIconsChange,
                      selectedViewportFloatingIconId: viewportSelectedFloatingIconId,
                      onSelectViewportFloatingIcon,
                      onHeroImagePickRequest,
                    }
                  : null
              }
              viewportFloatingIcons={adminInteractive ? null : viewportFloatingIcons}
            />
          </CanvasPageBackground>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-visible" style={{ height: scaledH, minHeight: scaledH }}>
      <div className="mx-auto overflow-visible" style={{ width: designWidthPx * scale }}>
        <div
          ref={innerRef}
          className="w-full space-y-0 rounded-b-lg"
          style={{
            width: designWidthPx,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
        <CanvasPageBackground
          pageBackgroundUrl={pageBackgroundUrl}
          pageBackgroundMobileUrl={pageBackgroundMobileUrl}
          pageBackgroundExtensionColor={pageBackgroundExtensionColor}
        >
          <BranchSiteHomeView
            layoutBlocks={blocks}
            heroImageUrl={heroImageUrl}
            fullWidthImageUrl={fullWidthImageUrl ?? null}
            previewHeader={{
              logoUrl: logoUrl ?? null,
              headerBackgroundUrl: headerBackgroundUrl ?? null,
              headerBackgroundMobileUrl: headerBackgroundMobileUrl ?? null,
            }}
            activities={activities}
            carouselItems={carouselItems}
            aboutContent={aboutContent}
            navAboutLabel={navAboutLabel}
            navCoursesLabel={navCoursesLabel}
            navBookingLabel={navBookingLabel}
            navFaqLabel={navFaqLabel}
            aboutPageUrl={aboutPageUrl}
            previewCoordinateViewport={adminInteractive ? undefined : coordMode}
            adminLayout={
              adminInteractive
                ? {
                    selectedBlockId,
                    onSelectBlock,
                    onBlockResizeHeight,
                    onBlockFloatingIconsChange,
                    floatingIconsCoordinateMode: coordMode,
                    ...(coordMode === "mobile"
                      ? { mobileFloatingScaleReferenceWidthPx: designWidthPx }
                      : {}),
                    selectedFloatingIconId,
                    onSelectFloatingIcon,
                    canvasPreviewScale: scale,
                    viewportFloatingIcons,
                    onViewportFloatingIconsChange,
                    selectedViewportFloatingIconId: viewportSelectedFloatingIconId,
                    onSelectViewportFloatingIcon,
                    onHeroImagePickRequest,
                  }
                : null
            }
            viewportFloatingIcons={adminInteractive ? null : viewportFloatingIcons}
          />
          </CanvasPageBackground>
        </div>
      </div>
    </div>
  );
}
