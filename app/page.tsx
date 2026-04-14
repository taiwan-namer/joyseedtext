"use client";

import { useState, useEffect } from "react";
import { getFrontendSettings } from "./actions/frontendSettingsActions";
import type { CarouselItem } from "./lib/frontendSettingsShared";
import { getDefaultLayoutBlocks, type LayoutBlock } from "./lib/frontendSettingsShared";
import BranchSiteHomeView from "./components/home/BranchSiteHomeView";

export default function WonderVoyageHomePage() {
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
  const [navAboutLabel, setNavAboutLabel] = useState("關於我們");
  const [navCoursesLabel, setNavCoursesLabel] = useState("課程介紹");
  const [navBookingLabel, setNavBookingLabel] = useState("課程預約");
  const [navFaqLabel, setNavFaqLabel] = useState("常見問題");
  const [aboutContent, setAboutContent] = useState<string | null>(null);
  const [layoutBlocks, setLayoutBlocks] = useState<LayoutBlock[]>(getDefaultLayoutBlocks());

  useEffect(() => {
    getFrontendSettings().then((s) => {
      setHeroImageUrl(s.heroImageUrl);
      setCarouselItems(
        s.carouselItems.length > 0
          ? s.carouselItems
          : [
              { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
              { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
              { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
            ]
      );
      setNavAboutLabel(s.navAboutLabel || "關於我們");
      setNavCoursesLabel(s.navCoursesLabel || "課程介紹");
      setNavBookingLabel(s.navBookingLabel || "課程預約");
      setNavFaqLabel(s.navFaqLabel || "常見問題");
      setAboutContent(s.aboutContent ?? null);
      setLayoutBlocks(s.layoutBlocks && s.layoutBlocks.length > 0 ? s.layoutBlocks : getDefaultLayoutBlocks());
    });
  }, []);

  return (
    <BranchSiteHomeView
      layoutBlocks={layoutBlocks}
      heroImageUrl={heroImageUrl}
      carouselItems={carouselItems}
      aboutContent={aboutContent}
      navAboutLabel={navAboutLabel}
      navCoursesLabel={navCoursesLabel}
      navBookingLabel={navBookingLabel}
      navFaqLabel={navFaqLabel}
    />
  );
}
