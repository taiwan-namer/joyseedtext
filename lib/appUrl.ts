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
 * 綠界／結帳導向用公開網址：須與「實際處理 /api/ecpay/checkout 的網域」一致。
 * - Preview：一律用目前請求網域（勿沿用正式站 APP_URL）。
 * - 正式：若 APP_URL 的 host 與目前請求不同（www／apex／別名），以請求為準，避免 ReturnURL 打到無部署的網域。
 */
export function resolvePaymentPublicBaseUrl(currentRequestBase: string): string {
  const cur = (currentRequestBase || "").trim().replace(/\/+$/, "");
  if (!cur) return getAppUrl();
  if (process.env.VERCEL_ENV === "preview") {
    if (/^https?:\/\//i.test(cur)) return cur;
    return `https://${cur}`;
  }
  const fromEnv = getAppUrl();
  if (!fromEnv) return resolvePublicBaseUrl(cur);
  try {
    const curHost = new URL(cur.startsWith("http") ? cur : `https://${cur}`).host.toLowerCase();
    const envHost = new URL(fromEnv).host.toLowerCase();
    if (curHost !== envHost) return cur.startsWith("http") ? cur : `https://${cur}`;
  } catch {
    return fromEnv;
  }
  return fromEnv;
}
