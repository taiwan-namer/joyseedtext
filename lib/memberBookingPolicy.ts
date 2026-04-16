/**
 * 會員中心：退款／改期與「活動日」之曆日距離（以 Asia/Taipei 今日與 bookings.slot_date 比對）。
 * slot_time 不參與「天數」計算，與常見退費條款以「日」為單位一致。
 *
 * 已付款退款（diff＝活動日與今日之曆日差，活動當日為 0）：
 * - diff >= 7：線上全額退刷
 * - 3 <= diff <= 6：僅人工退 50%（不線上全額退刷）
 * - diff <= 2：不予線上退款（活動當日、前 1～2 日）
 */

export const COPY_REFUND_CONFIRM_FULL = "將全額退還 100% 款項，確定退款？";
export const COPY_REFUND_CONFIRM_PARTIAL =
  "目前為活動前 3～6 日，將扣除 50% 訂金，僅退還 50% 款項，確定退款？";
export const COPY_REFUND_MANUAL_FOLLOWUP = "我們會採取人工退款，麻煩您聯繫客服。";
export const COPY_REFUND_BLOCKED = "活動當日及活動前 1～2 日不予退費，無法執行線上退款。";
export const COPY_REFUND_NO_SLOT = "此訂單未設定上課日期，無法執行線上退款，請聯絡客服。";
export const COPY_REFUND_PARTIAL_SERVER =
  "活動前 3～6 日之退費須由人工處理，無法線上自動全額退刷，請聯絡客服。";

export const COPY_RESCHEDULE_INTRO = "活動開始至少 4 天前可改期。";
export const COPY_RESCHEDULE_BLOCKED = "目前已進入無法改期區間，無法執行線上改期。";
export const COPY_RESCHEDULE_NO_SLOT =
  "此訂單未設定上課日期，無法執行線上改期，請聯絡客服。";

function parseYmdToUtcDayNumber(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim().slice(0, 10));
  if (!m) return NaN;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return Math.floor(Date.UTC(y, mo - 1, d) / 86400000);
}

/** 活動日（slot_date）距離「台北今日」之曆日數：活動當天為 0、明天為 1。無效／缺漏為 `null`。 */
export function calendarDaysFromTodayTaipeiToSlotDate(
  slotDateYmd: string | null | undefined
): number | null {
  if (slotDateYmd == null || String(slotDateYmd).trim() === "") return null;
  const slot = String(slotDateYmd).replace(/T.*$/, "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slot)) return null;
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const a = parseYmdToUtcDayNumber(todayStr);
  const b = parseYmdToUtcDayNumber(slot);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return b - a;
}

export type PaidRefundWindow = "full_online" | "partial_manual" | "blocked" | "no_slot_date";

export function paidRefundWindowFromDiff(diff: number | null): PaidRefundWindow {
  if (diff === null) return "no_slot_date";
  if (diff <= 2) return "blocked";
  if (diff <= 6) return "partial_manual";
  return "full_online";
}

export type RescheduleWindow = "allow" | "blocked" | "no_slot_date";

export function rescheduleWindowFromDiff(diff: number | null): RescheduleWindow {
  if (diff === null) return "no_slot_date";
  if (diff < 4) return "blocked";
  return "allow";
}
