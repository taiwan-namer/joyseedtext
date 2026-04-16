"use client";

import Link from "next/link";
import { Image as LucideImage, Facebook, Instagram } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { CourseForPublic } from "@/app/actions/productActions";
import { mapCourseToHomeActivity as mapCourseToHomePageActivity } from "@/lib/homePageActivity";
import FAQ from "@/app/components/FAQ";
import { HeaderMember } from "@/app/components/HeaderMember";
import HomeFeaturedCoursesOnePlusSix from "@/app/components/home/HomeFeaturedCoursesOnePlusSix";
import HomeCoursesGridListBlock from "@/app/components/home/HomeCoursesGridListBlock";
import HeroFloatingIconsLayer from "@/app/components/home/HeroFloatingIconsLayer";
import { getCoursesForHomepage } from "@/app/actions/productActions";
import { mapCourseToHomeActivity } from "@/app/lib/mapCourseToHomeActivity";
import type { Activity } from "@/app/lib/homeSectionTypes";
import BlockWrapper from "@/app/admin/(protected)/layout/BlockWrapper";
import HeroFloatingIconsEditor from "@/app/admin/(protected)/layout/HeroFloatingIconsEditor";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import type { AdminLayoutCanvasConfig } from "@/app/admin/(protected)/layout/adminLayoutCanvasTypes";
import type { CarouselItem, LayoutBlock } from "@/app/lib/frontendSettingsShared";
import { LAYOUT_SECTION_LABELS } from "@/app/lib/frontendSettingsShared";
import FullWidthImageSection from "@/app/components/home/FullWidthImageSection";

const CAROUSEL_INTERVAL_MS = 4000;

/** 分站首頁實際會畫出的區塊 id */
const BRANCH_LAYOUT_ID_LIST = [
  "header",
  "hero",
  "hero_carousel",
  "carousel",
  /** 畫布「單張大圖」：與 frontend_settings.fullWidthImageUrl 對應 */
  "full_width_image",
  "featured_categories",
  /** 舊版面 id，仍須可渲染（與 courses_grid 相同內容） */
  "courses",
  "courses_grid",
  "courses_list",
  "about",
  "faq",
  "contact",
  "footer",
] as const;

/**
 * 僅在後台畫布顯示佔位（前台首頁不渲染），讓點側欄可對應畫布與裝飾圖／高度／背景。
 */
const ADMIN_CANVAS_PLACEHOLDER_ID_LIST = ["new_courses", "popular_experiences"] as const;

/** 總站首頁有、分站畫布需預覽選取的積木（訪客分站頁未必渲染） */
const ADMIN_EXTRA_CANVAS_BLOCK_IDS = ["carousel_2", "full_width_image"] as const;

/** 依 layout_blocks 排序與 enabled，產生渲染順序；前台訪客：hero／hero_carousel 合併為一個 hero 槽；後台畫布：分開列出以便分別選取 */
function getVisibleOrderedBranchSectionIds(blocks: LayoutBlock[], forAdminCanvas: boolean): string[] {
  const allowedList = forAdminCanvas
    ? [...BRANCH_LAYOUT_ID_LIST, ...ADMIN_CANVAS_PLACEHOLDER_ID_LIST, ...ADMIN_EXTRA_CANVAS_BLOCK_IDS]
    : [...BRANCH_LAYOUT_ID_LIST];
  const allowed = new Set<string>(allowedList);
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  const out: string[] = [];
  let heroSlotPlaced = false;
  for (const b of sorted) {
    if (b.enabled === false) continue;
    if (!allowed.has(b.id)) continue;
    if (b.id === "hero" || b.id === "hero_carousel") {
      if (forAdminCanvas) {
        if (b.id === "hero") out.push("hero");
        else out.push("hero_carousel");
        continue;
      }
      if (!heroSlotPlaced) {
        out.push("hero");
        heroSlotPlaced = true;
      }
      continue;
    }
    out.push(b.id);
  }
  return out;
}

function LineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.127h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

export type BranchSiteHomeViewProps = {
  layoutBlocks: LayoutBlock[];
  /**
   * 首頁大圖設定是否已從後台載入完成。false 時仍會佔住主圖區高度（避免下方區塊先出現再被主圖推開）。
   * 後台畫布預覽請維持 true（預設）。
   */
  heroSettingsLoaded?: boolean;
  heroImageUrl: string | null;
  /** 後台畫布：單張大圖區塊預覽用（與前台設定同步） */
  fullWidthImageUrl?: string | null;
  /**
   * 後台畫布：頁首 LOGO／背景預覽（與 store_settings 同步；訪客首頁未傳此值）
   */
  previewHeader?: {
    logoUrl: string | null;
    headerBackgroundUrl: string | null;
    headerBackgroundMobileUrl: string | null;
  } | null;
  carouselItems: CarouselItem[];
  aboutContent: string | null;
  navAboutLabel: string;
  navCoursesLabel: string;
  navBookingLabel: string;
  navFaqLabel: string;
  /** 後台畫布：區塊選取、高度、裝飾圖編輯 */
  adminLayout?: AdminLayoutCanvasConfig | null;
  /** 後台畫布：與編輯頁同一批課程列表；訪客首頁會自行向 API 載入 */
  activities?: Activity[];
};

export default function BranchSiteHomeView({
  layoutBlocks,
  heroSettingsLoaded = true,
  heroImageUrl,
  fullWidthImageUrl = null,
  previewHeader = null,
  carouselItems,
  aboutContent,
  navAboutLabel,
  navCoursesLabel,
  navBookingLabel,
  navFaqLabel,
  adminLayout = null,
  activities: activitiesFromParent,
}: BranchSiteHomeViewProps) {
  const {
    siteName,
    primaryColor,
    aboutSectionBackgroundColor,
    socialFbUrl,
    socialIgUrl,
    socialLineUrl,
    contactEmail,
    contactPhone,
    contactAddress,
  } = useStoreSettings();

  const hasSocialLinks = !!(socialFbUrl || socialIgUrl || socialLineUrl);
  const hasContact = !!(contactPhone || contactEmail || contactAddress);
  const mapEmbedUrl = contactAddress?.trim()
    ? `https://www.google.com/maps?q=${encodeURIComponent(contactAddress.trim())}&output=embed`
    : "";

  const [wallIndex, setWallIndex] = useState(0);
  const defaultCarousel: CarouselItem[] = useMemo(
    () => [
      { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
      { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
      { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
    ],
    []
  );
  const carouselList = (carouselItems.length > 0 ? carouselItems : defaultCarousel).filter(
    (item) => item.visible !== false
  );

  useEffect(() => {
    if (carouselList.length === 0) return;
    const timer = setInterval(() => {
      setWallIndex((i) => (i + 1) % carouselList.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [carouselList.length]);

  useEffect(() => {
    setWallIndex((i) => (carouselList.length === 0 ? 0 : i % carouselList.length));
  }, [carouselList.length]);

  const getBlock = (id: string) => layoutBlocks.find((b) => b.id === id);
  const getBlockStyle = (id: string): CSSProperties => {
    const b = getBlock(id);
    if (!b) return {};
    return {
      ...(b.heightPx != null && b.heightPx > 0 ? { minHeight: b.heightPx } : {}),
      ...(b.backgroundImageUrl
        ? { backgroundImage: `url(${b.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
        : {}),
    };
  };

  const admin = adminLayout ?? null;
  const coordMode = admin?.floatingIconsCoordinateMode ?? "desktop";

  const isAdminCanvas = admin != null;

  /** 後台畫布：攔截預覽區內所有連結，避免點擊跳到前台／另開分頁；不阻擋區塊選取與裝飾圖編輯 */
  const suppressCanvasLinkNavigation = (e: React.MouseEvent) => {
    if (!isAdminCanvas) return;
    const el = e.target;
    if (!(el instanceof Element)) return;
    if (el.closest("[data-resize-handle]")) return;
    if (el.closest("[data-floating-icon-editor]")) return;
    if (el.closest("a[href]")) e.preventDefault();
  };
  const [homeCoursesRaw, setHomeCoursesRaw] = useState<CourseForPublic[]>([]);
  const [homeFetchLoading, setHomeFetchLoading] = useState(!isAdminCanvas);
  const [homeFetchError, setHomeFetchError] = useState<string | null>(null);

  const homeActivities = useMemo(() => {
    if (isAdminCanvas) return activitiesFromParent ?? [];
    return homeCoursesRaw.map(mapCourseToHomeActivity);
  }, [isAdminCanvas, activitiesFromParent, homeCoursesRaw]);

  const featuredHomePageActivities = useMemo(
    () => homeCoursesRaw.map(mapCourseToHomePageActivity),
    [homeCoursesRaw]
  );

  useEffect(() => {
    if (isAdminCanvas) return;
    let cancelled = false;
    (async () => {
      setHomeFetchLoading(true);
      setHomeFetchError(null);
      try {
        const res = await getCoursesForHomepage();
        if (cancelled) return;
        if (!res.success) {
          setHomeCoursesRaw([]);
          setHomeFetchError(res.error);
          return;
        }
        setHomeCoursesRaw(res.data);
      } catch (e) {
        if (!cancelled) {
          setHomeCoursesRaw([]);
          setHomeFetchError(e instanceof Error ? e.message : "載入課程失敗");
        }
      } finally {
        if (!cancelled) setHomeFetchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdminCanvas]);
  const homeCoursesLoading = isAdminCanvas ? false : homeFetchLoading;
  const homeCoursesError = isAdminCanvas ? null : homeFetchError;

  const orderedSectionIds = useMemo(
    () => getVisibleOrderedBranchSectionIds(layoutBlocks, admin != null),
    [layoutBlocks, admin]
  );

  /** adminId：與 layout_blocks 內積木 id 一致（選取／拖曳用）；blockOverride：實際套用樣式與高度的 LayoutBlock */
  const wrap = (
    adminId: string,
    children: React.ReactNode,
    opts?: { skipBackgroundImage?: boolean; blockOverride?: LayoutBlock | null }
  ): React.ReactNode => {
    const block = opts?.blockOverride ?? layoutBlocks.find((b) => b.id === adminId);
    if (!admin || !block) return children;
    return (
      <BlockWrapper
        block={block}
        isSelected={admin.selectedBlockId === adminId}
        onSelect={() => admin.onSelectBlock(adminId)}
        onResizeHeight={(heightPx) => admin.onBlockResizeHeight(adminId, heightPx)}
        blockLabel={LAYOUT_SECTION_LABELS[adminId] ?? adminId}
        skipBackgroundImage={opts?.skipBackgroundImage}
        previewScale={admin.canvasPreviewScale ?? 1}
      >
        {children}
      </BlockWrapper>
    );
  };

  const ph = admin && previewHeader ? previewHeader : null;
  const hasPreviewLogo = !!(ph?.logoUrl && ph.logoUrl.trim());
  const deskBg = ph?.headerBackgroundUrl?.trim() || null;
  const mobBg = ph?.headerBackgroundMobileUrl?.trim() || null;
  const hasPreviewHeaderBg = !!(deskBg || mobBg);
  const previewMobileBg = mobBg || deskBg;
  const previewDesktopBg = deskBg || mobBg;

  const headerInner = (
    <header
      className="sticky top-0 z-50 border-b border-gray-100 shadow-sm relative overflow-hidden"
      style={{ backgroundColor: aboutSectionBackgroundColor }}
    >
      {hasPreviewHeaderBg && previewMobileBg && previewDesktopBg && previewMobileBg !== previewDesktopBg ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat md:hidden"
            style={{ backgroundImage: `url(${previewMobileBg})` }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-0 hidden bg-cover bg-center bg-no-repeat md:block"
            style={{ backgroundImage: `url(${previewDesktopBg})` }}
            aria-hidden
          />
        </>
      ) : hasPreviewHeaderBg && previewDesktopBg ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${previewDesktopBg})` }}
          aria-hidden
        />
      ) : null}
      <div className="relative z-10 mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-2">
        {hasPreviewLogo ? (
          <div className="shrink-0 flex items-center max-h-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ph!.logoUrl!.trim()}
              alt=""
              className="max-h-11 w-auto max-w-[200px] object-contain"
            />
          </div>
        ) : (
          <h1 className="text-xl font-bold text-brand shrink-0">{siteName}</h1>
        )}
        <div className="flex items-center gap-2 sm:gap-3 shrink min-w-0 overflow-x-auto scrollbar-hide">
          <a href="#about" className="text-gray-600 hover:text-brand text-sm whitespace-nowrap">
            {navAboutLabel || "關於我們"}
          </a>
          <Link href="/courses" className="text-gray-600 hover:text-brand text-sm whitespace-nowrap">
            {navCoursesLabel || "課程介紹"}
          </Link>
          <Link href="/course/booking" className="text-gray-600 hover:text-brand text-sm whitespace-nowrap">
            {navBookingLabel || "課程預約"}
          </Link>
          <a href="#faq" className="text-gray-600 hover:text-brand text-sm whitespace-nowrap">
            {navFaqLabel || "常見問題"}
          </a>
          <HeaderMember />
        </div>
      </div>
    </header>
  );

  const heroBlock = getBlock("hero");
  const heroCarouselBlock = getBlock("hero_carousel");
  /** 主圖區僅顯示「首頁大圖」積木的裝飾圖；若僅有 hero_carousel 則用其裝飾圖。兩者並存時主圖只顯示 hero 的裝飾圖，hero_carousel 另列一條可選區。 */
  const iconsForMainHeroSection = heroBlock != null ? heroBlock.floatingIcons : heroCarouselBlock?.floatingIcons;
  const heroEditBlockId =
    admin?.selectedBlockId === "hero" || admin?.selectedBlockId === "hero_carousel"
      ? admin.selectedBlockId
      : null;
  const heroIconsForEditor =
    heroEditBlockId === "hero"
      ? heroBlock?.floatingIcons
      : heroEditBlockId === "hero_carousel"
        ? heroCarouselBlock?.floatingIcons
        : undefined;
  const showFloatingEditorOnMainHero =
    admin &&
    heroEditBlockId &&
    ((heroEditBlockId === "hero" && (heroBlock?.floatingIcons?.length ?? 0) > 0) ||
      (heroEditBlockId === "hero_carousel" && !heroBlock && (heroCarouselBlock?.floatingIcons?.length ?? 0) > 0));

  const heroInner = heroImageUrl ? (
    <section className="w-full pt-0 pb-4" style={admin ? {} : getBlockStyle("hero")}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-4">
        <div className="relative w-full aspect-[4/5] sm:aspect-[3/2] md:aspect-auto md:h-[600px] rounded-xl overflow-hidden bg-amber-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        {(iconsForMainHeroSection?.length ?? 0) > 0 ? (
          <div className="absolute inset-0 z-[15]">
            <HeroFloatingIconsLayer coordinateViewport={coordMode} icons={iconsForMainHeroSection!} />
            {showFloatingEditorOnMainHero && heroIconsForEditor && heroIconsForEditor.length > 0 && heroEditBlockId ? (
              <div className="pointer-events-auto absolute inset-0 z-[16]" data-floating-icon-editor>
                <HeroFloatingIconsEditor
                  overlayMode
                  coordinateMode={coordMode}
                  icons={heroIconsForEditor}
                  onChange={(next) => admin.onBlockFloatingIconsChange(heroEditBlockId, next)}
                  selectedIconId={admin.selectedFloatingIconId ?? null}
                  onIconPointerDown={(id) => admin.onSelectFloatingIcon?.(heroEditBlockId, id)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      </div>
    </section>
  ) : null;

  /** 與 heroInner 同高度，主圖 URL 尚未載入時佔位，避免下方精選／輪播先排版再被主圖推擠 */
  const heroPlaceholderInner = (
    <section className="w-full pt-0 pb-4" style={admin ? {} : getBlockStyle("hero")}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-4">
        <div
          className="relative w-full aspect-[4/5] sm:aspect-[3/2] md:aspect-auto md:h-[600px] rounded-xl overflow-hidden bg-amber-50 animate-pulse"
          aria-hidden
        />
      </div>
    </section>
  );

  const heroCarouselStripInner =
    admin && heroImageUrl && heroBlock && heroCarouselBlock ? (
      <section className="w-full border-t border-dashed border-amber-300/80 bg-amber-50/35">
        <div className="relative mx-auto max-w-7xl px-4 py-4 min-h-[100px]">
          <p className="text-xs text-center text-gray-600 relative z-0">
            首頁大圖（輪播）裝飾圖層—與上方主圖共用同一張圖；此區編輯「首頁大圖（輪播）」積木的裝飾圖。
          </p>
          {(heroCarouselBlock.floatingIcons?.length ?? 0) > 0 ? (
            <div className="pointer-events-none absolute inset-0 z-[15] mt-8">
              <HeroFloatingIconsLayer coordinateViewport={coordMode} icons={heroCarouselBlock.floatingIcons!} />
              {admin.selectedBlockId === "hero_carousel" ? (
                <div className="pointer-events-auto absolute inset-0 z-[16]" data-floating-icon-editor>
                  <HeroFloatingIconsEditor
                    overlayMode
                    coordinateMode={coordMode}
                    icons={heroCarouselBlock.floatingIcons!}
                    onChange={(next) => admin.onBlockFloatingIconsChange("hero_carousel", next)}
                    selectedIconId={admin.selectedFloatingIconId ?? null}
                    onIconPointerDown={(id) => admin.onSelectFloatingIcon?.("hero_carousel", id)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    ) : null;

  const carouselBlock = getBlock("carousel");
  const carouselInner =
    carouselList.length > 0 ? (
      <section className="w-full px-4 sm:px-4 py-4 mx-auto max-w-7xl" style={admin ? {} : getBlockStyle("carousel")}>
        <div className="relative w-full aspect-[12/5] rounded-xl overflow-hidden">
          {carouselList.map((item, i) => (
            <div
              key={item.id}
              className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${
                i === wallIndex ? "opacity-100 z-10" : "opacity-0 z-0"
              } ${item.imageUrl ? "bg-gray-900" : "bg-amber-100"}`}
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <LucideImage className="w-12 h-12 text-gray-400 relative z-10" strokeWidth={1.5} />
              )}
            </div>
          ))}
          <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1.5">
            {carouselList.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setWallIndex(i)}
                aria-label={`第 ${i + 1} 張`}
                className={`h-2 rounded-full transition-all ${
                  i === wallIndex ? "w-6 bg-amber-500" : "w-2 bg-white/80 hover:bg-white"
                }`}
              />
            ))}
          </div>
          {(carouselBlock?.floatingIcons?.length ?? 0) > 0 ? (
            <div className="pointer-events-none absolute inset-0 z-[25]">
              <HeroFloatingIconsLayer coordinateViewport={coordMode} icons={carouselBlock!.floatingIcons!} />
              {admin &&
              admin.selectedBlockId === "carousel" &&
              (carouselBlock?.floatingIcons?.length ?? 0) > 0 ? (
                <div className="pointer-events-auto absolute inset-0 z-[26]" data-floating-icon-editor>
                  <HeroFloatingIconsEditor
                    overlayMode
                    coordinateMode={coordMode}
                    icons={carouselBlock!.floatingIcons!}
                    onChange={(next) => admin.onBlockFloatingIconsChange("carousel", next)}
                    selectedIconId={admin.selectedFloatingIconId ?? null}
                    onIconPointerDown={(id) => admin.onSelectFloatingIcon?.("carousel", id)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    ) : null;

  const featuredCoursesInner = (
    <HomeFeaturedCoursesOnePlusSix
      blockStyle={admin ? {} : getBlockStyle("featured_categories")}
      prefetchedActivities={!isAdminCanvas ? featuredHomePageActivities : undefined}
      prefetchedLoading={!isAdminCanvas ? homeCoursesLoading : undefined}
    />
  );

  const aboutInner =
    aboutContent != null && aboutContent.trim() !== "" ? (
      <section
        id="about"
        className="py-12 px-4 scroll-mt-20 border-t border-gray-100"
        style={
          admin
            ? { backgroundColor: aboutSectionBackgroundColor }
            : { backgroundColor: aboutSectionBackgroundColor, ...getBlockStyle("about") }
        }
      >
        <div className="mx-auto max-w-7xl">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">{navAboutLabel || "關於我們"}</h2>
          <div
            className="prose prose-gray max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: aboutContent }}
          />
        </div>
      </section>
    ) : null;

  const faqInner = (
    <section id="faq" className="bg-white py-12 px-4 scroll-mt-20" style={admin ? {} : getBlockStyle("faq")}>
      <div className="mx-auto max-w-7xl">
        <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">常見問題</h2>
        <FAQ />
      </div>
    </section>
  );

  const contactInner = (
    <section className="bg-page border-t border-gray-100 py-12 px-4" style={admin ? {} : getBlockStyle("contact")}>
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
                  {socialFbUrl ? (
                    <a
                      href={socialFbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 text-gray-600 hover:opacity-80 transition-opacity"
                      aria-label="Facebook"
                    >
                      <span
                        className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm"
                        style={{ color: primaryColor }}
                      >
                        <Facebook className="w-5 h-5" strokeWidth={2} />
                      </span>
                      <span className="text-xs font-medium">Facebook</span>
                    </a>
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-gray-400" aria-hidden>
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm">
                        <Facebook className="w-5 h-5" strokeWidth={2} />
                      </span>
                      <span className="text-xs font-medium">Facebook</span>
                    </span>
                  )}
                  {socialIgUrl ? (
                    <a
                      href={socialIgUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 text-gray-600 hover:opacity-80 transition-opacity"
                      aria-label="Instagram"
                    >
                      <span
                        className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm"
                        style={{ color: primaryColor }}
                      >
                        <Instagram className="w-5 h-5" strokeWidth={2} />
                      </span>
                      <span className="text-xs font-medium">Instagram</span>
                    </a>
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-gray-400" aria-hidden>
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm">
                        <Instagram className="w-5 h-5" strokeWidth={2} />
                      </span>
                      <span className="text-xs font-medium">Instagram</span>
                    </span>
                  )}
                  {socialLineUrl ? (
                    <a
                      href={socialLineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 text-gray-600 hover:opacity-80 transition-opacity"
                      aria-label="LINE"
                    >
                      <span
                        className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm"
                        style={{ color: primaryColor }}
                      >
                        <LineIcon className="w-5 h-5" />
                      </span>
                      <span className="text-xs font-medium">LINE</span>
                    </a>
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-gray-400" aria-hidden>
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm">
                        <LineIcon className="w-5 h-5" />
                      </span>
                      <span className="text-xs font-medium">LINE</span>
                    </span>
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
              <iframe
                src={mapEmbedUrl}
                title="地圖"
                className="w-full h-full min-h-[240px] max-h-[320px] border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}
        </div>
        <div className="mt-8 pt-6 border-t border-gray-200 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-gray-600">
          <Link href="/privacy" className="hover:text-brand hover:underline">
            隱私權條款
          </Link>
          <Link href="/terms" className="hover:text-brand hover:underline">
            服務條款
          </Link>
        </div>
      </div>
    </section>
  );

  const footerInner = (
    <footer className="bg-white border-t border-gray-100 mt-auto" style={admin ? {} : getBlockStyle("footer")}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="text-center text-gray-400 text-sm">
          <p>© 2026 {siteName} WonderVoyage 版權所有</p>
        </div>
      </div>
    </footer>
  );

  const renderAdminFloatingIconsOverlay = (blockId: string): React.ReactNode => {
    if (!admin) return null;
    const b = getBlock(blockId);
    if (!b?.floatingIcons?.length) return null;
    return (
      <div className="pointer-events-none absolute inset-0 z-[15]">
        <HeroFloatingIconsLayer coordinateViewport={coordMode} icons={b.floatingIcons} />
        {admin.selectedBlockId === blockId ? (
          <div className="pointer-events-auto absolute inset-0 z-[16]" data-floating-icon-editor>
            <HeroFloatingIconsEditor
              overlayMode
              coordinateMode={coordMode}
              icons={b.floatingIcons}
              onChange={(next) => admin.onBlockFloatingIconsChange(blockId, next)}
              selectedIconId={admin.selectedFloatingIconId ?? null}
              onIconPointerDown={(id) => admin.onSelectFloatingIcon?.(blockId, id)}
            />
          </div>
        ) : null}
      </div>
    );
  };

  const renderCoursesGridOrListSection = (
    blockId: "courses" | "courses_grid" | "courses_list"
  ): React.ReactNode => {
    const variant = blockId === "courses_list" ? "list" : "grid";
    const inner = (
      <section className="relative w-full py-6 pb-8 bg-page" style={admin ? {} : getBlockStyle(blockId)}>
        {admin ? (
          <div className="max-w-7xl mx-auto px-4 mb-2">
            <p className="text-[11px] font-medium text-amber-900/90 bg-amber-100/60 border border-amber-200/80 rounded-lg px-2 py-1 inline-block">
              {variant === "list"
                ? "列表：橫向精簡卡（左圖右文、窄畫布亦穩定）"
                : "網格：多欄卡片"}
            </p>
          </div>
        ) : null}
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">熱門課程</h2>
          <HomeCoursesGridListBlock
            variant={variant}
            activities={homeActivities}
            loading={homeCoursesLoading}
            error={homeCoursesError}
            showPreviewHint={!!admin}
          />
        </div>
        {renderAdminFloatingIconsOverlay(blockId)}
      </section>
    );
    return admin ? wrap(blockId, inner) : inner;
  };

  /** 後台畫布專用：總站版型區塊在分站首頁不渲染，此處顯示佔位以利選取與編輯背景／高度／裝飾圖 */
  const renderAdminOnlyPlaceholder = (
    blockId:
      | "new_courses"
      | "popular_experiences"
      | "carousel_2",
    title: string,
    description: string
  ): React.ReactNode => {
    if (!admin) return null;
    const b = getBlock(blockId);
    const inner = (
      <section className="w-full border-t border-dashed border-amber-300/80 bg-amber-50/35">
        <div className="relative w-full max-w-7xl mx-auto px-4 py-8 min-h-[140px]">
          <p className="text-sm font-semibold text-center text-amber-950">{title}</p>
          <p className="text-xs text-gray-600 text-center mt-2 max-w-lg mx-auto leading-relaxed">{description}</p>
          {(b?.floatingIcons?.length ?? 0) > 0 ? (
            <div className="pointer-events-none absolute inset-0 z-[15]">
              <HeroFloatingIconsLayer coordinateViewport={coordMode} icons={b!.floatingIcons!} />
              {admin.selectedBlockId === blockId ? (
                <div className="pointer-events-auto absolute inset-0 z-[16]" data-floating-icon-editor>
                  <HeroFloatingIconsEditor
                    overlayMode
                    coordinateMode={coordMode}
                    icons={b!.floatingIcons!}
                    onChange={(next) => admin.onBlockFloatingIconsChange(blockId, next)}
                    selectedIconId={admin.selectedFloatingIconId ?? null}
                    onIconPointerDown={(id) => admin.onSelectFloatingIcon?.(blockId, id)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    );
    return wrap(blockId, inner);
  };

  const renderSectionById = (id: string): React.ReactNode => {
    switch (id) {
      case "header":
        return wrap("header", headerInner, { skipBackgroundImage: true });
      case "hero": {
        if (!heroSettingsLoaded) {
          return wrap("hero", heroPlaceholderInner, { blockOverride: heroBlock ?? undefined });
        }
        if (!heroImageUrl) return null;
        return wrap("hero", heroInner, { blockOverride: heroBlock ?? undefined });
      }
      case "hero_carousel": {
        if (!admin || !heroImageUrl) return null;
        if (heroBlock && heroCarouselBlock && heroCarouselStripInner) {
          return wrap("hero_carousel", heroCarouselStripInner);
        }
        if (!heroBlock && heroCarouselBlock) {
          return wrap("hero_carousel", heroInner, { blockOverride: heroCarouselBlock });
        }
        return null;
      }
      case "carousel":
        if (carouselList.length === 0) return null;
        return wrap("carousel", carouselInner);
      case "courses":
        return renderCoursesGridOrListSection("courses");
      case "featured_categories":
        return wrap("featured_categories", featuredCoursesInner);
      case "about":
        if (!aboutInner) return null;
        return wrap("about", aboutInner);
      case "faq":
        return wrap("faq", faqInner);
      case "contact":
        return wrap("contact", contactInner);
      case "footer":
        return wrap("footer", footerInner);
      case "new_courses":
        return renderAdminOnlyPlaceholder(
          "new_courses",
          "新上架課程",
          "後台畫布預覽區。可調整高度、背景圖、裝飾圖；目前分站首頁訪客畫面不顯示此區塊。"
        );
      case "popular_experiences":
        return renderAdminOnlyPlaceholder(
          "popular_experiences",
          "熱門體驗",
          "後台畫布預覽區。可調整高度、背景圖、裝飾圖；目前分站首頁訪客畫面不顯示此區塊。"
        );
      case "carousel_2":
        return renderAdminOnlyPlaceholder(
          "carousel_2",
          LAYOUT_SECTION_LABELS.carousel_2,
          "後台畫布預覽區。可調整高度、背景圖、裝飾圖；總站首頁輪播牆 2 於前台設定；分站訪客畫面是否顯示依版型而定。"
        );
      case "full_width_image": {
        const b = getBlock("full_width_image");
        if (admin) {
          const inner = (
            <section className="w-full border-t border-dashed border-amber-300/80 bg-amber-50/35">
              <div className="relative w-full max-w-7xl mx-auto px-4 py-8 min-h-[120px]">
                {fullWidthImageUrl ? (
                  <div className="relative w-full max-h-[220px] rounded-lg overflow-hidden bg-gray-100 border border-amber-200/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fullWidthImageUrl} alt="" className="w-full h-full max-h-[220px] object-cover" />
                  </div>
                ) : null}
                <p className="text-sm font-semibold text-center text-amber-950 mt-4">{LAYOUT_SECTION_LABELS.full_width_image}</p>
                <p className="text-xs text-gray-600 text-center mt-2 max-w-lg mx-auto leading-relaxed">
                  後台畫布預覽；於此區上傳圖後按「儲存版面」寫入前台。可調整高度、背景圖、裝飾圖。
                </p>
                {(b?.floatingIcons?.length ?? 0) > 0 ? (
                  <div className="pointer-events-none absolute inset-0 z-[15]">
                    <HeroFloatingIconsLayer coordinateViewport={coordMode} icons={b!.floatingIcons!} />
                    {admin.selectedBlockId === "full_width_image" ? (
                      <div className="pointer-events-auto absolute inset-0 z-[16]" data-floating-icon-editor>
                        <HeroFloatingIconsEditor
                          overlayMode
                          coordinateMode={coordMode}
                          icons={b!.floatingIcons!}
                          onChange={(next) => admin.onBlockFloatingIconsChange("full_width_image", next)}
                          selectedIconId={admin.selectedFloatingIconId ?? null}
                          onIconPointerDown={(id) => admin.onSelectFloatingIcon?.("full_width_image", id)}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          );
          return wrap("full_width_image", inner);
        }
        if (!fullWidthImageUrl?.trim()) return null;
        const inner = (
          <section className="relative w-full" style={getBlockStyle("full_width_image")}>
            <FullWidthImageSection imageUrl={fullWidthImageUrl} />
            {(b?.floatingIcons?.length ?? 0) > 0 ? (
              <div className="pointer-events-none absolute inset-0 z-[30] flex justify-center px-4">
                <div className="relative h-full w-full max-w-7xl">
                  <HeroFloatingIconsLayer coordinateViewport={coordMode} icons={b!.floatingIcons!} />
                </div>
              </div>
            ) : null}
          </section>
        );
        return wrap("full_width_image", inner);
      }
      case "courses_grid":
        return renderCoursesGridOrListSection("courses_grid");
      case "courses_list":
        return renderCoursesGridOrListSection("courses_list");
      default:
        return null;
    }
  };

  return (
    <div
      className="min-h-screen bg-page flex flex-col"
      {...(isAdminCanvas
        ? {
            onClickCapture: suppressCanvasLinkNavigation,
            onAuxClickCapture: suppressCanvasLinkNavigation,
          }
        : {})}
    >
      {orderedSectionIds.map((id) => {
        const node = renderSectionById(id);
        if (node == null) return null;
        return <Fragment key={id}>{node}</Fragment>;
      })}
    </div>
  );
}
