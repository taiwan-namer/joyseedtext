import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import "./globals.css";
import { getStoreSettings } from "./actions/storeSettingsActions";
import { getSeoSettings } from "./actions/frontendSettingsActions";
import { StoreSettingsProvider } from "./providers/StoreSettingsProvider";
import ChatWidget from "./components/chat/ChatWidget";
import { getMainSiteCanonicalOrigin } from "@/lib/mainSiteCanonical";
import { isIndexingAllowed } from "@/lib/siteIndexing";

const DEFAULT_TITLE = "童趣島 WonderVoyage | 兒童才藝活動報名";
const DEFAULT_DESCRIPTION = "探索孩子的無限潛能";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  const title = (seo.seoTitle && seo.seoTitle.trim()) || DEFAULT_TITLE;
  const description = (seo.seoDescription && seo.seoDescription.trim()) || DEFAULT_DESCRIPTION;
  const keywords = seo.seoKeywords && seo.seoKeywords.trim() ? seo.seoKeywords.trim() : undefined;
  const faviconUrl = seo.seoFaviconUrl && seo.seoFaviconUrl.trim() ? seo.seoFaviconUrl.trim() : undefined;
  const indexing = isIndexingAllowed();
  const headerList = headers();
  const pathname = headerList.get("x-pathname")?.trim() || "/";
  const canonicalPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  return {
    metadataBase: getMainSiteCanonicalOrigin(),
    alternates: {
      canonical: canonicalPath,
    },
    title,
    description,
    keywords: keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
    ...(faviconUrl && { icons: { icon: faviconUrl } }),
    ...(!indexing && {
      robots: {
        index: false,
        follow: false,
        googleBot: { index: false, follow: false },
      },
    }),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getStoreSettings();
  return (
    <html lang="zh-TW">
      <body className="antialiased">
        <StoreSettingsProvider initial={settings}>
          <Suspense fallback={null}>{children}</Suspense>
          <ChatWidget />
        </StoreSettingsProvider>
      </body>
    </html>
  );
}
