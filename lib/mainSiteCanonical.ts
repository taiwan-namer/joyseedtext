/**
 * 分站專案：Canonical / metadataBase 使用的總站來源（權威正本網域）。
 *
 * - 優先：`NEXT_PUBLIC_CANONICAL_ORIGIN`（可含結尾 `/`，會正規化為 origin）
 * - 次之：`MAIN_SITE_CANONICAL_ORIGIN`（舊名，相容保留）
 * - 未設定或解析失敗時預設 https://www.joyseedisland.com.tw
 */
const DEFAULT_MAIN_SITE_ORIGIN = "https://www.joyseedisland.com.tw";

export function getMainSiteCanonicalOrigin(): URL {
  const raw =
    process.env.NEXT_PUBLIC_CANONICAL_ORIGIN?.trim() ||
    process.env.MAIN_SITE_CANONICAL_ORIGIN?.trim();
  if (!raw) return new URL(DEFAULT_MAIN_SITE_ORIGIN);
  try {
    const normalized = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
    const parsed = new URL(normalized);
    return new URL(parsed.origin);
  } catch {
    return new URL(DEFAULT_MAIN_SITE_ORIGIN);
  }
}
