"use client";

import { parsePageBackgroundExtensionColor } from "@/app/lib/frontendSettingsShared";
import { isValidImageUrl } from "@/lib/safeMedia";

const PAGE_BG_SIZE = "100% auto" as const;

type Props = {
  pageBackgroundUrl: string | null;
  pageBackgroundMobileUrl: string | null;
  pageBackgroundExtensionColor: string | null;
  children: React.ReactNode;
};

/**
 * 後台畫布用：與前台 PublicMainSurface 分頁內文底圖邏輯一致（寬度 100%、高度 auto、桌機／手機雙層、延伸色）。
 */
export default function CanvasPageBackground({
  pageBackgroundUrl,
  pageBackgroundMobileUrl,
  pageBackgroundExtensionColor,
  children,
}: Props) {
  const d = pageBackgroundUrl?.trim() && isValidImageUrl(pageBackgroundUrl) ? pageBackgroundUrl : null;
  const m = pageBackgroundMobileUrl?.trim() && isValidImageUrl(pageBackgroundMobileUrl) ? pageBackgroundMobileUrl : null;
  const forDesktop = d ?? m;
  const forMobile = m ?? d;
  const hasBg = !!(forDesktop || forMobile);
  const extensionFill = hasBg ? parsePageBackgroundExtensionColor(pageBackgroundExtensionColor) : null;

  if (!hasBg) {
    return (
      <div className="relative z-0 flex w-full min-h-min min-w-0 flex-col bg-[#f3f4f6]/80">{children}</div>
    );
  }

  return (
    <div
      className={
        extensionFill
          ? "relative z-0 flex w-full min-h-min min-w-0 flex-col"
          : "relative z-0 flex w-full min-h-min min-w-0 flex-col bg-page/50"
      }
      style={extensionFill ? { backgroundColor: extensionFill } : undefined}
    >
      {forDesktop ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 hidden bg-no-repeat md:block"
          style={{
            backgroundImage: `url(${forDesktop})`,
            backgroundSize: PAGE_BG_SIZE,
            backgroundPosition: "top center",
          }}
          aria-hidden
        />
      ) : null}
      {forMobile ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-no-repeat md:hidden"
          style={{
            backgroundImage: `url(${forMobile})`,
            backgroundSize: PAGE_BG_SIZE,
            backgroundPosition: "top center",
          }}
          aria-hidden
        />
      ) : null}
      <div className="relative z-[1] flex w-full min-h-min min-w-0 flex-col">{children}</div>
    </div>
  );
}
