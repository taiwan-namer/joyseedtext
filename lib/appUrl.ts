/** 結尾不帶斜線；若僅填主機名（無 http(s)://）則補上 https://，供 NextResponse.redirect 等需絕對網址之用 */
function normalizeAbsoluteBaseUrl(raw: string): string {
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/**
 * 金流與回傳網址統一使用固定站點網址，不可使用 request host、Vercel preview domain、VERCEL_URL。
 * 優先 APP_URL，其次 NEXT_PUBLIC_BASE_URL。結尾不帶斜線；無 scheme 時視為 https 主機名。
 */
export function getAppUrl(): string {
  const a = normalizeAbsoluteBaseUrl(process.env.APP_URL ?? "");
  const b = normalizeAbsoluteBaseUrl(process.env.NEXT_PUBLIC_BASE_URL ?? "");
  return a || b || "";
}
