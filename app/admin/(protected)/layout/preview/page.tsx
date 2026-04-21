"use client";

import { useCallback, useEffect, useState } from "react";
import LayoutCanvas from "../LayoutCanvas";
import {
  LAYOUT_MOBILE_PREVIEW_WIDTH_PX,
  LAYOUT_PREVIEW_BLOCK_HEIGHT,
  LAYOUT_PREVIEW_FLOATING_ICONS,
  LAYOUT_PREVIEW_READY,
  LAYOUT_PREVIEW_SELECT_BLOCK,
  LAYOUT_PREVIEW_SELECT_FLOATING_ICON,
  LAYOUT_PREVIEW_SELECT_VIEWPORT_FLOATING_ICON,
  LAYOUT_PREVIEW_SYNC_TYPE,
  LAYOUT_PREVIEW_VIEWPORT_FLOATING_ICONS,
  type LayoutPreviewSyncPayload,
} from "../layoutPreviewSync";
import type { HeroFloatingIcon } from "@/app/lib/frontendSettingsShared";

function postToParent(msg: Record<string, unknown>) {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage(msg, window.location.origin);
}

export default function AdminLayoutMobilePreviewPage() {
  const [payload, setPayload] = useState<LayoutPreviewSyncPayload | null>(null);

  useEffect(() => {
    postToParent({ type: LAYOUT_PREVIEW_READY });
    const t = window.setInterval(() => {
      if (payload) return;
      postToParent({ type: LAYOUT_PREVIEW_READY });
    }, 800);
    return () => window.clearInterval(t);
  }, [payload]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (!e.data || e.data.type !== LAYOUT_PREVIEW_SYNC_TYPE) return;
      setPayload(e.data.payload as LayoutPreviewSyncPayload);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const onSelectBlock = useCallback((id: string) => {
    postToParent({ type: LAYOUT_PREVIEW_SELECT_BLOCK, blockId: id });
  }, []);

  const onBlockResizeHeight = useCallback((blockId: string, heightPx: number | null) => {
    postToParent({ type: LAYOUT_PREVIEW_BLOCK_HEIGHT, blockId, heightPx });
  }, []);

  const onBlockFloatingIconsChange = useCallback((blockId: string, next: HeroFloatingIcon[]) => {
    postToParent({ type: LAYOUT_PREVIEW_FLOATING_ICONS, blockId, icons: next });
  }, []);

  const onSelectFloatingIcon = useCallback((blockId: string, iconId: string) => {
    postToParent({ type: LAYOUT_PREVIEW_SELECT_FLOATING_ICON, blockId, iconId });
  }, []);

  const onViewportFloatingIconsChange = useCallback((next: HeroFloatingIcon[]) => {
    postToParent({ type: LAYOUT_PREVIEW_VIEWPORT_FLOATING_ICONS, icons: next });
  }, []);

  const onSelectViewportFloatingIcon = useCallback((id: string | null) => {
    postToParent({ type: LAYOUT_PREVIEW_SELECT_VIEWPORT_FLOATING_ICON, id });
  }, []);

  if (!payload) {
    return (
      <div className="fixed inset-0 z-[200] flex min-h-0 items-center justify-center overflow-auto bg-gray-100 px-4 text-sm text-gray-500">
        與編輯頁連線中…
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] min-w-0 overflow-auto overflow-x-hidden bg-gray-100">
      <LayoutCanvas
        blocks={payload.blocks}
        selectedBlockId={payload.selectedBlockId}
        onSelectBlock={onSelectBlock}
        onBlockResizeHeight={onBlockResizeHeight}
        floatingIconsCoordinateMode="mobile"
        selectedFloatingIconId={payload.selectedFloatingIconId ?? null}
        onSelectFloatingIcon={onSelectFloatingIcon}
        designWidthPx={LAYOUT_MOBILE_PREVIEW_WIDTH_PX}
        zoomPercent={payload.mobileCanvasZoomPct}
        heroImageUrl={payload.heroImageUrl}
        carouselItems={payload.carouselItems}
        aboutContent={payload.aboutContent}
        navAboutLabel={payload.navAboutLabel}
        navCoursesLabel={payload.navCoursesLabel}
        navBookingLabel={payload.navBookingLabel}
        navFaqLabel={payload.navFaqLabel}
        activities={payload.activities}
        fullWidthImageUrl={payload.fullWidthImageUrl}
        logoUrl={payload.logoUrl}
        headerBackgroundUrl={payload.headerBackgroundUrl}
        headerBackgroundMobileUrl={payload.headerBackgroundMobileUrl}
        showProductMenu={payload.showProductMenu}
        pageBackgroundUrl={payload.pageBackgroundUrl}
        pageBackgroundMobileUrl={payload.pageBackgroundMobileUrl}
        pageBackgroundExtensionColor={payload.pageBackgroundExtensionColor}
        footerBackgroundUrl={payload.footerBackgroundUrl}
        footerBackgroundMobileUrl={payload.footerBackgroundMobileUrl}
        featuredCategories={payload.featuredCategories}
        featuredSectionIconUrl={payload.featuredSectionIconUrl}
        heroBackgroundUrl={payload.heroBackgroundUrl}
        heroBackgroundMobileUrl={payload.heroBackgroundMobileUrl}
        heroTitle={payload.heroTitle}
        homeCarouselMidStripBackgroundUrl={payload.homeCarouselMidStripBackgroundUrl}
        homeCarouselSectionBackgroundUrl={payload.homeCarouselSectionBackgroundUrl}
        homeMidBannerSectionBackgroundUrl={payload.homeMidBannerSectionBackgroundUrl}
        homeMidBannerImageUrl={payload.homeMidBannerImageUrl}
        homeMidBannerLinkUrl={payload.homeMidBannerLinkUrl}
        homeCoursesBlockBackgroundUrl={payload.homeCoursesBlockBackgroundUrl}
        homeCoursesBlockBackgroundMobileUrl={payload.homeCoursesBlockBackgroundMobileUrl}
        homeNewCoursesIconUrl={payload.homeNewCoursesIconUrl}
        aboutPageUrl={payload.aboutPageUrl}
        onBlockFloatingIconsChange={onBlockFloatingIconsChange}
        viewportFloatingIcons={payload.viewportFloatingIcons ?? []}
        onViewportFloatingIconsChange={onViewportFloatingIconsChange}
        viewportSelectedFloatingIconId={payload.viewportSelectedFloatingIconId ?? null}
        onSelectViewportFloatingIcon={onSelectViewportFloatingIcon}
      />
    </div>
  );
}
