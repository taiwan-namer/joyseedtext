import { headers } from "next/headers";

/** 結尾不帶斜線；若僅填主機名（無 http(s)://）則補上 https://，供 NextResponse.redirect 等需絕對網址之用 */
function normalizeAbsoluteBaseUrl(raw: string): string {
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

/**
 * 僅從環境變數讀取「官網／正式網域」：優先 APP_URL，其次 NEXT_PUBLIC_BASE_URL。
 * 結尾不帶斜線；無 scheme 時視為 https 主機名。需與對外註冊之金流回呼網域一致時請務必設定此二者。
 */
export function getAppUrl(): string {
  const a = normalizeAbsoluteBaseUrl(process.env.APP_URL ?? "");
  const b = normalizeAbsoluteBaseUrl(process.env.NEXT_PUBLIC_BASE_URL ?? "");
  return a || b || "";
}

/**
 * 組 redirect／金流網址用：優先 getAppUrl()，否則用 request.nextUrl.origin；
 * 再保險將「僅主機名」補成 https://，避免 NextResponse.redirect 報 malformed。
 */
export function resolvePublicBaseUrl(originFallback: string): string {
  const fromEnv = getAppUrl();
  const merged = (fromEnv || originFallback || "").trim().replace(/\/+$/, "");
  if (!merged) return "";
  if (/^https?:\/\//i.test(merged)) return merged;
  return `https://${merged}`;
}

/**
 * 從目前 HTTP 請求推斷站台 origin（Vercel／反向代理之 x-forwarded-*）。
 * 僅能在 Server（Server Action、Route Handler）呼叫。
 */
export function getIncomingRequestSiteOrigin(): string {
  try {
    const h = headers();
    const rawHost = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const host = rawHost.split(",")[0]?.trim() ?? "";
    if (!host) return "";
    const rawProto = (h.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim() ?? "https";
    const proto = rawProto === "http" || rawProto === "https" ? rawProto : "https";
    return `${proto}://${host}`.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

/**
 * 結帳回傳給前端的 paymentUrl 用：優先 APP_URL／NEXT_PUBLIC_BASE_URL，否則用請求 Host。
 * 避免未設環境變數或僅填主機名導致 href 變相對路徑 → 本站 404（例如 /course/.../joyseed.vercel.app/api/...）。
 */
export function resolvePaymentSiteBaseUrl(): string {
  return resolvePublicBaseUrl(getIncomingRequestSiteOrigin());
}
