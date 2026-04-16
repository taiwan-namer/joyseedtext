/**
 * 課程金額抽成（安心包不計入）。rate 為 0–100。
 */
export function commissionFromCourseAmount(courseAmount: number, commissionRatePercent: number): number {
  const c = Number(courseAmount);
  if (!Number.isFinite(c) || c <= 0) return 0;
  const r = Number(commissionRatePercent);
  if (!Number.isFinite(r) || r <= 0) return 0;
  return Math.round((c * r) / 100);
}

export function parseCommissionRate(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, n);
}
