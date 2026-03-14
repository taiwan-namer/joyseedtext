"use client";

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
import type { LayoutBlock } from "@/app/lib/frontendSettingsShared";
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
  heroImageUrl: string | null;
  carouselItems: CarouselItem[];
  aboutContent: string | null;
  navAboutLabel: string;
  activities: Activity[];
  fullWidthImageUrl: string | null;
};

export default function LayoutCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onBlockResizeHeight,
  heroImageUrl,
  carouselItems,
  aboutContent,
  navAboutLabel,
  activities,
  fullWidthImageUrl,
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
    const label = LAYOUT_SECTION_LABELS[block.id] ?? block.id;

    const content = (() => {
      switch (block.id) {
        case "hero":
          return <HeroSection heroImageUrl={heroImageUrl} />;
        case "hero_carousel":
          return <HeroCarouselSection carouselList={carouselList} />;
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
      {blocks.map((block) => renderSection(block))}
    </div>
  );
}
