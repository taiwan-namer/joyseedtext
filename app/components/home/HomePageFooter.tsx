"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import HeroFloatingIconsLayer from "@/app/components/home/HeroFloatingIconsLayer";
import type { HeroFloatingIcon } from "@/app/lib/frontendSettingsShared";

type Props = {
  footerBackgroundUrl: string | null;
  footerBackgroundMobileUrl: string | null;
  footerSurfaceStyle: CSSProperties;
  /** 後台設定的「關於」連結（站內路徑或 http(s)） */
  aboutPageUrl: string;
  /** 首頁版面「頁尾」積木之裝飾圖 */
  floatingIcons?: HeroFloatingIcon[];
};

type FooterColumn = {
  id: string;
  title: string;
  desktopClassName: string;
  /** 手機版收合區內文（略向左貼齊，減少與左緣距離） */
  mobileBodyClassName?: string;
  body: ReactNode;
};

function FooterCopyrightUnderContact({ hasFooterBg }: { hasFooterBg: boolean }) {
  return (
    <div
      role="contentinfo"
      className={`mt-4 border-t pt-4 ${
        hasFooterBg ? "border-white/25" : "border-gray-200"
      }`}
    >
      <p
        className={`text-left text-xs font-semibold leading-snug ${
          hasFooterBg
            ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
            : "text-gray-600"
        }`}
      >
        Copyright © {new Date().getFullYear()} 童趣島 Ltd. All rights reserved.
      </p>
    </div>
  );
}

function AboutFooterLink({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:\/\//i.test(href);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="hover:underline">
      {children}
    </Link>
  );
}

export default function HomePageFooter({
  footerBackgroundUrl,
  footerBackgroundMobileUrl,
  footerSurfaceStyle,
  aboutPageUrl,
  floatingIcons,
}: Props) {
  const [showBackTop, setShowBackTop] = useState(false);
  /** 手機頁尾收合區：同時間僅展開一欄 */
  const [footerOpenSectionId, setFooterOpenSectionId] = useState<string | null>(null);
  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const footerColumns = useMemo((): FooterColumn[] => {
    return [
      {
        id: "contact",
        title: "聯絡童趣島",
        desktopClassName: "min-w-0 md:-translate-x-[50px] lg:translate-x-0 lg:-ml-[102px]",
        mobileBodyClassName: "-ml-2",
        body: (
          <>
            <p>童趣島有限公司</p>
            <p>統一編號：60455134</p>
            <p>
              信箱：
              <a href="mailto:joyseed.island@gmail.com" className="hover:underline">
                {" "}
                joyseed.island@gmail.com
              </a>
            </p>
            <p>地址：臺北市中山區松江路293之511號五樓</p>
          </>
        ),
      },
      {
        id: "guide",
        title: "小島指南",
        desktopClassName: "min-w-0",
        body: (
          <>
            <p>
              <AboutFooterLink href={aboutPageUrl}>關於童趣島</AboutFooterLink>
            </p>
            <p>
              <Link href="/faq" target="_blank" rel="noopener noreferrer" className="hover:underline">
                常見問題(QA)
              </Link>
            </p>
            <p>
              <Link href="/agreement/supplier-cancel-change" className="hover:underline">
                更改、取消與退款
              </Link>
            </p>
          </>
        ),
      },
      {
        id: "partners",
        title: "合作夥伴",
        desktopClassName: "min-w-0",
        body: (
          <>
            <p>
              <Link href="/agreement/member-other-info" className="hover:underline">
                加入我們
              </Link>
            </p>
            <p>
              <Link href="/vendor/register" prefetch={true} className="hover:underline">
                供應商註冊申請
              </Link>
            </p>
            <p>
              <Link href="/vendor/login" className="hover:underline">
                供應商登入
              </Link>
            </p>
            <p>
              <Link href="/agreement/supplier-platform-terms" className="hover:underline">
                供應商規範
              </Link>
            </p>
          </>
        ),
      },
      {
        id: "legal",
        title: "條款與政策",
        desktopClassName: "min-w-0",
        body: (
          <>
            <p>
              <Link href="/agreement/member-terms-of-use" className="hover:underline">
                使用者服務條款
              </Link>
            </p>
            <p>
              <Link href="/agreement/member-privacy" className="hover:underline">
                隱私權政策
              </Link>
            </p>
            <p>
              <Link href="/agreement/member-peace-addon" className="hover:underline">
                童趣島安心包服務條款
              </Link>
            </p>
            <p>
              <Link href="/agreement/supplier-child-safety" className="hover:underline">
                兒童安全與互動行為準則
              </Link>
            </p>
          </>
        ),
      },
    ];
  }, [aboutPageUrl]);

  const hasFooterBg = !!(footerBackgroundUrl?.trim() || footerBackgroundMobileUrl?.trim());

  return (
    <footer
      className={`site-home-footer relative z-0 mt-auto shrink-0 overflow-x-hidden pb-[env(safe-area-inset-bottom)] ${
        hasFooterBg
          ? "border-t-0 bg-transparent min-h-[300px] md:min-h-[360px]"
          : "border-t border-gray-100 bg-white"
      }`}
      style={footerSurfaceStyle}
    >
      {(footerBackgroundUrl || footerBackgroundMobileUrl) &&
        (footerBackgroundMobileUrl && footerBackgroundUrl ? (
          <>
            {/*
              手機勿用 bg-cover：高度隨收合區變動時 cover 會重算縮放，波浪／圖看起來在飄。
              改為寬度 100%、高度 auto、靠上對齊，頂部圖樣固定；下方不足處由 footer 底色補滿。
            */}
            <div
              className="pointer-events-none absolute inset-0 z-0 bg-top bg-no-repeat bg-[length:100%_auto] md:hidden"
              style={{
                backgroundImage: `url(${footerBackgroundMobileUrl})`,
                ...(footerSurfaceStyle.backgroundColor != null && footerSurfaceStyle.backgroundColor !== ""
                  ? { backgroundColor: footerSurfaceStyle.backgroundColor }
                  : {}),
              }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 z-0 hidden bg-cover bg-center md:block"
              style={{ backgroundImage: `url(${footerBackgroundUrl})` }}
              aria-hidden
            />
          </>
        ) : (
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-top bg-no-repeat bg-[length:100%_auto] md:bg-cover md:bg-center"
            style={{
              backgroundImage: `url(${footerBackgroundUrl || footerBackgroundMobileUrl || ""})`,
              ...(footerSurfaceStyle.backgroundColor != null && footerSurfaceStyle.backgroundColor !== ""
                ? { backgroundColor: footerSurfaceStyle.backgroundColor }
                : {}),
            }}
            aria-hidden
          />
        ))}
      {/*
        有自訂頁尾背景圖時勿畫此層：填色為 --color-background（多為白），會卡在「上方區塊底」與「頁尾背景圖」之間形成白縫。
        無背景圖時保留，銜接頁面底色。
      */}
      {!hasFooterBg ? (
        <div
          className="relative z-10 md:hidden pointer-events-none -mt-px h-6 w-full overflow-hidden leading-[0] text-[var(--color-background)]"
          aria-hidden
        >
          <svg className="block h-full w-full" viewBox="0 0 1200 24" preserveAspectRatio="none" fill="currentColor">
            <path d="M0,12 Q300,0 600,12 T1200,12 L1200,24 L0,24 Z" />
          </svg>
        </div>
      ) : null}

      <div className="relative z-10 mx-auto max-w-7xl px-3 pt-14 pb-10 sm:px-4 md:pt-20 md:pb-16">
        {/* 手機：收合區塊 */}
        <div className="flex flex-col text-left text-[#1f2937] md:hidden">
          {footerColumns.map((col) => (
            <details
              key={col.id}
              open={footerOpenSectionId === col.id}
              onToggle={(e) => {
                const el = e.currentTarget;
                if (el.open) {
                  setFooterOpenSectionId(col.id);
                } else {
                  setFooterOpenSectionId((prev) => (prev === col.id ? null : prev));
                }
              }}
              className="group border-b border-[#1f2937]/15 last:border-b-0"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 pr-0.5 text-[18px] font-extrabold leading-tight marker:content-none [&::-webkit-details-marker]:hidden">
                <span>{col.title}</span>
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-[#1f2937] transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div
                className={`space-y-2 pb-4 text-base font-semibold leading-8 ${col.mobileBodyClassName ?? ""}`}
              >
                {col.body}
                {col.id === "contact" ? (
                  <FooterCopyrightUnderContact hasFooterBg={hasFooterBg} />
                ) : null}
              </div>
            </details>
          ))}
        </div>

        {/* 平板／桌面：四欄（版權在「聯絡童趣島」地址下方、獨立區塊） */}
        <div className="hidden text-left text-[#1f2937] md:grid md:grid-cols-2 md:gap-7 md:gap-y-8 lg:mx-auto lg:max-w-[1200px] lg:grid-cols-[minmax(200px,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-6 lg:gap-y-6">
          {footerColumns.map((col) => (
            <div key={col.id} className={`space-y-2 text-base font-semibold leading-8 ${col.desktopClassName}`}>
              <h3 className="text-[24px] font-extrabold leading-tight md:text-[18px]">{col.title}</h3>
              {col.body}
              {col.id === "contact" ? (
                <FooterCopyrightUnderContact hasFooterBg={hasFooterBg} />
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {showBackTop && (
        <button
          type="button"
          onClick={scrollTop}
          className="md:hidden fixed bottom-5 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg hover:bg-brand-hover transition-colors"
          aria-label="回到頁面頂端"
        >
          <ChevronUp className="h-6 w-6" strokeWidth={2.5} />
        </button>
      )}
      {floatingIcons && floatingIcons.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-[30] flex justify-center" aria-hidden>
          <div className="relative h-full w-full max-w-7xl px-3 sm:px-4">
            <HeroFloatingIconsLayer icons={floatingIcons} />
          </div>
        </div>
      ) : null}
    </footer>
  );
}
