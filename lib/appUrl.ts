/**
 * 金流與回傳網址統一使用固定站點網址，不可使用 request host、Vercel preview domain、VERCEL_URL。
 * 優先 APP_URL，其次 NEXT_PUBLIC_BASE_URL。結尾不帶斜線。
 */
export function getAppUrl(): string {
  const a = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  const b = (process.env.NEXT_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return a || b || "";
}
