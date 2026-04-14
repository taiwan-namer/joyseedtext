/** 課程網址 slug：小寫英數與連字號，供 /course/[slug] 使用 */

/** 寬鬆比對 8-4-4-4-12 hex（含 UUID v4） */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 與 app/course 下靜態路由衝突者不可作為 slug */
export const RESERVED_COURSE_SLUGS = new Set(["booking", "page"]);

export function isUuidString(s: string): boolean {
  return UUID_RE.test(String(s ?? "").trim());
}

/**
 * 由課程名稱產生建議 slug（僅英數；中文等會被去掉，需手動補或接受後綴）。
 */
export function slugifyCourseTitle(raw: string): string {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return t || "course";
}

/** 使用者輸入的 slug：正規化並檢查格式 */
export function normalizeCourseSlugInput(raw: string): string {
  return slugifyCourseTitle(raw);
}

export function isValidCourseSlugFormat(slug: string): boolean {
  const s = String(slug ?? "").trim().toLowerCase();
  if (s.length < 2 || s.length > 120) return false;
  if (RESERVED_COURSE_SLUGS.has(s)) return false;
  if (isUuidString(s)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}
