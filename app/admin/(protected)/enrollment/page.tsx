"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronDown, Loader2, Users } from "lucide-react";
import {
  getRollcallDatesWithCounts,
  getRollcallSessionsByDate,
  getBookingsForSession,
  type RollcallSession,
  type BookingWithMember,
  type SessionBookingsResult,
  type RollcallDateWithCounts,
} from "@/app/actions/bookingActions";

function buildAddonOptionDisplay(
  row: BookingWithMember,
  classBasePrice: number,
  classAddonPrices: { name: string; price: number }[] | null
): string {
  const parts: string[] = [`課程 ${classBasePrice.toLocaleString()}`];
  if (classAddonPrices && Array.isArray(row.addon_indices) && row.addon_indices.length > 0) {
    for (const i of row.addon_indices) {
      const addon = classAddonPrices[i];
      if (addon) parts.push(`${addon.name} ${addon.price}`);
    }
  }
  return parts.join(" + ");
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** 日期選單預設：距離今天最近的有課日期，若無則選第一天 */
function pickDefaultDate(items: RollcallDateWithCounts[]): string | null {
  if (items.length === 0) return null;
  const today = todayStr();
  const future = items.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  if (future.length > 0) return future[0].date;
  return items[items.length - 1].date;
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
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

function statusBadgeClass(s: string): string {
  switch (s) {
    case "unpaid":
    case "upcoming":
      return "bg-amber-100 text-amber-800";
    case "paid":
      return "bg-sky-100 text-sky-800";
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "cancelled":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

/** 單一場次折疊：標題 [時間] 課程名稱，右側 已報名 X / 總名額；展開後點名簿 Table（含加購選項） */
function SessionAccordion({
  session,
}: {
  session: RollcallSession;
}) {
  const [open, setOpen] = useState(false);
  const [sessionData, setSessionData] = useState<SessionBookingsResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || sessionData !== null) return;
    setLoading(true);
    getBookingsForSession(session.classId, session.slotDate, session.time)
      .then((res) => {
        if (res.success) setSessionData(res.data);
      })
      .finally(() => setLoading(false));
  }, [open, session.classId, session.slotDate, session.time, sessionData]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left hover:bg-gray-50/80 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <ChevronDown
            className={`w-5 h-5 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
          <div className="min-w-0">
            <span className="text-sm font-medium text-gray-600 mr-2">[{session.time}]</span>
            <span className="font-semibold text-gray-900 truncate block sm:inline">
              {session.title || "未命名課程"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-sm text-gray-600">
          <span>已報名：<strong className="text-gray-900">{session.enrolledCount}</strong></span>
          <span className="text-gray-400">/</span>
          <span>總名額：<strong className="text-gray-900">{session.capacity}</strong></span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : sessionData && sessionData.bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-gray-500">
              <Users className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm font-medium">目前尚無消費者報名此課程</p>
            </div>
          ) : sessionData ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="bg-gray-100/80 border-b border-gray-200">
                    <th className="text-left py-3 px-3 sm:px-4 font-medium text-gray-700">家長姓名</th>
                    <th className="text-left py-3 px-3 sm:px-4 font-medium text-gray-700">小朋友暱稱</th>
                    <th className="text-left py-3 px-3 sm:px-4 font-medium text-gray-700">小朋友年齡</th>
                    <th className="text-left py-3 px-3 sm:px-4 font-medium text-gray-700">有無過敏或特殊疾病</th>
                    <th className="text-left py-3 px-3 sm:px-4 font-medium text-gray-700">聯絡電話</th>
                    <th className="text-left py-3 px-3 sm:px-4 font-medium text-gray-700 hidden sm:table-cell">加購選項</th>
                    <th className="text-left py-3 px-3 sm:px-4 font-medium text-gray-700">訂單狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionData.bookings.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-white/60 transition-colors"
                    >
                      <td className="py-3 px-3 sm:px-4 text-gray-900">{row.parent_name || "—"}</td>
                      <td className="py-3 px-3 sm:px-4 text-gray-700">{row.kid_name || "—"}</td>
                      <td className="py-3 px-3 sm:px-4 text-gray-700">{row.kid_age || "—"}</td>
                      <td className="py-3 px-3 sm:px-4 text-gray-700">{row.allergy_or_special_note || "—"}</td>
                      <td className="py-3 px-3 sm:px-4 text-gray-700">{row.contact_phone || "—"}</td>
                      <td className="py-3 px-3 sm:px-4 text-gray-700 hidden sm:table-cell">
                        {buildAddonOptionDisplay(row, sessionData.classBasePrice, sessionData.classAddonPrices)}
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${statusBadgeClass(
                            row.status
                          )}`}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function AdminEnrollmentPage() {
  const [dateItems, setDateItems] = useState<RollcallDateWithCounts[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<RollcallSession[]>([]);
  const [datesLoading, setDatesLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDatesLoading(true);
    setError(null);
    getRollcallDatesWithCounts()
      .then((res) => {
        if (res.success) {
          setDateItems(res.data);
          setSelectedDate((prev) => {
            if (prev && res.data.some((d) => d.date === prev)) return prev;
            return pickDefaultDate(res.data);
          });
        } else {
          setError(res.error);
        }
      })
      .finally(() => setDatesLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      setSessions([]);
      return;
    }
    setSessionsLoading(true);
    setError(null);
    getRollcallSessionsByDate(selectedDate)
      .then((res) => {
        if (res.success) setSessions(res.data);
        else setError(res.error);
      })
      .finally(() => setSessionsLoading(false));
  }, [selectedDate]);

  const dateSelectOptions = useMemo(
    () =>
      dateItems.map((d) => ({
        value: d.date,
        label: formatDateLabel(d.date),
        enrolledCount: d.enrolledCount,
        totalCapacity: d.totalCapacity,
      })),
    [dateItems]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" />
          返回後台
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900">報名進度查詢（點名簿）</h1>

      {/* 依日期查詢：動態日期選單 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-2">選擇日期（查詢當天課程與報名人數）</label>
        {datesLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
            <span className="text-sm text-gray-500">載入日期中…</span>
          </div>
        ) : dateSelectOptions.length === 0 ? (
          <p className="text-sm text-gray-500">目前沒有已排課的日期，請先至商品管理新增課程並設定場次</p>
        ) : (
          <>
            <div className="hidden sm:block">
              <select
                value={selectedDate ?? ""}
                onChange={(e) => setSelectedDate(e.target.value || null)}
                className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {dateSelectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}　已報名 {opt.enrolledCount} / 總名額 {opt.totalCapacity}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:hidden overflow-x-auto pb-1 -mx-1">
              <div className="flex gap-2 min-w-max px-1">
                {dateSelectOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedDate(opt.value)}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      selectedDate === opt.value
                        ? "border-amber-500 bg-amber-50 text-amber-800"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="ml-2 text-gray-500 font-normal">已報名 {opt.enrolledCount} / 總名額 {opt.totalCapacity}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 當日課程與報名進度 Accordion */}
      <div className="space-y-3">
        {sessionsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
          </div>
        ) : selectedDate && sessions.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-gray-500 text-sm">
            此日期尚無排課
          </div>
        ) : (
          sessions.map((session) => (
            <SessionAccordion
              key={`${session.classId}-${session.slotDate}-${session.time}`}
              session={session}
            />
          ))
        )}
      </div>
    </div>
  );
}
