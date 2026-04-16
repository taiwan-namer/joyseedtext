"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { getAboutPageData } from "@/app/actions/frontendSettingsActions";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { HeaderMember } from "@/app/components/HeaderMember";
import AboutRichTextHtml from "@/app/about/AboutRichTextHtml";

export default function PublicAboutPage() {
  const { siteName, aboutSectionBackgroundColor } = useStoreSettings();
  const [navAboutLabel, setNavAboutLabel] = useState("關於我們");
  const [aboutContent, setAboutContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAboutPageData()
      .then((d) => {
        setNavAboutLabel(d.navAboutLabel ?? "關於我們");
        setAboutContent(d.aboutContent ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <header
        className="sticky top-0 z-50 border-b border-gray-100 shadow-sm"
        style={{ backgroundColor: aboutSectionBackgroundColor }}
      >
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-2">
          <Link href="/" className="text-xl font-bold text-brand shrink-0">
            {siteName}
          </Link>
          <HeaderMember />
        </div>
      </header>
      <main
        className="flex-1 py-12 px-4 border-t border-gray-100"
        style={{ backgroundColor: aboutSectionBackgroundColor }}
      >
        <div className="mx-auto max-w-7xl">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-gray-500 py-16">
              <Loader2 className="w-6 h-6 animate-spin" />
              載入中…
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-8 text-center">{navAboutLabel}</h1>
              {aboutContent != null && aboutContent.trim() !== "" ? (
                <AboutRichTextHtml
                  html={aboutContent}
                  className="home-rich-text about-page-rich-text prose prose-gray max-w-none text-gray-700 mx-auto"
                />
              ) : (
                <p className="text-center text-gray-500 text-sm">尚無內容，請至後台「介紹項 → 關於我們」編輯。</p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
