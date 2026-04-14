"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  HeroSection,
  HeroCarouselSection,
  CarouselSection,
  FullWidthImageSection,
  CoursesSection,
  AboutSection,
  FAQSection,
  ContactSection,
  FooterSection,
} from "@/app/components/home";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import BlockWrapper from "./BlockWrapper";
import HeroFloatingIconsEditor from "./HeroFloatingIconsEditor";
import HeroFloatingIconsLayer from "@/app/components/home/HeroFloatingIconsLayer";
import type { HeroFloatingIcon, LayoutBlock } from "@/app/lib/frontendSettingsShared";
import type { CarouselItem } from "@/app/lib/frontendSettingsShared";
import type { Activity } from "@/app/lib/homeSectionTypes";
import { LAYOUT_SECTION_LABELS } from "@/app/lib/frontendSettingsShared";

const DEFAULT_CAROUSEL = [
  { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
  { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
  { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
];

type LayoutCanvasProps = {
  blocks: LayoutBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onBlockResizeHeight: (blockId: string, heightPx: number | null) => void;
  onBlockFloatingIconsChange: (blockId: string, next: HeroFloatingIcon[]) => void;
  heroImageUrl: string | null;
  carouselItems: CarouselItem[];
  aboutContent: string | null;
  navAboutLabel: string;
  navCoursesLabel: string;
  navBookingLabel: string;
  navFaqLabel: string;
  activities: Activity[];
  fullWidthImageUrl: string | null;
  floatingIconsCoordinateMode?: "desktop" | "mobile";
};

export default function LayoutCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onBlockResizeHeight,
  onBlockFloatingIconsChange,
  heroImageUrl,
  carouselItems,
  aboutContent,
  navAboutLabel,
  navCoursesLabel,
  navBookingLabel,
  navFaqLabel,
  activities,
  fullWidthImageUrl,
  floatingIconsCoordinateMode = "desktop",
}: LayoutCanvasProps) {
  const {
    siteName,
    primaryColor,
    aboutSectionBackgroundColor,
    contactEmail,
    contactPhone,
    contactAddress,
    socialFbUrl,
    socialIgUrl,
    socialLineUrl,
  } = useStoreSettings();
  const mapEmbedUrl = contactAddress?.trim()
    ? `https://www.google.com/maps?q=${encodeURIComponent(contactAddress.trim())}&output=embed`
    : "";
  const carouselList = (carouselItems.length > 0 ? carouselItems : DEFAULT_CAROUSEL).filter(
    (item) => item.visible !== false
  );

  const renderSection = (block: LayoutBlock) => {
    const isSelected = selectedBlockId === block.id;
    const label = block.title?.trim() || LAYOUT_SECTION_LABELS[block.id] || block.id;

    const wrapWithFloats = (inner: ReactNode) => {
      const icons = block.floatingIcons ?? [];
      const showFloat = icons.length > 0;
      if (!showFloat) return inner;
      return (
        <div className="relative w-full">
          {inner}
          <div className="pointer-events-none absolute inset-0 z-[30]">
            <HeroFloatingIconsLayer coordinateViewport={floatingIconsCoordinateMode} icons={icons} />
            {isSelected ? (
              <HeroFloatingIconsEditor
                overlayMode
                coordinateMode={floatingIconsCoordinateMode}
                icons={icons}
                onChange={(next) => onBlockFloatingIconsChange(block.id, next)}
              />
            ) : null}
          </div>
        </div>
      );
    };

    const content = (() => {
      switch (block.id) {
        case "header":
          return (
            <header className="bg-white border-b border-gray-100 shadow-sm">
              <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-2">
                <h1 className="text-xl font-bold text-amber-600 shrink-0">{siteName}</h1>
                <div className="flex items-center gap-2 sm:gap-3 shrink min-w-0 overflow-x-auto scrollbar-hide text-sm text-gray-600">
                  <span className="whitespace-nowrap">{navAboutLabel || "關於我們"}</span>
                  <Link href="/courses" className="whitespace-nowrap hover:text-amber-600">
                    {navCoursesLabel || "課程介紹"}
                  </Link>
                  <Link href="/course/booking" className="whitespace-nowrap hover:text-amber-600">
                    {navBookingLabel || "課程預約"}
                  </Link>
                  <span className="whitespace-nowrap">{navFaqLabel || "常見問題"}</span>
                  <span className="whitespace-nowrap text-gray-400">登入</span>
                </div>
              </div>
            </header>
          );
        case "hero":
          return wrapWithFloats(<HeroSection heroImageUrl={heroImageUrl} />);
        case "hero_carousel":
          return wrapWithFloats(<HeroCarouselSection carouselList={carouselList} />);
        case "featured_categories":
          return (
            <section className="py-10 px-4 bg-gray-50 text-center text-gray-600">
              <p className="text-sm text-gray-500">精選課程分館（前台完整版將與總站一致）</p>
            </section>
          );
        case "carousel":
        case "carousel_2":
          return <CarouselSection carouselList={carouselList} />;
        case "full_width_image":
          return <FullWidthImageSection imageUrl={fullWidthImageUrl} />;
        case "courses":
          return <CoursesSection activities={activities} variant="carousel" />;
        case "courses_grid":
          return <CoursesSection activities={activities} variant="grid" />;
        case "courses_list":
          return <CoursesSection activities={activities} variant="list" />;
        case "new_courses":
          return (
            <section className="py-10 px-4 bg-white text-center">
              <p className="text-sm text-gray-500">新上架課程（與熱門課程同資料來源；樣式可於前台擴充）</p>
              <CoursesSection activities={activities} variant="carousel" />
            </section>
          );
        case "popular_experiences":
          return (
            <section className="py-10 px-4 bg-gray-50 text-center">
              <p className="text-sm text-gray-500">熱門體驗（與熱門課程同資料來源；樣式可於前台擴充）</p>
              <CoursesSection activities={activities} variant="grid" />
            </section>
          );
        case "about":
          return (
            <AboutSection
              aboutContent={aboutContent}
              navAboutLabel={navAboutLabel}
              aboutSectionBackgroundColor={aboutSectionBackgroundColor}
            />
          );
        case "faq":
          return <FAQSection />;
        case "contact":
          return (
            <ContactSection
              siteName={siteName}
              primaryColor={primaryColor}
              contactPhone={contactPhone}
              contactEmail={contactEmail}
              contactAddress={contactAddress}
              socialFbUrl={socialFbUrl}
              socialIgUrl={socialIgUrl}
              socialLineUrl={socialLineUrl}
              mapEmbedUrl={mapEmbedUrl}
            />
          );
        case "footer":
          return <FooterSection siteName={siteName} />;
        default:
          return (
            <section className="p-6 text-center text-gray-500">
              <span>區塊：{label}</span>
            </section>
          );
      }
    })();

    return (
      <BlockWrapper
        key={block.id}
        block={block}
        isSelected={isSelected}
        onSelect={() => onSelectBlock(block.id)}
        onResizeHeight={(heightPx) => onBlockResizeHeight(block.id, heightPx)}
        blockLabel={label}
      >
        {content}
      </BlockWrapper>
    );
  };

  return (
    <div className="w-full space-y-0 bg-gray-50 rounded-b-lg">
      {blocks.filter((b) => b.enabled !== false).map((block) => renderSection(block))}
    </div>
  );
}
