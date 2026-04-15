/**
 * 與 migration `list_classes_for_merchant_page` 篩選條件一致（日期、年齡），供前台改走查表時在伺服器端套用。
 */

export type ClassRowForListFilter = {
  class_date?: string | null;
  scheduled_slots?: unknown;
  sidebar_option?: string[] | null;
};

function dateBoundsForFilter(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): { vStart: string; vEnd: string } | null {
  const s = startDate?.trim() || null;
  const e = endDate?.trim() || null;
  if (!s && !e) return null;
  return {
    vStart: s ?? "0000-01-01",
    vEnd: e ?? "9999-12-31",
  };
}

/** class_date 或 scheduled_slots 內任一段日期落在區間內（與 RPC 相同） */
export function rowMatchesListPageDateFilter(
  row: ClassRowForListFilter,
  startDate: string | null | undefined,
  endDate: string | null | undefined
): boolean {
  const bounds = dateBoundsForFilter(startDate, endDate);
  if (!bounds) return true;
  const { vStart, vEnd } = bounds;

  const cd = row.class_date;
  if (cd != null && String(cd).trim() !== "") {
    const cdStr = String(cd).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(cdStr) && cdStr >= vStart && cdStr <= vEnd) {
      return true;
    }
  }

  const raw = row.scheduled_slots;
  if (!Array.isArray(raw)) return false;
  for (const slot of raw) {
    if (!slot || typeof slot !== "object") continue;
    const d = "date" in slot ? String((slot as { date?: unknown }).date ?? "").trim() : "";
    if (d.length < 10) continue;
    const slotDate = d.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(slotDate) && slotDate >= vStart && slotDate <= vEnd) {
      return true;
    }
  }
  return false;
}

/** 與 RPC 之 sidebar_option / __range 邏輯一致 */
export function rowMatchesListPageAgeFilter(
  row: ClassRowForListFilter,
  pMin: number | null,
  pMax: number | null
): boolean {
  if (pMin == null && pMax == null) return true;
  const opts = row.sidebar_option ?? [];

  const has = (x: string) => opts.includes(x);

  if (has("3")) return true;

  if (has("0") && pMin != null && pMax != null && pMin <= 3 && pMax >= 0) return true;
  if (has("1") && pMin != null && pMax != null && pMin <= 6 && pMax >= 3) return true;
  if (has("2") && pMin != null && pMax != null && pMin <= 9 && pMax >= 6) return true;

  for (const elem of opts) {
    const m = elem.match(/^__range:([0-9]+):([0-9]+)$/);
    if (!m || pMin == null || pMax == null) continue;
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (lo <= pMax && hi >= pMin) return true;
  }
  return false;
}
