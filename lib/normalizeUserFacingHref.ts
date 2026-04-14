/**
 * 後台／使用者輸入的連結：接受站內路徑、補常見漏打的 https://。
 * 供首頁輪播、橫幅等使用。
 */
export function normalizeUserFacingHref(raw: string | null | undefined): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) return null;
  if (t.startsWith("/") || t.startsWith("#")) return t;
  if (t.startsWith("mailto:") || t.startsWith("tel:")) return t;
  if (/^https?:\/\//i.test(t)) return t;
  // 外部網址常漏協定：www.… 或 domain.tld/…
  if (/^(?:www\.|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)[a-z]{2,}/i.test(t)) {
    return `https://${t}`;
  }
  // 站內路徑但未加前導斜線：course/xxx
  if (!/\s/.test(t)) {
    return t.startsWith("/") ? t : `/${t}`;
  }
  return t;
}

/** 是否以 http(s) 開啟（用於決定是否 target=_blank） */
export function isAbsoluteHttpUrl(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}
