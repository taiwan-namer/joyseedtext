"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronDown, Loader2, Users, ChevronRight } from "lucide-react";
import {
  getRollcallDatesWithCounts,
  getRollcallSessionsInMonth,
  getBookingsForSession,
  type RollcallSession,
  type SessionBookingsResult,
} from "@/app/actions/bookingActions";
import { updateSessionCapacity } from "@/app/actions/productActions";
import {
  buildBookingCourseAddonsOnlyDisplay,
  buildVendorEnrollmentCsv,
  hasPeaceAddonInBooking,
} from "@/lib/buildVendorEnrollmentCsv";
import { VendorAttendancePrintSheet } from "./VendorAttendancePrintSheet";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

function monthBounds(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  const startStr = `${year}-${pad2(month)}-01`;
  const endStr = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return { startStr, endStr, lastDay };
}

/** 由週日開始的月曆格（含前後空白格） */
function buildCalendarCells(year: number, month: number): ({ day: number; dateStr: string } | null)[] {
  const first = new Date(year, month - 1, 1);
  const { lastDay } = monthBounds(year, month);
  const startPad = first.getDay();
  const cells: ({ day: number; dateStr: string } | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) {
    cells.push({ day: d, dateStr: `${year}-${pad2(month)}-${pad2(d)}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
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

function downloadCsvWithBom(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 可編輯名額：失焦或 Enter 時儲存 */
function CapacityCell({
  capacity,
  isUpdating,
  onUpdate,
}: {
  capacity: number;
  isUpdating: boolean;
  onUpdate: (value: number) => Promise<void>;
}) {
  const [value, setValue] = useState<string>(String(capacity));
  useEffect(() => {
    setValue(String(capacity));
  }, [capacity]);

  const commit = () => {
    const n = parseInt(value.trim(), 10);
    if (Number.isInteger(n) && n >= 1) {
      if (n !== capacity) onUpdate(n);
    } else {
      setValue(String(capacity));
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 shrink-0" />}
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        onClick={(e) => e.stopPropagation()}
        className="w-12 py-1 px-1.5 rounded border border-gray-300 text-center text-sm text-gray-900"
      />
    </span>
  );
}

/** 單一場次折疊：標題 [時間] 課程名稱，右側 已報名 X / 總名額（可編輯）；展開後點名簿 Table（含加購選項） */
function SessionAccordion({
  session,
  onCapacityUpdated,
}: {
  session: RollcallSession;
  onCapacityUpdated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sessionData, setSessionData] = useState<SessionBookingsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [capacity, setCapacity] = useState(session.capacity);
  const [updatingCapacity, setUpdatingCapacity] = useState(false);

  useEffect(() => {
    setCapacity(session.capacity);
  }, [session.capacity]);

  useEffect(() => {
    if (!open || sessionData !== null) return;
    setLoading(true);
    getBookingsForSession(session.classId, session.slotDate, session.time)
      .then((res) => {
        if (res.success) setSessionData(res.data);
      })
      .finally(() => setLoading(false));
  }, [open, session.classId, session.slotDate, session.time, sessionData]);

  const handleCapacityUpdate = async (value: number) => {
    setUpdatingCapacity(true);
    const res = await updateSessionCapacity(session.classId, session.slotDate, session.time, value);
    setUpdatingCapacity(false);
    if (res.success) {
      setCapacity(value);
      onCapacityUpdated?.();
    } else {
      alert(res.error);
    }
  };

  const handleExportCsv = () => {
    if (!sessionData) return;
    const { filename, csv } = buildVendorEnrollmentCsv(session, sessionData);
    downloadCsvWithBom(filename, csv);
  };

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
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-sm text-gray-600" onClick={(e) => e.stopPropagation()}>
          <span>
            已報名：<strong className="text-gray-900">{session.enrolledCount}</strong>
          </span>
          <span className="text-gray-400">/</span>
          <span>總名額：</span>
          <CapacityCell capacity={capacity} isUpdating={updatingCapacity} onUpdate={handleCapacityUpdate} />
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : sessionData ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-3 sm:px-4">
                <VendorAttendancePrintSheet session={session} sessionData={sessionData} />
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
                >
                  匯出 CSV
                </button>
              </div>

              {sessionData.bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-gray-500">
                  <Users className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="text-sm font-medium">目前尚無消費者報名此課程</p>
                </div>
              ) : (
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
                        <th className="text-left py-3 px-3 sm:px-4 font-medium text-gray-700 w-[4.5rem]">安心包</th>
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
                          <td className="py-3 px-3 sm:px-4 text-gray-700 hidden sm:table-cell text-left tabular-nums">
                            {buildBookingCourseAddonsOnlyDisplay(row, sessionData.classAddonPrices)}
                          </td>
                          <td className="py-3 px-3 sm:px-4 align-middle">
                            {hasPeaceAddonInBooking(row, sessionData.classAddonPrices) ? (
                              <span
                                className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900"
                                title="已加購安心包"
                              >
                                已購
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
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
              )}

              <div className="border-t border-gray-200 bg-white px-3 py-3 sm:px-4">
                <VendorAttendancePrintSheet session={session} sessionData={sessionData} />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function AdminEnrollmentPage() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [monthData, setMonthData] = useState<Record<string, RollcallSession[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileDateMenuOpen, setMobileDateMenuOpen] = useState(false);

  const refreshMonth = useCallback(async () => {
    setCalendarLoading(true);
    setError(null);
    const res = await getRollcallSessionsInMonth(viewYear, viewMonth);
    if (res.success) {
      setMonthData(res.byDate);
      void getRollcallDatesWithCounts();
    } else {
      setError(res.error);
      setMonthData({});
    }
    setCalendarLoading(false);
  }, [viewYear, viewMonth]);

  useEffect(() => {
    void refreshMonth();
  }, [refreshMonth]);

  const { startStr, endStr } = monthBounds(viewYear, viewMonth);

  useEffect(() => {
    if (calendarLoading) return;
    const datesInMonth = Object.keys(monthData)
      .filter((d) => d >= startStr && d <= endStr)
      .sort();
    setSelectedDate((prev) => {
      if (prev && prev >= startStr && prev <= endStr) return prev;
      const t = todayStr();
      if (t >= startStr && t <= endStr && datesInMonth.includes(t)) return t;
      return datesInMonth[0] ?? null;
    });
  }, [calendarLoading, monthData, startStr, endStr]);

  const goPrevMonth = () => {
    if (viewMonth <= 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth >= 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
    setSelectedDate(todayStr());
  };

  useEffect(() => {
    setMobileDateMenuOpen(false);
  }, [viewYear, viewMonth]);

  const datesWithSessionsInMonth = useMemo(() => {
    const { startStr: s, endStr: e } = monthBounds(viewYear, viewMonth);
    return Object.keys(monthData)
      .filter((d) => d >= s && d <= e)
      .filter((d) => (monthData[d] ?? []).length > 0)
      .sort();
  }, [viewYear, viewMonth, monthData]);

  const cells = buildCalendarCells(viewYear, viewMonth);
  const sessionsForSelected = selectedDate ? monthData[selectedDate] ?? [] : [];

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

      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-5 shadow-sm space-y-4">
        <p className="text-sm text-gray-600">
          <span className="hidden md:inline">
            點擊日曆上的日期可查看該日場次與報名明細；場次來自已上架課程之開課日期。
          </span>
          <span className="md:hidden">
            展開下方選單選擇日期，可查看該日場次與報名明細；場次來自已上架課程之開課日期。
          </span>
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrevMonth}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50"
              aria-label="上個月"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNextMonth}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50"
              aria-label="下個月"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              今天
            </button>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 tabular-nums">
            {viewYear} 年 {viewMonth} 月
          </h2>
          <div className="w-[88px] sm:w-24 shrink-0" aria-hidden />
        </div>

        {calendarLoading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span>載入月曆…</span>
          </div>
        ) : (
          <>
            {/* 手機：下拉式選單選日期（桌機隱藏） */}
            <div className="relative md:hidden">
              <button
                type="button"
                onClick={() => {
                  if (datesWithSessionsInMonth.length === 0) return;
                  setMobileDateMenuOpen((o) => !o);
                }}
                aria-expanded={mobileDateMenuOpen}
                aria-haspopup="listbox"
                disabled={datesWithSessionsInMonth.length === 0}
                className="flex w-full items-start justify-between gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-gray-500">選擇日期</div>
                  {selectedDate ? (
                    <>
                      <div className="mt-0.5 font-semibold text-gray-900">{formatDateLabel(selectedDate)}</div>
                      {sessionsForSelected.length === 0 ? (
                        <p className="mt-1 text-xs text-gray-500">此日無排課</p>
                      ) : (
                        <ul className="mt-2 space-y-1 text-xs text-gray-700">
                          {sessionsForSelected.map((s) => {
                            const left = Math.max(0, s.capacity - s.enrolledCount);
                            return (
                              <li key={`${s.classId}-${s.time}`}>
                                <span className="font-mono text-amber-800">{s.time}</span>{" "}
                                <span className="font-medium text-gray-900">{s.title || "未命名課程"}</span>
                                <span className="text-gray-500">
                                  {" "}
                                  · 剩 {left} ／ 名額 {s.capacity}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">
                      {datesWithSessionsInMonth.length === 0 ? "本月尚無課程排程" : "請選擇日期"}
                    </p>
                  )}
                </div>
                <ChevronDown
                  className={`mt-1 h-5 w-5 shrink-0 text-gray-500 transition-transform ${mobileDateMenuOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>

              {mobileDateMenuOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 bg-black/35 md:hidden"
                    aria-label="關閉選單"
                    onClick={() => setMobileDateMenuOpen(false)}
                  />
                  <div
                    className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
                    role="listbox"
                  >
                    {datesWithSessionsInMonth.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-gray-500">本月尚無課程排程</p>
                    ) : (
                      datesWithSessionsInMonth.map((dateStr) => {
                        const daySessions = monthData[dateStr] ?? [];
                        const isSel = selectedDate === dateStr;
                        const isToday = dateStr === todayStr();
                        return (
                          <button
                            key={dateStr}
                            type="button"
                            role="option"
                            aria-selected={isSel}
                            onClick={() => {
                              setSelectedDate(dateStr);
                              setMobileDateMenuOpen(false);
                            }}
                            className={`w-full border-b border-gray-100 px-4 py-3 text-left last:border-b-0 ${
                              isSel ? "bg-amber-50" : "bg-white hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{formatDateLabel(dateStr)}</span>
                              {isToday ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                                  今天
                                </span>
                              ) : null}
                            </div>
                            <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
                              {daySessions.map((s) => {
                                const left = Math.max(0, s.capacity - s.enrolledCount);
                                return (
                                  <li key={`${s.classId}-${s.time}`}>
                                    <span className="font-mono text-amber-800">{s.time}</span>{" "}
                                    <span className="font-medium text-gray-900">{s.title || "未命名課程"}</span>
                                    <span className="block text-xs text-gray-500 sm:inline sm:ml-1">
                                      剩餘 {left} 人 · 名額 {s.capacity}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* 桌機：月曆（手機隱藏） */}
            <div className="hidden overflow-x-auto md:block -mx-1 px-1">
              <div className="min-w-[min(100%,720px)]">
                <div className="grid grid-cols-7 gap-px rounded-lg border border-gray-200 bg-gray-200 overflow-hidden">
                  {["週日", "週一", "週二", "週三", "週四", "週五", "週六"].map((w) => (
                    <div
                      key={w}
                      className="bg-gray-50 py-2 text-center text-xs font-medium text-gray-600"
                    >
                      {w}
                    </div>
                  ))}
                  {cells.map((cell, idx) => {
                    if (!cell) {
                      return <div key={`empty-${idx}`} className="min-h-[100px] sm:min-h-[120px] bg-white" />;
                    }
                    const { dateStr, day } = cell;
                    const daySessions = monthData[dateStr] ?? [];
                    const isToday = dateStr === todayStr();
                    const isSelected = selectedDate === dateStr;
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => setSelectedDate(dateStr)}
                        className={`min-h-[100px] sm:min-h-[120px] w-full text-left p-1.5 sm:p-2 transition-colors ${
                          isSelected ? "bg-amber-50 ring-2 ring-inset ring-amber-400" : "bg-white hover:bg-gray-50"
                        } ${isToday && !isSelected ? "bg-orange-50/60" : ""}`}
                      >
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                            isToday ? "bg-amber-600 text-white" : "text-gray-900"
                          }`}
                        >
                          {day}
                        </span>
                        <div className="mt-1 space-y-0.5 max-h-[72px] sm:max-h-[88px] overflow-y-auto text-[10px] sm:text-xs leading-snug">
                          {daySessions.map((s) => (
                            <div key={`${s.classId}-${s.time}`} className="text-gray-700 truncate" title={s.title ?? ""}>
                              <span className="inline-block w-1 h-1 rounded-full bg-emerald-500 align-middle mr-0.5" />
                              <span className="font-mono">{s.time}</span>{" "}
                              <span className="text-gray-600">
                                ({s.enrolledCount}/{s.capacity})
                              </span>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">{error}</div>
      )}

      {selectedDate && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">{formatDateLabel(selectedDate)}</h2>
          {!calendarLoading && sessionsForSelected.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white py-10 text-center text-gray-500 text-sm">
              此日無排課
            </div>
          ) : (
            sessionsForSelected.map((session) => (
              <SessionAccordion
                key={`${session.classId}-${session.slotDate}-${session.time}`}
                session={session}
                onCapacityUpdated={() => {
                  void refreshMonth();
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
