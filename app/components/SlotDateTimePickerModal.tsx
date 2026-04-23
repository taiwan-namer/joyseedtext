"use client";

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight as ChevronRightArrow, X } from "lucide-react";
import type { SlotRemaining } from "@/app/actions/bookingActions";

function getCalendarDays(year: number, month: number): (number | null)[] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startWeekday = first.getDay();
  const daysInMonth = last.getDate();
  const leading = Array(startWeekday).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  return [...leading, ...days];
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function isSameCalendarDay(d: { y: number; m: number; d: number }, ref: Date): boolean {
  return d.y === ref.getFullYear() && d.m === ref.getMonth() + 1 && d.d === ref.getDate();
}

function timeStrToMinutes(timeStr: string): number | null {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function isPastSlotOnToday(
  selectedDate: { y: number; m: number; d: number },
  timeStr: string,
  now: Date
): boolean {
  if (!isSameCalendarDay(selectedDate, now)) return false;
  const slotMin = timeStrToMinutes(timeStr);
  if (slotMin == null) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return slotMin < nowMin;
}

export type SlotDateTimePickerModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (date: string, time: string) => void;
  availableSlots?: { date: string; time: string }[];
  remainingCapacity?: number | null;
  slotRemainingList?: SlotRemaining[];
  capacityEnforced?: boolean;
  closeOnConfirm?: boolean;
  title?: string;
};

/**
 * 與課程頁「選擇日期與時間」相同互動；可選是否依剩餘名額鎖定確認鈕（會員改期未付款時應設為 false）。
 */
export default function SlotDateTimePickerModal({
  open,
  onClose,
  onConfirm,
  availableSlots = [],
  remainingCapacity,
  slotRemainingList = [],
  capacityEnforced = true,
  closeOnConfirm = true,
  title = "選擇日期與時間",
}: SlotDateTimePickerModalProps) {
  const today = useMemo(() => new Date(), []);
  const todayStartMs = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(),
    [today]
  );
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<{ y: number; m: number; d: number } | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [portalMounted, setPortalMounted] = useState(false);

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth() + 1);
    setSelectedDate(null);
    setSelectedTime(null);
  }, [open]);

  const calendarDays = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const datesWithSlots = useMemo(() => new Set(availableSlots.map((s) => s.date)), [availableSlots]);

  const timesForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = formatDateKey(selectedDate.y, selectedDate.m, selectedDate.d);
    const times = availableSlots.filter((s) => s.date === dateStr).map((s) => s.time);
    return Array.from(new Set(times)).sort();
  }, [selectedDate, availableSlots]);

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const isToday = (d: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1 && d === today.getDate();
  const isSelected = (d: number) =>
    selectedDate?.y === viewYear && selectedDate?.m === viewMonth && selectedDate?.d === d;

  const dateStr = selectedDate ? formatDateKey(selectedDate.y, selectedDate.m, selectedDate.d) : null;

  const hasSlotsOnDay = (d: number) => {
    const key = formatDateKey(viewYear, viewMonth, d);
    if (!datesWithSlots.has(key)) return false;
    const dateMs = new Date(viewYear, viewMonth - 1, d).getTime();
    return dateMs >= todayStartMs;
  };

  const onDayClick = (d: number) => {
    if (!hasSlotsOnDay(d)) return;
    setSelectedDate({ y: viewYear, m: viewMonth, d });
    setSelectedTime(null);
  };

  const slotRemaining =
    dateStr && selectedTime && slotRemainingList.length > 0
      ? (() => {
          const selMin = timeStrToMinutes(selectedTime);
          const hit = slotRemainingList.find((s) => {
            if (s.date !== dateStr) return false;
            if (selMin != null) {
              const sm = timeStrToMinutes(s.time);
              if (sm != null) return sm === selMin;
            }
            return s.time === selectedTime;
          });
          return hit?.remaining ?? null;
        })()
      : null;
  const displayRemaining = slotRemaining !== null ? slotRemaining : remainingCapacity ?? null;
  const canConfirm =
    !!dateStr &&
    !!selectedTime &&
    (capacityEnforced === false || displayRemaining === null || displayRemaining > 0);

  const handleConfirm = () => {
    if (dateStr && selectedTime) {
      onConfirm(dateStr, selectedTime);
      if (closeOnConfirm) onClose();
    }
  };

  if (!open) return null;
  if (!portalMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
            aria-label="關閉"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-4">
          <section>
            <h3 className="mb-2 text-sm font-medium text-gray-700">選擇日期</h3>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-medium text-gray-900">
                {viewYear}年{viewMonth}月
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                  aria-label="上一個月"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
                  aria-label="下一個月"
                >
                  <ChevronRightArrow className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1 font-medium text-gray-500">
                  {w}
                </div>
              ))}
              {calendarDays.map((d, i) =>
                d === null ? (
                  <div key={`e-${i}`} />
                ) : (() => {
                  const hasSlots = hasSlotsOnDay(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onDayClick(d)}
                      disabled={!hasSlots}
                      className={`rounded-full py-2 text-sm ${
                        !hasSlots
                          ? "cursor-not-allowed text-gray-300"
                          : isSelected(d)
                            ? "bg-brand font-bold text-white"
                            : isToday(d)
                              ? "bg-gray-100 font-bold text-gray-900 hover:bg-gray-200"
                              : "font-bold text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })()
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              請先選擇日期。點選日曆上有場次的日期後顯示可選時段。
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              {selectedDate ? "選擇時間" : "請先選擇日期"}
            </h3>
            {selectedDate ? (
              timesForSelectedDate.length > 0 ? (
                <div className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto">
                  {timesForSelectedDate.map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={!!selectedDate && isPastSlotOnToday(selectedDate, t, new Date())}
                      onClick={() => {
                        if (!selectedDate) return;
                        if (isPastSlotOnToday(selectedDate, t, new Date())) return;
                        setSelectedTime(t);
                      }}
                      className={`rounded-lg border py-2 text-center text-sm ${
                        selectedTime === t
                          ? "border-brand bg-brand/10 font-medium text-emerald-900"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-sm text-gray-500">此日無場次</p>
              )
            ) : (
              <p className="py-4 text-sm text-gray-400">點選日曆上有場次的日期後顯示可選時段</p>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t bg-gray-50 p-4">
          <span className="text-sm text-gray-600">
            {dateStr ? dateStr : "—"} {selectedTime ?? "請選擇時段"}
          </span>
          <div className="flex shrink-0 items-center gap-3">
            {dateStr && selectedTime && (
              <span className="whitespace-nowrap text-sm text-gray-600">
                {displayRemaining !== null
                  ? displayRemaining > 0
                    ? `剩餘 ${displayRemaining} 人`
                    : "已額滿"
                  : "剩餘名額：—"}
              </span>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="rounded-full bg-brand px-4 py-2 font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              確認
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
