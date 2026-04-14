/**
 * 圖片 URL 與圖庫陣列防呆（DB 可能為 NULL、空字串或非陣列）
 */

export function isValidImageUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && url.trim().length > 0;
}

/** 僅保留可當作 <img> / next/image src 的非空字串 URL */
export function normalizeGalleryUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
}

/** 正規化主圖：空白視同無圖 */
export function normalizeMainImageUrl(url: unknown): string | null {
  if (url == null) return null;
  const s = String(url).trim();
  return s.length > 0 ? s : null;
}
