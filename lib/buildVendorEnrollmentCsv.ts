import type {
  BookingWithMember,
  RollcallSession,
  SessionBookingsResult,
} from "@/app/actions/bookingActions";
import { metadataHasPeaceForDisplay } from "@/lib/bookingAdminAmounts";

const PEACE_ADDON_NAME_RE = /安心包/;

export function formatRollcallSlotDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const w = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${dateStr} 週${w}`;
}

function statusLabel(s: string): string {
  switch (s) {
    case "unpaid":
      return "未付款";
    case "paid":
      return "已付款";
    case "completed":
      return "完成課程";
    case "cancelled":
      return "已取消";
    case "upcoming":
      return "即將上課";
    default:
      return s;
  }
}

export function hasPeaceAddonInBooking(
  row: BookingWithMember,
  classAddonPrices: { name: string; price: number }[] | null
): boolean {
  if (metadataHasPeaceForDisplay(row.metadata)) return true;
  if (!classAddonPrices || !Array.isArray(row.addon_indices)) return false;
  for (const i of row.addon_indices) {
    const addon = classAddonPrices[i];
    if (addon && PEACE_ADDON_NAME_RE.test(String(addon.name ?? ""))) return true;
  }
  return false;
}

export function buildBookingCourseAddonsOnlyDisplay(
  row: BookingWithMember,
  classAddonPrices: { name: string; price: number }[] | null
): string {
  if (!classAddonPrices || !Array.isArray(row.addon_indices) || row.addon_indices.length === 0) {
    return "無";
  }
  const parts: string[] = [];
  for (const i of row.addon_indices) {
    const addon = classAddonPrices[i];
    if (!addon) continue;
    const p = Number(addon.price);
    parts.push(`${addon.name} NT$ ${Number.isFinite(p) ? p.toLocaleString() : String(addon.price)}`);
  }
  return parts.length > 0 ? parts.join(" + ") : "無";
}

export type AttendanceSheetRow = {
  id: string;
  seq: number;
  parentName: string;
  phone: string;
  memberEmail: string;
  kidName: string;
  kidAge: string;
  allergy: string;
  addons: string;
  peace: string;
  status: string;
  createdAt: string;
};

export function buildAttendanceSheetFromSession(
  sessionData: SessionBookingsResult
): AttendanceSheetRow[] {
  return sessionData.bookings
    .filter((b) => b.status !== "cancelled")
    .map((row, index) => ({
      id: row.id,
      seq: index + 1,
      parentName: row.parent_name ?? "",
      phone: row.contact_phone ?? "",
      memberEmail: row.member_email ?? "",
      kidName: row.kid_name ?? "",
      kidAge: row.kid_age ?? "",
      allergy: row.allergy_or_special_note?.trim() ? row.allergy_or_special_note.trim() : "無",
      addons: buildBookingCourseAddonsOnlyDisplay(row, sessionData.classAddonPrices),
      peace: hasPeaceAddonInBooking(row, sessionData.classAddonPrices) ? "有" : "無",
      status: statusLabel(row.status),
      createdAt: row.created_at ?? "",
    }));
}

function escapeCsv(value: string): string {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, "\"\"")}"`;
  return s;
}

function nowDateStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function buildVendorEnrollmentCsv(
  session: RollcallSession,
  sessionData: SessionBookingsResult
): { filename: string; csv: string } {
  const rows = buildAttendanceSheetFromSession(sessionData);
  const dateLabel = formatRollcallSlotDateLabel(session.slotDate);
  const headers = [
    "匯出日期",
    "上課日期",
    "上課時段",
    "課程名稱",
    "場次名額",
    "已報名人數",
    "訂單編號",
    "家長姓名",
    "聯絡電話",
    "會員Email",
    "小朋友暱稱",
    "小朋友年齡",
    "過敏或特殊疾病",
    "加購選項",
    "安心包",
    "訂單狀態",
    "建立時間",
    "簽到",
  ];

  const lines: string[] = [headers.map(escapeCsv).join(",")];
  for (const row of rows) {
    lines.push(
      [
        nowDateStr(),
        dateLabel,
        session.time,
        session.title ?? "",
        String(session.capacity),
        String(session.enrolledCount),
        row.id,
        row.parentName,
        row.phone,
        row.memberEmail,
        row.kidName,
        row.kidAge,
        row.allergy,
        row.addons,
        row.peace,
        row.status,
        row.createdAt,
        "",
      ]
        .map(escapeCsv)
        .join(",")
    );
  }

  const safeTitle = String(session.title ?? "未命名課程").replace(/[\\/:*?"<>|]/g, "_");
  const filename = `${session.slotDate}_${session.time.replace(":", "")}_${safeTitle}.csv`;
  return { filename, csv: lines.join("\r\n") };
}
