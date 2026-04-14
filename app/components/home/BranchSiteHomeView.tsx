"use client";

import Link from "next/link";
import { Image as LucideImage, Facebook, Instagram } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import FAQ from "@/app/components/FAQ";
import { HeaderMember } from "@/app/components/HeaderMember";
import HomeMarketplaceCoursesSection from "@/app/components/home/HomeMarketplaceCoursesSection";
import HeroFloatingIconsLayer from "@/app/components/home/HeroFloatingIconsLayer";
import BlockWrapper from "@/app/admin/(protected)/layout/BlockWrapper";
import HeroFloatingIconsEditor from "@/app/admin/(protected)/layout/HeroFloatingIconsEditor";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import type { AdminLayoutCanvasConfig } from "@/app/admin/(protected)/layout/adminLayoutCanvasTypes";
import type { CarouselItem, LayoutBlock } from "@/app/lib/frontendSettingsShared";
import { LAYOUT_SECTION_LABELS } from "@/app/lib/frontendSettingsShared";

const CAROUSEL_INTERVAL_MS = 4000;

function LineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.127h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

export type BranchSiteHomeViewProps = {
  layoutBlocks: LayoutBlock[];
  heroImageUrl: string | null;
  carouselItems: CarouselItem[];
  aboutContent: string | null;
  navAboutLabel: string;
  navCoursesLabel: string;
  navBookingLabel: string;
  navFaqLabel: string;
  /** 後台畫布：區塊選取、高度、裝飾圖編輯 */
  adminLayout?: AdminLayoutCanvasConfig | null;
};

export default function BranchSiteHomeView({
  layoutBlocks,
  heroImageUrl,
  carouselItems,
  aboutContent,
  navAboutLabel,
  navCoursesLabel,
  navBookingLabel,
  navFaqLabel,
  adminLayout = null,
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

  const wrap = (
    blockId: string,
    children: React.ReactNode,
    opts?: { skipBackgroundImage?: boolean }
  ): React.ReactNode => {
    const block = layoutBlocks.find((b) => b.id === blockId);
    if (!admin || !block) return children;
    return (
      <BlockWrapper
        block={block}
        isSelected={admin.selectedBlockId === blockId}
        onSelect={() => admin.onSelectBlock(blockId)}
        onResizeHeight={(heightPx) => admin.onBlockResizeHeight(blockId, heightPx)}
        blockLabel={LAYOUT_SECTION_LABELS[blockId] ?? blockId}
        skipBackgroundImage={opts?.skipBackgroundImage}
      >
        {children}
      </BlockWrapper>
    );
  };

  const headerInner = (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-brand shrink-0">{siteName}</h1>
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
  const heroMergedIcons =
    heroBlock?.floatingIcons?.length ? heroBlock.floatingIcons : heroCarouselBlock?.floatingIcons;
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

  const heroInner = heroImageUrl ? (
    <section className="px-0 pt-0 pb-4" style={admin ? {} : getBlockStyle("hero")}>
      <div className="relative w-full aspect-[4/5] sm:aspect-[3/2] md:aspect-auto md:h-[600px] rounded-xl overflow-hidden bg-amber-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none"
          aria-hidden
        />
        {(heroMergedIcons?.length ?? 0) > 0 ? (
          <div className="absolute inset-0 z-[15]">
            <HeroFloatingIconsLayer coordinateViewport={coordMode} icons={heroMergedIcons!} />
            {admin && heroIconsForEditor && heroIconsForEditor.length > 0 && heroEditBlockId ? (
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
    </section>
  ) : null;

  const carouselBlock = getBlock("carousel");
  const carouselInner =
    carouselList.length > 0 ? (
      <section className="px-0 py-4" style={admin ? {} : getBlockStyle("carousel")}>
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

  const coursesInner = <HomeMarketplaceCoursesSection blockStyle={admin ? {} : getBlockStyle("courses")} />;

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

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {wrap("header", headerInner, { skipBackgroundImage: true })}

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-4">
        {heroImageUrl ? wrap("hero", heroInner) : null}
        {carouselList.length > 0 ? wrap("carousel", carouselInner) : null}
      </main>

      {wrap("courses", coursesInner)}
      {aboutInner ? wrap("about", aboutInner) : null}
      {wrap("faq", faqInner)}
      {wrap("contact", contactInner)}
      {wrap("footer", footerInner)}
    </div>
  );
}
