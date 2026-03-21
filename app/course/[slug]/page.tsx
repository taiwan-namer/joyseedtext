"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter, notFound } from "next/navigation";
import { ChevronRight, ChevronDown, ChevronUp, ChevronLeft, ChevronRight as ChevronRightArrow, X } from "lucide-react";
import { getCourseBySlug } from "../course-data";
import { getCourseById } from "@/app/actions/productActions";
import { getSlotRemainingCounts, type SlotRemaining } from "@/app/actions/bookingActions";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { HeaderMember } from "@/app/components/HeaderMember";
import type { CustomerNotice } from "../course-data";
import type { CourseForPublic } from "@/app/actions/productActions";
import type { CourseDetail } from "../course-data";

// 取得某年某月日曆格（含前面空白格），週以日為首
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

/** 與後台一致：9:00～21:00，每 10 分鐘一檔 */
const TIME_SLOTS_10MIN = (() => {
  const out: string[] = [];
  for (let h = 9; h <= 21; h++) {
    for (let m = 0; m < 60; m += 10) {
      if (h === 21 && m > 0) break;
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

// 選擇日期與時間模態：有場次的日期粗體黑字，無場次反灰；點選日期後才顯示該日時段；剩餘人數依所選場次連動訂單庫存
function DateTimeModal({
  open,
  onClose,
  onConfirm,
  availableSlots = [],
  remainingCapacity,
  slotRemainingList = [],
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (date: string, time: string) => void;
  availableSlots?: { date: string; time: string }[];
  /** 無 slotRemainingList 時的 fallback 剩餘名額 */
  remainingCapacity?: number | null;
  /** 各場次剩餘名額（與訂單庫存連動），有則優先顯示所選場次的 remaining */
  slotRemainingList?: SlotRemaining[];
}) {
  const today = useMemo(() => new Date(), []);
  const todayAtMidnight = useMemo(() => {
    const t = new Date(today);
    t.setHours(0, 0, 0, 0);
    return t;
  }, [today]);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<{ y: number; m: number; d: number } | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const calendarDays = useMemo(
    () => getCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  // 有開課的日期集合（YYYY-MM-DD）
  const datesWithSlots = useMemo(
    () => new Set(availableSlots.map((s) => s.date)),
    [availableSlots]
  );

  // 選中日期當天的可選時段（唯一、排序）
  const timesForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = formatDateKey(selectedDate.y, selectedDate.m, selectedDate.d);
    const times = availableSlots
      .filter((s) => s.date === dateStr)
      .map((s) => s.time);
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

  // 過去日期禁止選擇（即使該天有場次）
  const isPastDay = (d: number) => {
    const candidate = new Date(viewYear, viewMonth - 1, d);
    candidate.setHours(0, 0, 0, 0);
    return candidate.getTime() < todayAtMidnight.getTime();
  };

  const dateStr = selectedDate
    ? formatDateKey(selectedDate.y, selectedDate.m, selectedDate.d)
    : null;

  const hasSlotsOnDay = (d: number) => {
    const key = formatDateKey(viewYear, viewMonth, d);
    return datesWithSlots.has(key);
  };

  const onDayClick = (d: number) => {
    if (!hasSlotsOnDay(d)) return;
    if (isPastDay(d)) return;
    setSelectedDate({ y: viewYear, m: viewMonth, d });
    setSelectedTime(null);
  };

  const slotRemaining =
    dateStr && selectedTime && slotRemainingList.length > 0
      ? slotRemainingList.find((s) => s.date === dateStr && s.time === selectedTime)?.remaining ?? null
      : null;
  const displayRemaining = slotRemaining !== null ? slotRemaining : remainingCapacity ?? null;
  const canConfirm = !!dateStr && !!selectedTime && (displayRemaining === null || displayRemaining > 0);

  const handleConfirm = () => {
    if (dateStr && selectedTime) {
      onConfirm(dateStr, selectedTime);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">選擇日期與時間</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="關閉"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-2">選擇日期</h3>
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-900 font-medium">
                {viewYear}年{viewMonth}月
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                  aria-label="上一個月"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                  aria-label="下一個月"
                >
                  <ChevronRightArrow className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1 text-gray-500 font-medium">
                  {w}
                </div>
              ))}
              {calendarDays.map((d, i) =>
                d === null ? (
                  <div key={`e-${i}`} />
                ) : (() => {
                  const hasSlots = hasSlotsOnDay(d);
                  const past = isPastDay(d);
                  const disabled = !hasSlots || past;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onDayClick(d)}
                      disabled={disabled}
                      className={`py-2 rounded-full text-sm ${
                        disabled
                          ? "text-gray-300 cursor-not-allowed"
                          : isSelected(d)
                            ? "bg-amber-500 text-white font-bold"
                            : isToday(d)
                              ? "text-gray-900 font-bold bg-gray-100 hover:bg-gray-200"
                              : "text-gray-900 font-bold hover:bg-gray-100"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })()
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              {selectedDate ? "選擇時間" : "請先選擇日期"}
            </h3>
            {selectedDate ? (
              timesForSelectedDate.length > 0 ? (
                <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
                  {timesForSelectedDate.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTime(t)}
                      className={`py-2 rounded-lg border text-center text-sm ${
                        selectedTime === t
                          ? "border-amber-500 bg-amber-50 font-medium text-amber-800"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm py-4">此日無場次</p>
              )
            ) : (
              <p className="text-gray-400 text-sm py-4">點選日曆上有場次的日期後顯示可選時段</p>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t bg-gray-50 rounded-b-2xl">
          <span className="text-sm text-gray-600">
            {dateStr ? dateStr : "—"} {selectedTime ?? "請選擇時段"}
          </span>
          <div className="flex items-center gap-3 shrink-0">
            {dateStr && selectedTime && (
              <span className="text-sm text-gray-600 whitespace-nowrap">
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
              className="px-4 py-2 rounded-full font-medium bg-amber-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-600 transition-colors"
            >
              確認
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 客戶須知區塊：注意事項支援顯示全部/收合
function CustomerNoticeSection({ notice }: { notice: CustomerNotice }) {
  const [notesExpanded, setNotesExpanded] = useState(false);
  const notesLines = notice.注意事項.split("\n");
  const hasLongNotes = notesLines.length > 2 || notice.注意事項.length > 120;
  const notesPreview = hasLongNotes
    ? notesLines.slice(0, 2).join("\n") + (notesLines.length > 2 ? "…" : "")
    : notice.注意事項;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-6 mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">客戶須知</h2>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-gray-500 float-left w-28 shrink-0">活動場域類型</dt>
          <dd className="text-gray-800 ml-28">{notice.活動場域類型}</dd>
        </div>
        <div>
          <dt className="text-gray-500 float-left w-28 shrink-0">課程時段/長度</dt>
          <dd className="text-gray-800 ml-28">{notice.課程時段長度}</dd>
        </div>
        <div>
          <dt className="text-gray-500 float-left w-28 shrink-0">教學語言</dt>
          <dd className="text-gray-800 ml-28">{notice.教學語言}</dd>
        </div>
        <div>
          <dt className="text-gray-500 float-left w-28 shrink-0">家長陪同規則</dt>
          <dd className="text-gray-800 ml-28">{notice.家長陪同規則}</dd>
        </div>
        <div>
          <dt className="text-gray-500 float-left w-28 shrink-0">體驗成果</dt>
          <dd className="text-gray-800 ml-28">{notice.體驗成果}</dd>
        </div>
        <div>
          <dt className="text-gray-500 float-left w-28 shrink-0">費用包含項目</dt>
          <dd className="text-gray-800 ml-28">{notice.費用包含項目}</dd>
        </div>
        <div>
          <dt className="text-gray-500 float-left w-28 shrink-0">寵物攜帶規定</dt>
          <dd className="text-gray-800 ml-28">{notice.寵物攜帶規定}</dd>
        </div>
        <div>
          <dt className="text-gray-500 float-left w-28 shrink-0">師生比例</dt>
          <dd className="text-gray-800 ml-28">{notice.師生比例}</dd>
        </div>
        <div className="clear-left pt-2">
          <dt className="text-gray-500 mb-1">注意事項</dt>
          <dd className="text-gray-700 leading-relaxed whitespace-pre-line">
            {hasLongNotes && !notesExpanded ? notesPreview : notice.注意事項}
          </dd>
          {hasLongNotes && (
            <button
              type="button"
              onClick={() => setNotesExpanded((e) => !e)}
              className="mt-2 text-amber-600 text-sm font-medium flex items-center gap-1"
            >
              {notesExpanded ? (
                <>收合 <ChevronUp className="w-4 h-4 inline" /></>
              ) : (
                <>顯示全部 <ChevronDown className="w-4 h-4 inline" /></>
              )}
            </button>
          )}
        </div>
        <div className="clear-left pt-2 border-t border-gray-200">
          <dt className="text-gray-500 mb-1">活動成行條件</dt>
          <dd className="text-gray-800">{notice.活動成行條件}</dd>
        </div>
      </dl>
    </div>
  );
}

type CourseForDisplay = CourseForPublic | CourseDetail;

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === "string" ? params.slug : params.slug?.[0];
  const { siteName } = useStoreSettings();
  const [course, setCourse] = useState<CourseForDisplay | null>(null);
  const [dateTimeModalOpen, setDateTimeModalOpen] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState<{ date: string; time: string } | null>(null);
  const [selectedAddonIndices, setSelectedAddonIndices] = useState<number[]>([]);
  /** 彈窗內各場次剩餘名額（打開彈窗時重新取得，與訂單庫存連動） */
  const [slotRemainingList, setSlotRemainingList] = useState<SlotRemaining[]>([]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      // merchant 隔離在 Server Action 內以環境變數強制，勿在 Client 讀 NEXT_PUBLIC_* 傳入（建置／執行時易為 undefined 而誤撈全庫）
      const fromDb = await getCourseById(slug);
      if (cancelled) return;
      if (fromDb) {
        setCourse(fromDb);
        return;
      }
      const fromStatic = getCourseBySlug(slug);
      if (fromStatic) setCourse(fromStatic);
      else notFound();
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // 打開日期時間彈窗時取得各場次剩餘名額（連動訂單庫存，完成訂單後會變動）
  useEffect(() => {
    if (!dateTimeModalOpen || !course || !("id" in course)) return;
    let cancelled = false;
    getSlotRemainingCounts(course.id).then((res) => {
      if (!cancelled && res.success) setSlotRemainingList(res.slots);
      else if (!cancelled) setSlotRemainingList([]);
    });
    return () => { cancelled = true; };
  }, [dateTimeModalOpen, course]);

  if (!course) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">載入中…</p>
      </div>
    );
  }

  const thumbCount = course.thumbnailCount ?? 3;

  const basePrice = course.salePrice != null && course.price != null && course.salePrice < course.price
    ? course.salePrice
    : course.price ?? 0;
  const addonTotal = course.addonPrices
    ? selectedAddonIndices.reduce((sum, i) => sum + (course.addonPrices![i]?.price ?? 0), 0)
    : 0;
  const totalPrice = basePrice + addonTotal;

  const toggleAddon = (index: number) => {
    setSelectedAddonIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const goToCheckout = () => {
    if (selectedDateTime) {
      const q = new URLSearchParams({
        date: selectedDateTime.date,
        time: selectedDateTime.time,
        total: String(totalPrice),
      });
      if (selectedAddonIndices.length > 0) {
        q.set("addon", selectedAddonIndices.join(","));
      }
      router.push(`/course/${slug}/checkout?${q.toString()}`);
    } else {
      setDateTimeModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-brand">
            {siteName}
          </Link>
          <HeaderMember />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <nav className="mb-6 text-sm text-gray-500" aria-label="麵包屑">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/" className="hover:text-brand transition-colors">
                首頁
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 shrink-0" />
              <Link href="/course/booking" className="hover:text-brand transition-colors">
                課程預約
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 shrink-0" />
              <span className="text-gray-700">{course.title}</span>
            </li>
          </ol>
        </nav>

        <div className="md:grid md:grid-cols-12 md:gap-8 lg:gap-10">
          <article className="md:col-span-7 lg:col-span-8">
            {/* 主圖 + 右側內文照片縮圖（DB 有 image_url / gallery_urls 則顯示） */}
            <div className="flex gap-3 mb-8">
              <div className="flex-1 min-w-0 aspect-[4/3] rounded-xl bg-gray-200 overflow-hidden flex items-center justify-center">
                {"imageUrl" in course && course.imageUrl ? (
                  <img src={course.imageUrl} alt={course.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400 text-sm">課程主圖</span>
                )}
              </div>
              <div className="flex flex-col gap-2 w-20 shrink-0">
                {"galleryUrls" in course && course.galleryUrls && course.galleryUrls.length > 0
                  ? course.galleryUrls.slice(0, 4).map((url, i) => (
                      <div key={i} className="aspect-square rounded-lg bg-gray-200 overflow-hidden">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))
                  : Array.from({ length: thumbCount }).map((_, i) => (
                      <div key={i} className="aspect-square rounded-lg bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-400 text-xs">圖{i + 1}</span>
                      </div>
                    ))}
              </div>
            </div>

            {/* 課程簡介：約三行，READ MORE 上方 */}
            {course.courseIntro && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 mb-2">課程簡介</h3>
                <p className="text-gray-700 leading-relaxed line-clamp-3">
                  {course.courseIntro}
                </p>
              </div>
            )}
            <div className="mt-6">
              <Link
                href={`/course/${course.slug}/post`}
                className="block w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-center transition-colors"
              >
                READ MORE
              </Link>
            </div>

            {/* 客戶須知（含顯示全部/收合） */}
            {course.customerNotice && (
              <CustomerNoticeSection notice={course.customerNotice} />
            )}
          </article>

          <aside className="mt-8 md:mt-0 md:col-span-5 lg:col-span-4">
            <div className="md:sticky md:top-24 rounded-xl border border-gray-100 bg-gray-50/80 p-6 shadow-sm">
              {/* 選項標籤：後台右欄 0-3歲、3-6歲、可大人陪同 等 */}
              <div className="flex flex-wrap gap-2 mb-4">
                {(course.sidebarOptionLabels ?? course.ageTags).map((tag) => (
                  <span
                    key={tag}
                    className="inline-block px-3 py-1 text-sm text-gray-600 bg-gray-200 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <h1 className="text-xl font-bold text-gray-900 mb-4">
                {course.title}
                {course.ageRange ? ` | ${course.ageRange}` : ""}
              </h1>

              {/* 選擇日期與時間 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">選擇日期與時間</label>
                <button
                  type="button"
                  onClick={() => setDateTimeModalOpen(true)}
                  className="w-full py-3 px-4 rounded-xl border border-gray-200 bg-white text-left text-gray-600 hover:border-amber-400 hover:bg-amber-50/50 transition-colors flex items-center justify-between"
                >
                  {selectedDateTime ? (
                    <span className="text-gray-900 font-medium">
                      {selectedDateTime.date} {selectedDateTime.time}
                    </span>
                  ) : (
                    <span>請選擇日期與時段</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
                {course.scheduledSlots && course.scheduledSlots.length > 0 && (
                  <p className="mt-1.5 text-xs text-gray-500">可預約場次：{course.scheduledSlots.length} 個時段</p>
                )}
              </div>

              {/* 售價（左） / 特價（右） */}
              {course.price != null && (
                <div className="mb-4 flex items-center justify-between gap-4">
                  {course.salePrice != null && course.salePrice < (course.price ?? 0) ? (
                    <>
                      <p className="text-sm text-gray-500">售價 <span className="line-through">NT$ {course.price.toLocaleString()}</span></p>
                      <p className="text-lg font-bold text-amber-600">特價 NT$ {course.salePrice.toLocaleString()}</p>
                    </>
                  ) : (
                    <p className="text-lg font-bold text-gray-900">售價 NT$ {(course.price ?? 0).toLocaleString()}</p>
                  )}
                </div>
              )}

              {/* 加購價：可勾選，下方總計 */}
              {course.addonPrices && course.addonPrices.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-2">加購價</p>
                  <ul className="space-y-3">
                    {course.addonPrices.map((addon, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={selectedAddonIndices.includes(i)}
                          onClick={() => toggleAddon(i)}
                          className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center shrink-0 hover:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 transition-colors"
                        >
                          {selectedAddonIndices.includes(i) && (
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          )}
                        </button>
                        <span className="flex-1 text-gray-700">{addon.name}</span>
                        <span className="font-medium text-gray-900">+ NT$ {addon.price.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="flex justify-between items-center text-base font-bold text-gray-900">
                      <span>總計</span>
                      <span>NT$ {totalPrice.toLocaleString()}</span>
                    </p>
                    {addonTotal > 0 && course.addonPrices && (
                      <p className="mt-1 text-xs text-gray-500">
                        課程 {basePrice.toLocaleString()}
                        {selectedAddonIndices.map((i) => {
                          const addon = course.addonPrices![i];
                          return addon ? <span key={i}> + {addon.name}{addon.price}</span> : null;
                        })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={goToCheckout}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-full py-3 px-4 transition-colors"
              >
                立即預定
              </button>

              <DateTimeModal
                open={dateTimeModalOpen}
                onClose={() => setDateTimeModalOpen(false)}
                onConfirm={(date, time) => setSelectedDateTime({ date, time })}
                availableSlots={course.scheduledSlots ?? []}
                remainingCapacity={(course as CourseForPublic).capacity ?? null}
                slotRemainingList={slotRemainingList}
              />
            </div>
          </aside>
        </div>
      </div>

    </div>
  );
}
