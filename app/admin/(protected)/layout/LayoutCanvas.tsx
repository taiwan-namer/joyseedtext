"use client";

import { useLayoutEffect, useRef, useState } from "react";
import BranchSiteHomeView from "@/app/components/home/BranchSiteHomeView";
import type { HeroFloatingIcon, LayoutBlock, FeaturedCategory } from "@/app/lib/frontendSettingsShared";
import type { CarouselItem } from "@/app/lib/frontendSettingsShared";
import CanvasPageBackground from "./CanvasPageBackground";
import type { Activity } from "@/app/lib/homeSectionTypes";

type LayoutCanvasProps = {
  blocks: LayoutBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onBlockResizeHeight: (blockId: string, heightPx: number | null) => void;
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
};

const DEFAULT_CAROUSEL = [
  { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
  { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
  { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
];

/**
 * 後台畫布：與分站首頁（`BranchSiteHomeView`／`app/page.tsx`）同一套版面與區塊，
 * 外加 `CanvasPageBackground` 與縮放外框。
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
            adminLayout={{
              selectedBlockId,
              onSelectBlock,
              onBlockResizeHeight,
              onBlockFloatingIconsChange,
              floatingIconsCoordinateMode: coordMode,
              selectedFloatingIconId,
              onSelectFloatingIcon,
              canvasPreviewScale: scale,
            }}
          />
        </CanvasPageBackground>
      </div>
    </div>
  );
}
