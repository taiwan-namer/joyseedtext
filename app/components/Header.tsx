"use client";

import { Suspense, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { HeaderMember } from "./HeaderMember";
import HeroFloatingIconsLayer from "@/app/components/home/HeroFloatingIconsLayer";
import type { HeroFloatingIcon } from "@/app/lib/frontendSettingsShared";

export type HeaderProps = {
  siteName: string;
  /** 後台設定的 LOGO URL；未上傳則不顯示預設圖，改顯示站名 */
  logoUrl?: string | null;
  /** 後台設定的 Header 背景圖 URL，有則作為 header 背景 */
  headerBackgroundUrl?: string | null;
  /** 手機版 Header 背景（可選；未設定則與桌機共用） */
  headerBackgroundMobileUrl?: string | null;
  showProductMenu?: boolean;
  navAboutLabel?: string;
  navCoursesLabel?: string;
  navBookingLabel?: string;
  navFaqLabel?: string;
  /** 首頁版面「上方導覽列」積木之裝飾圖 */
  floatingIcons?: HeroFloatingIcon[] | null;
};

export default function Header({
  siteName,
  logoUrl,
  headerBackgroundUrl,
  headerBackgroundMobileUrl,
  showProductMenu = false,
  navAboutLabel = "關於我們",
  navCoursesLabel = "課程資訊",
  navBookingLabel = "課程預約",
  navFaqLabel = "常見問題",
  floatingIcons,
}: HeaderProps) {
  const router = useRouter();
  useEffect(() => {
    router.prefetch("/courses");
  }, [router]);

  const hasLogo = !!(logoUrl && logoUrl.trim());
  const desk = headerBackgroundUrl?.trim() || null;
  const mob = headerBackgroundMobileUrl?.trim() || null;
  const hasHeaderBg = !!(desk || mob);
  const mobileBg = mob || desk;
  const desktopBg = desk || mob;

  return (
    <header className="w-full shrink-0 h-[100px] box-border py-2 relative z-[100] shadow-sm overflow-visible bg-[var(--color-about-section-bg)]">
      {hasHeaderBg && mob && desk ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat md:hidden"
            style={{ backgroundImage: `url(${mobileBg})` }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-0 hidden bg-cover bg-center bg-no-repeat md:block"
            style={{ backgroundImage: `url(${desktopBg})` }}
            aria-hidden
          />
        </>
      ) : hasHeaderBg ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${desktopBg})` }}
          aria-hidden
        />
      ) : null}
      <div className="relative z-10 max-w-[1200px] w-full h-full min-h-0 mx-auto px-4 lg:px-8 flex items-center justify-between">
        {/* 左側：空白佔位（與 joyseedisland 版頭結構一致） */}
        <div className="w-1/3" aria-hidden />

        {/* 中間：LOGO 置中（僅後台有上傳時顯示，無則顯示站名） */}
        <div className="w-[30%] flex justify-center items-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center translate-y-[22px] sm:translate-y-[26px]"
          >
            {hasLogo ? (
              <Image
                src={logoUrl!.trim()}
                alt={`${siteName} Logo`}
                width={320}
                height={112}
                sizes="(max-width: 640px) 200px, 224px"
                className="block object-contain w-auto max-h-[112px] h-auto"
                priority
              />
            ) : (
              <span className="text-lg font-semibold text-gray-800">{siteName}</span>
            )}
          </Link>
        </div>

        {/* 右側：按鈕群（課程搜尋 + 會員），靠右排列 */}
        <div className="w-1/3 flex justify-end items-center gap-4">
          <Link
            href="/courses"
            prefetch={true}
            className="text-gray-600 hover:text-amber-600 text-sm whitespace-nowrap flex items-center gap-1"
            aria-label="課程搜尋"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">課程搜尋</span>
          </Link>
          <Suspense
            fallback={
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100"
                aria-hidden
              />
            }
          >
            <HeaderMember />
          </Suspense>
        </div>
      </div>
      {floatingIcons && floatingIcons.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-[110] flex justify-center" aria-hidden>
          <div className="relative h-full w-full max-w-[1200px] px-4 lg:px-8">
            <HeroFloatingIconsLayer icons={floatingIcons} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
