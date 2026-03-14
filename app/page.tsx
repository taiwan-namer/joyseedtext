"use client";

import Link from "next/link";
import { HeaderMember } from "./components/HeaderMember";
import { useStoreSettings } from "./providers/StoreSettingsProvider";
import { useState, useEffect } from "react";
import { getCoursesForHomepage } from "./actions/productActions";
import { getFrontendSettings } from "./actions/frontendSettingsActions";
import type { CarouselItem } from "./lib/frontendSettingsShared";
import { DEFAULT_LAYOUT_ORDER } from "./lib/frontendSettingsShared";
import type { Activity } from "./lib/homeSectionTypes";
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
} from "./components/home";

const DEFAULT_CAROUSEL: CarouselItem[] = [
  { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
  { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
  { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
];

export default function WonderVoyageHomePage() {
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
  const mapEmbedUrl = contactAddress?.trim()
    ? `https://www.google.com/maps?q=${encodeURIComponent(contactAddress.trim())}&output=embed`
    : "";

  const [activities, setActivities] = useState<Activity[]>([]);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
  const [navAboutLabel, setNavAboutLabel] = useState("關於我們");
  const [navCoursesLabel, setNavCoursesLabel] = useState("課程介紹");
  const [navBookingLabel, setNavBookingLabel] = useState("課程預約");
  const [navFaqLabel, setNavFaqLabel] = useState("常見問題");
  const [aboutContent, setAboutContent] = useState<string | null>(null);
  const [layoutOrder, setLayoutOrder] = useState<string[]>(DEFAULT_LAYOUT_ORDER);
  const [fullWidthImageUrl, setFullWidthImageUrl] = useState<string | null>(null);

  useEffect(() => {
    getFrontendSettings().then((s) => {
      setHeroImageUrl(s.heroImageUrl);
      setCarouselItems(
        s.carouselItems.length > 0 ? s.carouselItems : DEFAULT_CAROUSEL
      );
      setNavAboutLabel(s.navAboutLabel || "關於我們");
      setNavCoursesLabel(s.navCoursesLabel || "課程介紹");
      setNavBookingLabel(s.navBookingLabel || "課程預約");
      setNavFaqLabel(s.navFaqLabel || "常見問題");
      setAboutContent(s.aboutContent ?? null);
      setLayoutOrder(
        Array.isArray(s.layoutOrder) && s.layoutOrder.length > 0
          ? s.layoutOrder
          : DEFAULT_LAYOUT_ORDER
      );
      setFullWidthImageUrl(s.fullWidthImageUrl ?? null);
    });
  }, []);

  useEffect(() => {
    getCoursesForHomepage().then((res) => {
      if (res.success && res.data.length > 0) {
        setActivities(
          res.data.map((c) => ({
            id: c.id,
            title: c.title,
            price:
              c.salePrice != null && c.price != null && c.salePrice < c.price
                ? c.salePrice
                : c.price ?? 0,
            stock: c.capacity ?? 0,
            imageUrl: c.imageUrl ?? null,
            detailHref: `/course/${c.id}`,
            ageTags: c.sidebarOptionLabels ?? c.ageTags ?? [],
            category: "課程",
            description: c.courseIntro
              ? c.courseIntro.slice(0, 80) +
                (c.courseIntro.length > 80 ? "…" : "")
              : undefined,
          }))
        );
      }
    });
  }, []);

  const carouselList = (carouselItems.length > 0 ? carouselItems : DEFAULT_CAROUSEL).filter(
    (item) => item.visible !== false
  );

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-brand shrink-0">{siteName}</h1>
          <div className="flex items-center gap-2 sm:gap-3 shrink min-w-0 overflow-x-auto scrollbar-hide">
            <a
              href="#about"
              className="text-gray-600 hover:text-brand text-sm whitespace-nowrap"
            >
              {navAboutLabel || "關於我們"}
            </a>
            <Link
              href="/courses"
              className="text-gray-600 hover:text-brand text-sm whitespace-nowrap"
            >
              {navCoursesLabel || "課程介紹"}
            </Link>
            <Link
              href="/course/booking"
              className="text-gray-600 hover:text-brand text-sm whitespace-nowrap"
            >
              {navBookingLabel || "課程預約"}
            </Link>
            <a
              href="#faq"
              className="text-gray-600 hover:text-brand text-sm whitespace-nowrap"
            >
              {navFaqLabel || "常見問題"}
            </a>
            <HeaderMember />
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        {layoutOrder.map((sectionId) => {
          switch (sectionId) {
            case "hero":
              return <HeroSection key="hero" heroImageUrl={heroImageUrl} />;
            case "hero_carousel":
              return (
                <HeroCarouselSection key="hero_carousel" carouselList={carouselList} />
              );
            case "carousel":
              return (
                <CarouselSection key="carousel" carouselList={carouselList} />
              );
            case "carousel_2":
              return (
                <CarouselSection key="carousel_2" carouselList={carouselList} />
              );
            case "full_width_image":
              return (
                <FullWidthImageSection key="full_width_image" imageUrl={fullWidthImageUrl} />
              );
            case "courses":
              return (
                <CoursesSection key="courses" activities={activities} variant="carousel" />
              );
            case "courses_grid":
              return (
                <CoursesSection key="courses_grid" activities={activities} variant="grid" />
              );
            case "courses_list":
              return (
                <CoursesSection key="courses_list" activities={activities} variant="list" />
              );
            case "about":
              return (
                <AboutSection
                  key="about"
                  aboutContent={aboutContent}
                  navAboutLabel={navAboutLabel}
                  aboutSectionBackgroundColor={aboutSectionBackgroundColor}
                />
              );
            case "faq":
              return <FAQSection key="faq" />;
            case "contact":
              return (
                <ContactSection
                  key="contact"
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
              return <FooterSection key="footer" siteName={siteName} />;
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
