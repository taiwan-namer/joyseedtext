import type { Metadata } from "next";
import "./globals.css";
import { getStoreSettings } from "./actions/storeSettingsActions";
import { getSeoSettings } from "./actions/frontendSettingsActions";
import { StoreSettingsProvider } from "./providers/StoreSettingsProvider";
import ChatWidget from "./components/chat/ChatWidget";

const DEFAULT_TITLE = "童趣島 WonderVoyage | 兒童才藝活動報名";
const DEFAULT_DESCRIPTION = "探索孩子的無限潛能";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  const title = (seo.seoTitle && seo.seoTitle.trim()) || DEFAULT_TITLE;
  const description = (seo.seoDescription && seo.seoDescription.trim()) || DEFAULT_DESCRIPTION;
  const keywords = seo.seoKeywords && seo.seoKeywords.trim() ? seo.seoKeywords.trim() : undefined;
  return {
    title,
    description,
    keywords: keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
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
          {children}
          <ChatWidget />
        </StoreSettingsProvider>
      </body>
    </html>
  );
}
