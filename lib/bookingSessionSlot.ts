/**
 * 與 Supabase RPC（create_booking_and_decrement_capacity、confirm_booking_paid）一致：
 * 僅當「日期 + 時間」皆有效時視為有場次名額；否則為無場次，名額計在 classes.capacity。
 */
export function bookingHasExplicitSessionSlot(
  slotDate: string | null | undefined,
  slotTime: string | null | undefined
): boolean {
  if (slotDate == null || slotTime == null) return false;
  const d = String(slotDate).trim();
  const t = String(slotTime).trim();
  if (!d || !t) return false;
  const datePart = d.replace(/T.*$/, "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return false;
  const timePart = t.replace(/.*(\d{2}:\d{2}).*/, "$1").slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(timePart)) return false;
  return true;
}
