"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import BranchSiteHomeView from "./components/home/BranchSiteHomeView";
import type { CourseForPublic } from "./actions/productActions";
import type { FrontendSettings } from "./lib/frontendSettingsShared";
import {
  getDefaultLayoutBlocks,
  type CarouselItem,
  type LayoutBlock,
  DEFAULT_ABOUT_PAGE_URL,
  normalizeAboutPageUrl,
} from "./lib/frontendSettingsShared";

export type HomePageClientProps = {
  settings: FrontendSettings;
  homeCourses: CourseForPublic[];
  homeCoursesError: string | null;
};

const DEFAULT_CAROUSEL_FALLBACK: CarouselItem[] = [
  { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
  { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
  { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
];

/**
 * 首頁 client 殼：資料由伺服端 {@link app/page.tsx} 並行載入後注入，避免 useEffect 瀑布。
 */
export default function HomePageClient({ settings, homeCourses, homeCoursesError }: HomePageClientProps) {
  const router = useRouter();
  const carouselItems: CarouselItem[] =
    settings.carouselItems.length > 0 ? settings.carouselItems : DEFAULT_CAROUSEL_FALLBACK;

  const layoutBlocks: LayoutBlock[] =
    settings.layoutBlocks && settings.layoutBlocks.length > 0 ? settings.layoutBlocks : getDefaultLayoutBlocks();

  /** 首頁進入後預抓導覽常用站內頁（含手機點「關於我們」「課程介紹」「會員中心」時較快顯示） */
  useEffect(() => {
    const aboutHref = normalizeAboutPageUrl(settings.aboutPageUrl ?? DEFAULT_ABOUT_PAGE_URL);
    if (!/^https?:\/\//i.test(aboutHref)) {
      router.prefetch(aboutHref);
    }
    router.prefetch("/courses");
    router.prefetch("/member");
  }, [router, settings.aboutPageUrl]);

  return (
    <BranchSiteHomeView
      layoutBlocks={layoutBlocks}
      heroSettingsLoaded
      heroImageUrl={settings.heroImageUrl}
      fullWidthImageUrl={settings.fullWidthImageUrl ?? null}
      carouselItems={carouselItems}
      aboutContent={settings.aboutContent ?? null}
      navAboutLabel={settings.navAboutLabel || "關於我們"}
      navCoursesLabel={settings.navCoursesLabel || "課程介紹"}
      navBookingLabel={settings.navBookingLabel || "課程預約"}
      navFaqLabel={settings.navFaqLabel || "常見問題"}
      aboutPageUrl={settings.aboutPageUrl ?? DEFAULT_ABOUT_PAGE_URL}
      serverHomeCourses={{ courses: homeCourses, error: homeCoursesError }}
      viewportFloatingIcons={settings.viewportFloatingIcons ?? []}
    />
  );
}
