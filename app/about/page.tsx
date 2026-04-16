import Link from "next/link";
import { getAboutPageData } from "@/app/actions/frontendSettingsActions";
import { getStoreSettings } from "@/app/actions/storeSettingsActions";
import { HeaderMember } from "@/app/components/HeaderMember";
import AboutRichTextHtml from "@/app/about/AboutRichTextHtml";

/** 與首頁共用快取策略；後台更新關於我們後會 revalidate */
export const revalidate = 60;

/**
 * 關於我們：伺服端並行載入內容與店家設定，首屏即含內容（避免 client 進頁再 fetch 的瀑布延遲）。
 */
export default async function PublicAboutPage() {
  const [{ navAboutLabel, aboutContent }, store] = await Promise.all([
    getAboutPageData(),
    getStoreSettings(),
  ]);

  const title = navAboutLabel ?? "關於我們";
  const hasContent = aboutContent != null && aboutContent.trim() !== "";

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <header
        className="sticky top-0 z-50 border-b border-gray-100 shadow-sm"
        style={{ backgroundColor: store.aboutSectionBackgroundColor }}
      >
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-2">
          <Link href="/" className="text-xl font-bold text-brand shrink-0" prefetch>
            {store.siteName}
          </Link>
          <HeaderMember />
        </div>
      </header>
      <main
        className="flex-1 py-12 px-4 border-t border-gray-100"
        style={{ backgroundColor: store.aboutSectionBackgroundColor }}
      >
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-8 text-center">{title}</h1>
          {hasContent ? (
            <AboutRichTextHtml
              html={aboutContent!}
              className="home-rich-text about-page-rich-text prose prose-gray max-w-none text-gray-700 mx-auto"
            />
          ) : (
            <p className="text-center text-gray-500 text-sm">尚無內容，請至後台「介紹項 → 關於我們」編輯。</p>
          )}
        </div>
      </main>
    </div>
  );
}
