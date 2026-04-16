/** 與 {@link CoursesListClient} 共用：課程列表 URL 查詢解析 */

export function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value == null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parseOptionalAge(value: string | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0 || n > 99) return null;
  return n;
}

export function getSearchParam(
  sp: Record<string, string | string[] | undefined>,
  key: string
): string {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return typeof v === "string" ? v : "";
}
