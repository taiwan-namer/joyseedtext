/**
 * 場次時間統一成 HH:mm，與下單 RPC、bookings.slot_time 對齊。
 * 避免 "09:00:00"、ISO 字串與 "09:00" 混用導致前台對不到場次而誤用 course.capacity 當「剩餘」。
 */
export function normalizeSlotTime(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return s.slice(0, 5);
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
