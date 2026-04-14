"use client";

import { useLayoutEffect, useRef, useState } from "react";
import HomePageFooter from "@/app/components/home/HomePageFooter";
import Header from "@/app/components/Header";
import HomePageClient from "@/app/HomePageClient";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import BlockWrapper from "./BlockWrapper";
import HeroFloatingIconsEditor from "@/app/admin/(protected)/layout/HeroFloatingIconsEditor";
import HeroFloatingIconsLayer from "@/app/components/home/HeroFloatingIconsLayer";
import type {
  HeroFloatingIcon,
  LayoutBlock,
  FeaturedCategory,
  FrontendSettings,
} from "@/app/lib/frontendSettingsShared";
import type { CarouselItem } from "@/app/lib/frontendSettingsShared";
import { LAYOUT_SECTION_LABELS } from "@/app/lib/frontendSettingsShared";
import CanvasPageBackground from "./CanvasPageBackground";
import type { Activity } from "@/app/lib/homeSectionTypes";
import type { HomePageActivity } from "@/lib/homePageActivity";

const DEFAULT_CAROUSEL = [
  { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
  { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
  { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
];

function footerSurfaceStyleFromBlock(block: LayoutBlock): React.CSSProperties {
  return {
    ...(block.heightPx != null && block.heightPx > 0 ? { minHeight: block.heightPx } : {}),
    ...(block.backgroundImageUrl
      ? {
          backgroundImage: `url(${block.backgroundImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {}),
  };
}

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
  /** 頁尾「關於童趣島」連結（與後台關於頁設定一致） */
  aboutPageUrl: string;
  onBlockFloatingIconsChange: (blockId: string, next: HeroFloatingIcon[]) => void;
  /** 桌機／手機畫布：裝飾圖座標分開儲存 */
  floatingIconsCoordinateMode?: "desktop" | "mobile";
  selectedFloatingIconId?: string | null;
  onSelectFloatingIcon?: (blockId: string, iconId: string) => void;
};

export default function LayoutCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onBlockResizeHeight,
  designWidthPx,
  zoomPercent,
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
  heroTitle,
  homeCarouselMidStripBackgroundUrl,
  homeCarouselSectionBackgroundUrl,
  homeMidBannerSectionBackgroundUrl,
  homeMidBannerImageUrl,
  homeMidBannerLinkUrl,
  homeCoursesBlockBackgroundUrl,
  homeCoursesBlockBackgroundMobileUrl,
  homeNewCoursesIconUrl,
  aboutPageUrl,
  onBlockFloatingIconsChange,
  floatingIconsCoordinateMode = "desktop",
  selectedFloatingIconId = null,
  onSelectFloatingIcon,
}: LayoutCanvasProps) {
  const coordMode = floatingIconsCoordinateMode;
  const { siteName } = useStoreSettings();
  const carouselList = (carouselItems.length > 0 ? carouselItems : DEFAULT_CAROUSEL).filter(
    (item) => item.visible !== false
  );

  const headerBlock = blocks.find((b) => b.id === "header");
  const footerBlock = blocks.find((b) => b.id === "footer");

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
    heroBackgroundUrl,
    heroBackgroundMobileUrl,
    carouselList.length,
    aboutContent,
    activities.length,
    featuredCategories.length,
    homeMidBannerImageUrl,
    homeCarouselMidStripBackgroundUrl,
  ]);

  const previewActivities: HomePageActivity[] = activities.map((a) => ({
    id: a.id,
    title: a.title,
    price: a.price,
    stock: a.stock,
    imageUrl: a.imageUrl ?? null,
    detailHref: a.detailHref,
    ageTags: a.ageTags ?? [],
    category: a.category,
    description: a.description,
    badgeNew: a.badgeNew,
    badgeHot: a.badgeHot,
    badgeFeatured: a.badgeFeatured,
  }));

  const previewFrontendSettings: FrontendSettings = {
    heroImageUrl,
    heroBackgroundUrl,
    heroBackgroundMobileUrl,
    heroTitle,
    carouselItems: carouselList,
    navAboutLabel,
    aboutPageUrl,
    navCoursesLabel,
    navBookingLabel,
    navFaqLabel,
    memberIconGallery: [],
    memberIconSelectedIndex: 0,
    aboutContent,
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
    layoutOrder: blocks.map((b) => b.id),
    fullWidthImageUrl,
    layoutBlocks: blocks,
    featuredCategories,
    featuredSectionIconUrl: featuredSectionIconUrl ?? null,
    homeHotCoursesIconUrl: null,
    homeNewCoursesIconUrl: homeNewCoursesIconUrl ?? null,
    logoUrl,
    headerBackgroundUrl: headerBackgroundUrl ?? null,
    headerBackgroundMobileUrl: headerBackgroundMobileUrl ?? null,
    pageBackgroundUrl: pageBackgroundUrl ?? null,
    pageBackgroundMobileUrl: pageBackgroundMobileUrl ?? null,
    pageBackgroundExtensionColor: pageBackgroundExtensionColor ?? null,
    showProductMenu,
    footerAreaA: null,
    footerAreaB: null,
    footerAreaC: null,
    footerAreaD: null,
    footerBackgroundUrl: footerBackgroundUrl ?? null,
    footerBackgroundMobileUrl: footerBackgroundMobileUrl ?? null,
    homeFeaturedTopBackgroundUrl: null,
    homeFeaturedGridBackgroundUrl: null,
    homeMidBannerImageUrl: homeMidBannerImageUrl ?? null,
    homeMidBannerLinkUrl: homeMidBannerLinkUrl ?? null,
    homeMidBannerSectionBackgroundUrl: homeMidBannerSectionBackgroundUrl ?? null,
    homeCoursesBlockBackgroundUrl: homeCoursesBlockBackgroundUrl ?? null,
    homeCoursesBlockBackgroundMobileUrl: homeCoursesBlockBackgroundMobileUrl ?? null,
    homeCarouselSectionBackgroundUrl: homeCarouselSectionBackgroundUrl ?? null,
    homeCarouselMidStripBackgroundUrl: homeCarouselMidStripBackgroundUrl ?? null,
    entryPopupEnabled: false,
    entryPopupImageUrl: null,
    entryPopupLinkUrl: null,
  };

  const scaledH = innerHeight > 0 ? Math.ceil(innerHeight * scale) : Math.ceil(480 * scale);

  const headerEl = (
    <Header
      siteName={siteName}
      logoUrl={logoUrl}
      headerBackgroundUrl={headerBackgroundUrl}
      headerBackgroundMobileUrl={headerBackgroundMobileUrl}
      showProductMenu={showProductMenu}
      navAboutLabel={navAboutLabel}
      navCoursesLabel={navCoursesLabel}
      navBookingLabel={navBookingLabel}
      navFaqLabel={navFaqLabel}
    />
  );

  const footerSurfaceStyle = footerBlock ? footerSurfaceStyleFromBlock(footerBlock) : {};
  const footerEl = (
    <HomePageFooter
      footerBackgroundUrl={footerBackgroundUrl?.trim() ? footerBackgroundUrl : null}
      footerBackgroundMobileUrl={footerBackgroundMobileUrl?.trim() ? footerBackgroundMobileUrl : null}
      footerSurfaceStyle={footerSurfaceStyle}
      aboutPageUrl={aboutPageUrl}
    />
  );

  /** 與 HomePageClient 內區塊相同：頁首／頁尾需掛 Layer +（編輯模式）Editor，否則後台無法預覽／拖曳裝飾圖 */
  const headerWithFloats =
    headerBlock != null ? (
      <div className="relative w-full">
        {headerEl}
        {(headerBlock.floatingIcons?.length ?? 0) > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-[110] flex justify-center">
            <div className="relative h-full w-full max-w-[1200px] px-4 lg:px-8">
              <HeroFloatingIconsLayer coordinateViewport={coordMode} icons={headerBlock.floatingIcons} />
              {selectedBlockId === "header" ? (
                <HeroFloatingIconsEditor
                  overlayMode
                  coordinateMode={coordMode}
                  icons={headerBlock.floatingIcons ?? []}
                  onChange={(next) => onBlockFloatingIconsChange("header", next)}
                  selectedIconId={selectedFloatingIconId}
                  onIconPointerDown={(id) => onSelectFloatingIcon?.("header", id)}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    ) : (
      headerEl
    );

  const footerWithFloats =
    footerBlock != null ? (
      <div className="relative w-full">
        {footerEl}
        {(footerBlock.floatingIcons?.length ?? 0) > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-[30] flex justify-center">
            <div className="relative h-full w-full max-w-7xl px-3 sm:px-4">
              <HeroFloatingIconsLayer coordinateViewport={coordMode} icons={footerBlock.floatingIcons} />
              {selectedBlockId === "footer" ? (
                <HeroFloatingIconsEditor
                  overlayMode
                  coordinateMode={coordMode}
                  icons={footerBlock.floatingIcons ?? []}
                  onChange={(next) => onBlockFloatingIconsChange("footer", next)}
                  selectedIconId={selectedFloatingIconId}
                  onIconPointerDown={(id) => onSelectFloatingIcon?.("footer", id)}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    ) : (
      footerEl
    );

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
          {headerBlock ? (
            <BlockWrapper
              block={headerBlock}
              isSelected={selectedBlockId === "header"}
              onSelect={() => onSelectBlock("header")}
              onResizeHeight={(heightPx) => onBlockResizeHeight("header", heightPx)}
              blockLabel={LAYOUT_SECTION_LABELS.header}
              skipBackgroundImage={false}
            >
              {headerWithFloats}
            </BlockWrapper>
          ) : (
            headerWithFloats
          )}
          <HomePageClient
            initialFrontendSettings={previewFrontendSettings}
            initialActivities={previewActivities}
            adminLayoutCanvas={{
              selectedBlockId,
              onSelectBlock,
              onBlockResizeHeight,
              onBlockFloatingIconsChange,
              floatingIconsCoordinateMode: coordMode,
              selectedFloatingIconId,
              onSelectFloatingIcon,
            }}
          />
          {footerBlock ? (
            <BlockWrapper
              block={footerBlock}
              isSelected={selectedBlockId === "footer"}
              onSelect={() => onSelectBlock("footer")}
              onResizeHeight={(heightPx) => onBlockResizeHeight("footer", heightPx)}
              blockLabel={LAYOUT_SECTION_LABELS.footer}
              skipBackgroundImage
            >
              {footerWithFloats}
            </BlockWrapper>
          ) : (
            footerWithFloats
          )}
        </CanvasPageBackground>
      </div>
    </div>
  );
}
