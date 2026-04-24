"use client";

import React, { useState, useTransition, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  createCourseFull,
  getAllMerchantsForAdmin,
  updateCourseFull,
  type CourseForEdit,
  type MerchantSummaryRow,
} from "@/app/actions/productActions";
import { suggestCourseSlugFromTitle } from "@/app/actions/courseSlugSuggest";
import { uploadCourseEditorImage } from "@/app/actions/courseEditorImageActions";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  ChevronRight as ChevronRightArrow,
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  ImagePlus,
} from "lucide-react";

/** 與 DB 總站課程 merchant_id 一致（build 時寫入）；用於總站專屬 UI（自動產碼等） */
const siteHqMerchantId = process.env.NEXT_PUBLIC_CLIENT_ID?.trim() ?? "";
/** true＝顯示總站進階欄位；未設／false＝分站精簡（本店 ID、代稱自動、隱藏代銷／列表／庫存等） */
const showHqCourseAdminUi =
  process.env.NEXT_PUBLIC_HQ_COURSE_ADMIN_UI === "true" ||
  process.env.NEXT_PUBLIC_HQ_COURSE_ADMIN_UI === "1";
import {
  活動場域類型選項,
  課程時段長度選項,
  教學語言選項,
  家長陪同規則選項,
  體驗成果選項,
  費用包含項目選項,
  寵物攜帶規定選項,
  未達人數處置選項,
} from "@/lib/courseFormOptions";
import { CITY_REGIONS, dedupeCategoryList } from "@/lib/constants";
import {
  COURSE_GALLERY_MAX,
  COURSE_IMAGE_SLOT_LABELS,
  COURSE_IMAGE_SLOT_TOTAL,
  COURSE_INLINE_EDITOR_IMG_CLASS,
  COURSE_PAGE_HERO_IMAGE_MAX_PX,
  COURSE_POST_BODY_COLUMN_MAX_W_CLASS,
  COURSE_PROSE_PORTRAIT_AWARE_IMAGE_CLASS,
  COURSE_SLOT_IMAGE_DATA_ATTR,
  COURSE_SLOT_IMAGE_DATA_ATTR_LEGACY,
  COURSE_SLOT_IMAGE_DISPLAY_CLASS,
} from "@/lib/courseImageSlots";
import {
  parseInitialAgeFromSidebar,
  buildSidebarOptionFromForm,
  sidebarOptionToDisplayLabels,
} from "@/lib/sidebarAgeOption";
import { getDistrictsForCity } from "@/lib/taiwanDistricts";
import { slugifyCourseTitle } from "@/lib/courseSlug";
import { isValidImageUrl } from "@/lib/safeMedia";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 9); // 9～21
const MINUTE_OPTIONS = ["00", "10", "20", "30", "40", "50"];
const WHEEL_ITEM_HEIGHT = 44;
const EDITOR_PORTRAIT_IMAGE_CLASS = "is-portrait-image";

function applyEditorPortraitClass(img: HTMLImageElement) {
  if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
  const isPortrait = img.naturalHeight > img.naturalWidth;
  img.classList.toggle(EDITOR_PORTRAIT_IMAGE_CLASS, isPortrait);
  img.style.aspectRatio = isPortrait ? "1 / 1" : "";
  img.style.objectFit = isPortrait ? "cover" : "";
}

/** 側欄縮圖同時可見約數（其餘捲動；不影響上傳格數上限） */
const COURSE_THUMB_GAP_PX = 8;

function revokePreviewIfBlob(preview: string) {
  if (preview.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(preview);
    } catch {
      /* ignore */
    }
  }
}

function getCalendarDays(year: number, month: number): (number | null)[] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const startWeekday = first.getDay();
  const daysInMonth = last.getDate();
  return [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
}

function formatDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 單一滾輪：可上下滑動選項，選中項置中並高亮 */
function WheelColumn({
  options,
  value,
  onChange,
  visibleCount = 3,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  visibleCount?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const index = options.indexOf(value);
  const safeIndex = index >= 0 ? index : 0;
  const itemHeight = WHEEL_ITEM_HEIGHT;
  const padding = itemHeight * Math.floor(visibleCount / 2);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targetScroll = safeIndex * itemHeight;
    if (Math.abs(el.scrollTop - targetScroll) > 1) el.scrollTop = targetScroll;
  }, [safeIndex, itemHeight]);

  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / itemHeight);
    const clamped = Math.max(0, Math.min(i, options.length - 1));
    const v = options[clamped];
    if (v !== value) onChange(v);
  };

  const totalHeight = visibleCount * itemHeight;
  return (
    <div
      className="relative flex flex-col w-[72px] shrink-0"
      style={{ height: totalHeight, minHeight: totalHeight }}
    >
      <div
        ref={ref}
        className="absolute inset-0 overflow-y-auto overscroll-none snap-y snap-mandatory pr-1 [scrollbar-gutter:stable]"
        onScroll={handleScroll}
        style={{ borderRadius: 0 }}
      >
        <div style={{ height: padding, minHeight: padding }} />
        {options.map((opt) => (
          <div
            key={opt}
            className={`snap-center flex items-center justify-center font-medium transition-colors ${opt === value ? "text-amber-600" : "text-gray-400"}`}
            style={{ height: itemHeight, minHeight: itemHeight, lineHeight: `${itemHeight}px`, fontSize: "1.125rem" }}
          >
            {opt}
          </div>
        ))}
        <div style={{ height: padding, minHeight: padding }} />
      </div>
      {/* 上下遮罩，只留中間一列清楚 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-white to-transparent" style={{ height: itemHeight }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white to-transparent" style={{ height: itemHeight }} />
      <div className="pointer-events-none absolute inset-x-0 border-y border-amber-200/80 bg-amber-50/30 rounded" style={{ top: itemHeight, height: itemHeight }} />
    </div>
  );
}

export type ScheduledSlot = { date: string; time: string; capacity: number };

type CourseFaqFormItem = { question: string; answer: string };

function DateTimeModal({
  open,
  onClose,
  onAddBatch,
  defaultCapacity = 10,
}: {
  open: boolean;
  onClose: () => void;
  /** 一次可加入多筆（同一時段多日），每筆帶此人數名額 */
  onAddBatch: (slots: ScheduledSlot[]) => void;
  defaultCapacity?: number;
}) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedHour, setSelectedHour] = useState<number>(9);
  const [selectedMinute, setSelectedMinute] = useState<string>("00");
  const [slotCapacity, setSlotCapacity] = useState<number>(defaultCapacity);
  const selectedTime = `${String(selectedHour).padStart(2, "0")}:${selectedMinute}`;
  const calendarDays = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const isToday = (d: number) => viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1 && d === today.getDate();
  const isSelected = (d: number) => selectedDates.includes(formatDateKey(viewYear, viewMonth, d));
  const canAdd = selectedDates.length > 0;

  const toggleDate = (d: number) => {
    const key = formatDateKey(viewYear, viewMonth, d);
    setSelectedDates((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].sort());
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); } else setViewMonth((m) => m + 1);
  };

  const handleAdd = () => {
    if (selectedDates.length === 0) return;
    const cap = Math.max(1, Math.floor(slotCapacity));
    const newSlots: ScheduledSlot[] = selectedDates.map((dateStr) => ({ date: dateStr, time: selectedTime, capacity: cap }));
    onAddBatch(newSlots);
    setSelectedDates([]);
    setSelectedHour(9);
    setSelectedMinute("00");
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-bold text-gray-900">上架課程：選擇日期與時間</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-gray-100" aria-label="關閉">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">選擇日期（可多選多天，一次新增）</h3>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">{viewYear}年{viewMonth}月</span>
              <div className="flex gap-1">
                <button type="button" onClick={prevMonth} className="rounded-lg p-2 hover:bg-gray-100" aria-label="上月">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={nextMonth} className="rounded-lg p-2 hover:bg-gray-100" aria-label="下月">
                  <ChevronRightArrow className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {WEEKDAYS.map((w) => <div key={w} className="py-1 text-gray-500">{w}</div>)}
              {calendarDays.map((d, i) =>
                d === null ? <div key={`e-${i}`} /> : (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDate(d)}
                    className={`rounded-full py-2 text-sm ${isSelected(d) ? "bg-amber-500 text-white" : isToday(d) ? "font-bold bg-gray-100" : "text-gray-500 hover:bg-gray-100"}`}
                  >
                    {d}
                  </button>
                )
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-gray-700 leading-relaxed">
              注意：如同一天需新增多個課程需選完時間後點選下方新增便可在同一天新增課程
            </p>
            <div
              className="flex items-stretch justify-center gap-0 rounded-xl border border-gray-200 bg-gray-50/50 p-3 overflow-visible"
              style={{ minHeight: WHEEL_ITEM_HEIGHT * 3 }}
            >
              <WheelColumn
                options={HOUR_OPTIONS.map((h) => String(h))}
                value={String(selectedHour)}
                onChange={(v) => setSelectedHour(Number(v))}
                visibleCount={3}
              />
              <div
                className="flex items-center justify-center shrink-0 text-xl font-bold text-gray-500 w-6"
                style={{ height: WHEEL_ITEM_HEIGHT * 3, lineHeight: `${WHEEL_ITEM_HEIGHT}px` }}
                aria-hidden
              >
                :
              </div>
              <WheelColumn
                options={MINUTE_OPTIONS}
                value={selectedMinute}
                onChange={setSelectedMinute}
                visibleCount={3}
              />
            </div>
            <p className="mt-1.5 text-center text-sm text-gray-500">目前：{selectedTime}</p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">人數名額（單堂）</h3>
            <input
              type="number"
              min={1}
              value={slotCapacity}
              onChange={(e) => setSlotCapacity(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              placeholder="可報名人數"
            />
            <p className="mt-1 text-xs text-gray-500">此批次新增的每個場次皆為此人數名額</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-gray-50 p-4">
          <span className="text-sm text-gray-600">
            {selectedDates.length > 0 ? `已選 ${selectedDates.length} 天` : "請選擇日期"}
            {" · "}
            {selectedTime}
            {selectedDates.length > 0 && (
              <button type="button" onClick={() => setSelectedDates([])} className="ml-2 text-amber-600 hover:underline">
                清除
              </button>
            )}
          </span>
          <button type="button" onClick={handleAdd} disabled={!canAdd} className="rounded-full bg-amber-500 px-4 py-2 font-medium text-white disabled:opacity-50 hover:bg-amber-600">
            {selectedDates.length > 1 ? `一次新增 ${selectedDates.length} 筆` : "新增"}
          </button>
        </div>
      </div>
    </div>
  );
}

const 注意事項範例 = `請詳閱本頁面所有說明及取消與更改辦法，報名者視同同意體驗商之相關規範。

1. 入館請務必穿襪子，現場提供成人襪 100 元 / 雙。
2. 家長需全程陪同，工作人員無法提供一對一照護服務。`;

type ImageSlot = { file: File | null; preview: string };

const emptySlot = (): ImageSlot => ({ file: null, preview: "" });

function initImageSlots(d?: CourseForEdit | null): ImageSlot[] {
  const slots = Array(COURSE_IMAGE_SLOT_TOTAL).fill(null).map(emptySlot);
  if (!d) return slots;
  if (d.image_url) slots[0] = { file: null, preview: d.image_url };
  const gallery = d.gallery_urls ?? [];
  for (let i = 0; i < COURSE_GALLERY_MAX && i < gallery.length; i++) {
    slots[i + 1] = { file: null, preview: gallery[i] };
  }
  return slots;
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;");
}

/** 將儲存用 `[圖片n]` 展開為編輯區預覽 `img`（僅當該槽有有效預覽網址） */
function expandCourseImagePlaceholdersInHtml(html: string, slots: ImageSlot[]): string {
  let out = html;
  for (let n = COURSE_IMAGE_SLOT_TOTAL; n >= 1; n--) {
    const placeholder = `[圖片${n}]`;
    if (!out.includes(placeholder)) continue;
    const url = slots[n - 1]?.preview ?? "";
    if (!isValidImageUrl(url)) continue;
    const safe = escapeHtmlAttr(url);
    const block = `<p class="m-0 min-h-0"><img src="${safe}" alt="" ${COURSE_SLOT_IMAGE_DATA_ATTR}="${n}" class="${COURSE_SLOT_IMAGE_DISPLAY_CLASS}" draggable="false" contenteditable="false" /></p>`;
    out = out.split(placeholder).join(block);
  }
  return out;
}

/** 編輯區 DOM → 寫入資料庫用 HTML（課程槽位圖還原為 `[圖片n]`） */
function serializePostContentFromEditor(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("img").forEach((node) => {
    const img = node as HTMLImageElement;
    const raw = img.getAttribute(COURSE_SLOT_IMAGE_DATA_ATTR) ?? img.getAttribute(COURSE_SLOT_IMAGE_DATA_ATTR_LEGACY);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isInteger(n) || n < 1 || n > COURSE_IMAGE_SLOT_TOTAL) return;
    img.replaceWith(document.createTextNode(`[圖片${n}]`));
  });
  return clone.innerHTML;
}

export default function CourseEditForm({
  courseId,
  initialData,
}: {
  courseId?: string;
  initialData?: CourseForEdit | null;
}) {
  const isEdit = !!courseId;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [imageSlots, setImageSlots] = useState<ImageSlot[]>(() => initImageSlots(initialData));
  /** 圖文編輯：插入 [圖片n] 前於下拉選擇的 n（1～COURSE_IMAGE_SLOT_TOTAL） */
  const [pendingInsertImageNum, setPendingInsertImageNum] = useState(1);
  const [dateTimeModalOpen, setDateTimeModalOpen] = useState(false);
  const [scheduledSlots, setScheduledSlots] = useState<ScheduledSlot[]>(() => {
    const raw = initialData?.scheduled_slots ?? [];
    const defaultCap = initialData?.capacity ?? 10;
    return raw.map((s) => ({
      date: typeof s.date === "string" ? s.date.slice(0, 10) : "",
      time: typeof s.time === "string" ? s.time.slice(0, 5) : "09:00",
      capacity: typeof (s as ScheduledSlot).capacity === "number" && (s as ScheduledSlot).capacity >= 1 ? (s as ScheduledSlot).capacity : defaultCap,
    })).filter((s) => s.date && s.time);
  });
  const [ageMin, setAgeMin] = useState(() => parseInitialAgeFromSidebar(initialData?.sidebar_option).min);
  const [ageMax, setAgeMax] = useState(() => parseInitialAgeFromSidebar(initialData?.sidebar_option).max);
  const [cityRegion, setCityRegion] = useState(() => initialData?.city_region ?? "");
  const [cityDistrict, setCityDistrict] = useState(() => initialData?.city_district ?? "");
  const [hasSale, setHasSale] = useState(() => !!initialData?.sale_price);
  const [addonItems, setAddonItems] = useState<{ name: string; price: string }[]>(() => (initialData?.addon_prices ?? []).map((a) => ({ name: a.name, price: String(a.price) })));
  const [courseFaqItems, setCourseFaqItems] = useState<CourseFaqFormItem[]>(() => {
    const raw = initialData?.course_faq_items;
    if (!Array.isArray(raw) || raw.length === 0) return [{ question: "", answer: "" }];
    return raw.map((x) => ({
      question: String(x?.question ?? ""),
      answer: String(x?.answer ?? ""),
    }));
  });
  const [activityAddress, setActivityAddress] = useState(() => initialData?.activity_address ?? "");
  const [nearbyTransport, setNearbyTransport] = useState(() => initialData?.nearby_transport ?? "");
  const [slugInput, setSlugInput] = useState(() => initialData?.slug ?? slugifyCourseTitle(initialData?.title ?? ""));
  const slugManuallyEditedRef = useRef(false);
  const slugSuggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [merchants, setMerchants] = useState<MerchantSummaryRow[]>([]);
  const [selectedCreateMerchantId, setSelectedCreateMerchantId] = useState(siteHqMerchantId);
  const districtOptions = useMemo(() => getDistrictsForCity(cityRegion), [cityRegion]);
  const sidebarPreviewLabels = useMemo(
    () =>
      sidebarOptionToDisplayLabels(
        buildSidebarOptionFromForm(ageMin.trim() === "" ? null : Number(ageMin), ageMax.trim() === "" ? null : Number(ageMax), false)
      ),
    [ageMin, ageMax]
  );
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const thumbScrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const postContentHiddenRef = useRef<HTMLInputElement>(null);
  const editorImageInputRef = useRef<HTMLInputElement>(null);
  const postContentInlineInputRef = useRef<HTMLInputElement>(null);
  const [editorImageUploading, setEditorImageUploading] = useState(false);
  const imageSlotsRef = useRef(imageSlots);
  imageSlotsRef.current = imageSlots;

  // 總站主題分類：僅來自 /api/global-categories（store_settings.global_categories，merchant_id=model）
  const [remoteGlobalCategories, setRemoteGlobalCategories] = useState<string[]>([]);

  const globalCategories = useMemo(() => {
    const list = dedupeCategoryList(remoteGlobalCategories);
    const cur = initialData?.marketplace_category?.trim();
    if (cur && !list.includes(cur)) return [...list, cur];
    return list;
  }, [remoteGlobalCategories, initialData?.marketplace_category]);

  /** 由主圖起連續已有預覽／網址的格數；下拉「圖片1～n」僅顯示到此（與上方上傳順序一致） */
  const courseImageInsertMax = useMemo(() => {
    let n = 0;
    for (let i = 0; i < imageSlots.length; i++) {
      if (isValidImageUrl(imageSlots[i].preview)) n += 1;
      else break;
    }
    return n;
  }, [imageSlots]);

  useEffect(() => {
    const max = courseImageInsertMax;
    if (max < 1) {
      setPendingInsertImageNum(1);
      return;
    }
    setPendingInsertImageNum((p) => Math.min(Math.max(1, p), max));
  }, [courseImageInsertMax]);

  useEffect(() => {
    const p = parseInitialAgeFromSidebar(initialData?.sidebar_option);
    setAgeMin(p.min);
    setAgeMax(p.max);
  }, [initialData?.sidebar_option]);

  useEffect(() => {
    setCityRegion(initialData?.city_region ?? "");
    setCityDistrict(initialData?.city_district ?? "");
  }, [initialData?.city_region, initialData?.city_district]);

  useEffect(() => {
    setActivityAddress(initialData?.activity_address ?? "");
    setNearbyTransport(initialData?.nearby_transport ?? "");
  }, [initialData?.activity_address, initialData?.nearby_transport]);

  useEffect(() => {
    setSlugInput(initialData?.slug ?? slugifyCourseTitle(initialData?.title ?? ""));
    slugManuallyEditedRef.current = false;
  }, [initialData?.id]);

  useEffect(() => {
    if (!showHqCourseAdminUi) {
      setMerchants(
        siteHqMerchantId
          ? [{ merchant_id: siteHqMerchantId, site_name: "本店" }]
          : [{ merchant_id: "default", site_name: "本店" }]
      );
      setSelectedCreateMerchantId(siteHqMerchantId);
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await getAllMerchantsForAdmin();
      if (cancelled) return;
      if (r.success && r.data.length > 0) {
        setMerchants(r.data);
        setSelectedCreateMerchantId((prev) => {
          if (r.data.some((m) => m.merchant_id === prev)) return prev;
          return r.data.find((m) => m.merchant_id === siteHqMerchantId)?.merchant_id ?? r.data[0].merchant_id;
        });
      } else {
        setMerchants([{ merchant_id: siteHqMerchantId || "default", site_name: "本店" }]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showHqCourseAdminUi]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/global-categories", { method: "GET" });
        if (!res.ok) throw new Error("failed to fetch global categories");
        const data = (await res.json()) as { categories?: unknown };
        const raw = data?.categories;
        if (!Array.isArray(raw)) return;
        const list = raw
          .map((v): string | null => (typeof v === "string" ? v.trim() : null))
          .filter((v): v is string => !!v);
        if (!cancelled) {
          setRemoteGlobalCategories(dedupeCategoryList(list));
        }
      } catch {
        if (!cancelled) setRemoteGlobalCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSlot = (index: number, file: File | null) => {
    setImageSlots((prev) => {
      const next = [...prev];
      revokePreviewIfBlob(next[index].preview);
      next[index] = file ? { file, preview: URL.createObjectURL(file) } : emptySlot();
      return next;
    });
  };

  const clearSlot = (index: number) => {
    setImageSlots((prev) => {
      const next = [...prev];
      revokePreviewIfBlob(next[index].preview);
      next[index] = emptySlot();
      return next;
    });
    const inp = fileInputRefs.current[index];
    if (inp) inp.value = "";
  };

  const scrollThumbStrip = (direction: -1 | 1) => {
    const el = thumbScrollRef.current;
    if (!el) return;
    const first = el.querySelector("[data-thumb-slot]") as HTMLElement | null;
    const gap = COURSE_THUMB_GAP_PX;
    const flexDir = getComputedStyle(el).flexDirection;
    const isRow = flexDir === "row" || flexDir === "row-reverse";
    const step = first ? (isRow ? first.offsetWidth + gap : first.offsetHeight + gap) : 88;
    if (isRow) {
      el.scrollBy({ left: direction * step, behavior: "smooth" });
    } else {
      el.scrollBy({ top: direction * step, behavior: "smooth" });
    }
  };

  const setMainFromThumb = (thumbIndex: number) => {
    if (thumbIndex < 1 || thumbIndex > COURSE_GALLERY_MAX) return;
    setImageSlots((prev) => {
      const next = [...prev];
      [next[0], next[thumbIndex]] = [next[thumbIndex], next[0]];
      return next;
    });
  };

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const raw = (initialData?.post_content ?? "").trim() ? String(initialData?.post_content) : "";
    if (!raw) {
      el.innerHTML = "";
      if (postContentHiddenRef.current) postContentHiddenRef.current.value = "";
      return;
    }
    const expanded = expandCourseImagePlaceholdersInHtml(raw, imageSlotsRef.current);
    el.innerHTML = expanded;
    if (postContentHiddenRef.current) postContentHiddenRef.current.value = raw;
  }, [initialData?.post_content, initialData?.id]);

  /** 更換主圖／附圖檔或網址時，同步更新編輯區內對應槽位預覽圖 */
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    root.querySelectorAll("img").forEach((node) => {
      const img = node as HTMLImageElement;
      const raw = img.getAttribute(COURSE_SLOT_IMAGE_DATA_ATTR) ?? img.getAttribute(COURSE_SLOT_IMAGE_DATA_ATTR_LEGACY);
      const n = raw ? parseInt(raw, 10) : NaN;
      if (!Number.isInteger(n) || n < 1 || n > COURSE_IMAGE_SLOT_TOTAL) return;
      const url = imageSlots[n - 1]?.preview ?? "";
      if (isValidImageUrl(url)) img.src = url;
    });
  }, [imageSlots]);

  /** 編輯區圖片依實際比例標記直圖 class，供樣式套用 1:1 cover */
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const imageCleanup = new Map<HTMLImageElement, () => void>();
    const syncEditorImages = () => {
      const images = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];
      for (const img of images) {
        applyEditorPortraitClass(img);
        if (imageCleanup.has(img)) continue;
        const onLoad = () => applyEditorPortraitClass(img);
        img.addEventListener("load", onLoad);
        imageCleanup.set(img, () => img.removeEventListener("load", onLoad));
      }
      imageCleanup.forEach((dispose, img) => {
        if (root.contains(img)) return;
        dispose();
        imageCleanup.delete(img);
      });
    };
    syncEditorImages();
    const observer = new MutationObserver(() => {
      syncEditorImages();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src"],
    });
    return () => {
      observer.disconnect();
      imageCleanup.forEach((dispose) => dispose());
      imageCleanup.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      const root = editorRef.current;
      if (root) {
        root.querySelectorAll('img[src^="blob:"]').forEach((img) => {
          try {
            URL.revokeObjectURL((img as HTMLImageElement).src);
          } catch {
            /* ignore */
          }
        });
      }
      imageSlotsRef.current.forEach((s) => {
        revokePreviewIfBlob(s.preview);
      });
    };
  }, []);

  useEffect(() => {
    return () => {
      if (slugSuggestTimerRef.current != null) {
        clearTimeout(slugSuggestTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const isEdit = !!courseId;
    const hasMin = ageMin.trim() !== "";
    const hasMax = ageMax.trim() !== "";
    if (hasMin !== hasMax) {
      setError("適齡請同時填寫「最小」與「最大」歲數，或兩者皆留空");
      return;
    }
    if (hasMin && hasMax) {
      const a = Number(ageMin);
      const b = Number(ageMax);
      if (
        Number.isNaN(a) ||
        Number.isNaN(b) ||
        !Number.isInteger(a) ||
        !Number.isInteger(b) ||
        a < 0 ||
        b < 0
      ) {
        setError("請填寫有效的適齡整數（0 以上）");
        return;
      }
    }
    if (!isEdit && !imageSlots[0].file) {
      setError("請上傳主圖");
      return;
    }
    if (imageSlots[0].file) formData.set("image_main", imageSlots[0].file as File);
    for (let i = 1; i <= COURSE_GALLERY_MAX; i++) {
      if (imageSlots[i].file) formData.set(`image_${i}`, imageSlots[i].file as File);
    }
    const postHtml = editorRef.current ? serializePostContentFromEditor(editorRef.current) : "";
    formData.set("post_content", postHtml);
    const sidebarPayload = buildSidebarOptionFromForm(hasMin ? Number(ageMin) : null, hasMax ? Number(ageMax) : null, false);
    formData.set("sidebar_option", JSON.stringify(sidebarPayload));
    formData.set("city_region", cityRegion);
    formData.set("city_district", cityDistrict);
    formData.set("scheduled_slots", JSON.stringify(scheduledSlots));
    const firstSlot = scheduledSlots[0];
    formData.set("class_date", firstSlot ? firstSlot.date : "");
    formData.set("class_time", firstSlot ? firstSlot.time.slice(0, 5) : "");
    formData.set("capacity", String(scheduledSlots.length ? Math.max(...scheduledSlots.map((s) => s.capacity), 1) : 1));
    const addonPayload = addonItems
      .filter((a) => a.name.trim() !== "" && a.price.trim() !== "")
      .map((a) => ({ name: a.name.trim(), price: Number(a.price) }))
      .filter((a) => !Number.isNaN(a.price) && a.price >= 0);
    formData.set("addon_prices", JSON.stringify(addonPayload));
    formData.set(
      "course_faq_items",
      JSON.stringify(
        courseFaqItems
          .map((x) => ({ question: x.question.trim(), answer: x.answer.trim() }))
          .filter((x) => x.question && x.answer)
      )
    );
    formData.set("activity_address", activityAddress.trim());
    formData.set("nearby_transport", nearbyTransport.trim());
    /** 空字串時 create/updateCourseFull 會依活動詳細地址自動產生 iframe（後台不再手填） */
    formData.set("map_embed_html", "");
    formData.set("course_slug", slugInput.trim());
    if (!isEdit) {
      formData.set("merchant_id", showHqCourseAdminUi ? selectedCreateMerchantId : siteHqMerchantId);
    }
    startTransition(async () => {
      const result = isEdit
        ? await updateCourseFull(courseId!, formData)
        : await createCourseFull(formData);
      if (result.success) {
        setSuccess(result.message ?? (isEdit ? "課程已更新" : "課程已新增"));
        if (!isEdit) {
          setImageSlots(Array(COURSE_IMAGE_SLOT_TOTAL).fill(null).map(emptySlot));
          setScheduledSlots([]);
          setAddonItems([]);
          setCourseFaqItems([{ question: "", answer: "" }]);
          setActivityAddress("");
          setNearbyTransport("");
          setSlugInput(slugifyCourseTitle(""));
          slugManuallyEditedRef.current = false;
          setAgeMin("");
          setAgeMax("");
          setCityRegion("");
          setCityDistrict("");
          form.reset();
          if (editorRef.current) editorRef.current.innerHTML = "";
          if (postContentHiddenRef.current) postContentHiddenRef.current.value = "";
          if ("id" in result && result.id) {
            const pathSlug = "slug" in result && result.slug ? result.slug : result.id;
            window.open(`/course/${pathSlug}`, "_blank");
          }
        }
      } else {
        setError(result.error);
      }
    });
  };

  const syncPostContentHiddenFromEditor = () => {
    const root = editorRef.current;
    if (!root || !postContentHiddenRef.current) return;
    postContentHiddenRef.current.value = serializePostContentFromEditor(root);
  };

  const insertImage = (num: number) => {
    const el = editorRef.current;
    if (!el) return;
    const slot = imageSlotsRef.current[num - 1];
    const url = slot?.preview ?? "";
    if (!isValidImageUrl(url)) return;
    const safe = escapeHtmlAttr(url);
    const html = `<p class="m-0 min-h-0"><img src="${safe}" alt="" ${COURSE_SLOT_IMAGE_DATA_ATTR}="${num}" class="${COURSE_SLOT_IMAGE_DISPLAY_CLASS}" draggable="false" contenteditable="false" /></p>`;
    document.execCommand("insertHTML", false, html);
    syncPostContentHiddenFromEditor();
    requestAnimationFrame(() => {
      const imgs = el.querySelectorAll(`img[${COURSE_SLOT_IMAGE_DATA_ATTR}="${num}"]`);
      const last = imgs[imgs.length - 1] as HTMLElement | undefined;
      last?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const commitInsertCourseImage = () => {
    if (courseImageInsertMax < 1) {
      alert("請先於上方由主圖起連續上傳課程圖片，再插入 [圖片n]。");
      return;
    }
    const num = Math.min(pendingInsertImageNum, courseImageInsertMax);
    insertImage(num);
    editorRef.current?.focus();
  };

  /** 上傳編輯區圖檔並於游標處插入（與「上傳圖片」相同 API；後台寫入 R2 後回傳網址） */
  const uploadEditorImageAndInsertAtCursor = async (file: File) => {
    const fd = new FormData();
    fd.append("editor_image", file);
    const result = await uploadCourseEditorImage(fd);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const el = editorRef.current;
    if (!el) return;
    const id = crypto.randomUUID();
    const safe = escapeHtmlAttr(result.url);
    const html = `<p class="m-0 min-h-0"><img src="${safe}" alt="" data-post-inline-id="${id}" class="${COURSE_INLINE_EDITOR_IMG_CLASS}" draggable="false" contenteditable="false" /></p>`;
    document.execCommand("insertHTML", false, html);
    syncPostContentHiddenFromEditor();
    el.focus();
    requestAnimationFrame(() => {
      const imgs = el.querySelectorAll(`img[data-post-inline-id="${id}"]`);
      const last = imgs[imgs.length - 1] as HTMLElement | undefined;
      last?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const handleEditorImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEditorImageUploading(true);
    setError(null);
    try {
      await uploadEditorImageAndInsertAtCursor(file);
    } finally {
      setEditorImageUploading(false);
    }
  };

  /** 插入非課程槽位之圖片：游標處插入（與「上傳圖片」同流程）；總站／供應商皆可用 */
  const insertPostContentInlineImage = async (file: File | null | undefined) => {
    if (!file) return;
    setEditorImageUploading(true);
    setError(null);
    try {
      await uploadEditorImageAndInsertAtCursor(file);
    } finally {
      setEditorImageUploading(false);
    }
  };

  const applyFormat = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value ?? undefined);
    editorRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <form id="course-edit-form" onSubmit={handleSubmit} className="space-y-6">
          {!showHqCourseAdminUi && courseId && initialData ? (
            <>
              <input type="hidden" name="store_category" value={initialData.store_category ?? ""} />
              <input type="hidden" name="inventory_merchant_id" value={initialData.inventory_merchant_id ?? ""} />
              <input type="hidden" name="inventory_class_id" value={initialData.inventory_class_id ?? ""} />
              <input type="hidden" name="hq_listing_merchant_id" value={initialData.hq_listing_merchant_id ?? ""} />
              <input type="hidden" name="hq_listing_class_id" value={initialData.hq_listing_class_id ?? ""} />
            </>
          ) : null}
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          {success && (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 whitespace-pre-wrap"
            >
              <p>{success}</p>
              {courseId && (
                <p className="mt-2 flex gap-4">
                  <button type="button" onClick={() => setSuccess(null)} className="text-emerald-700 underline hover:no-underline">留在編輯頁</button>
                  <Link href="/admin" className="text-emerald-700 underline hover:no-underline">返回商品管理</Link>
                </p>
              )}
            </div>
          )}

          <div className="md:grid md:grid-cols-12 md:gap-8 lg:gap-10">
            <article className="md:col-span-7 lg:col-span-8 space-y-6">
              {/* 主圖在左、縮圖在右；手機橫滑、桌機直向捲動＋按鈕；❌ 僅釋放 blob 預覽 */}
              <div className="flex flex-col gap-3 md:flex-row md:items-start">
                <div className="flex-1 min-w-0">
                  {!isEdit ? (
                    <p className="mb-1 text-xs text-gray-500">
                      課程主圖（建議尺寸 {COURSE_PAGE_HERO_IMAGE_MAX_PX} × {COURSE_PAGE_HERO_IMAGE_MAX_PX} px，1:1，與課程頁主圖顯示一致）
                    </p>
                  ) : null}
                  <div className="aspect-square rounded-xl bg-gray-200 overflow-hidden flex items-center justify-center border border-gray-300">
                    {isValidImageUrl(imageSlots[0].preview) ? (
                      <img src={imageSlots[0].preview} alt="主圖" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-400 text-sm">課程主圖</span>
                    )}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col self-start md:w-[5.25rem]">
                  <div className="mb-1 hidden shrink-0 items-center justify-center md:flex">
                    <button
                      type="button"
                      onClick={() => scrollThumbStrip(-1)}
                      disabled={isPending}
                      className="rounded-md border border-gray-300 bg-white p-1 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      aria-label="縮圖向上捲動"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                  </div>
                  <div
                    ref={thumbScrollRef}
                    className="flex max-h-[6.5rem] flex-row gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain px-0.5 pb-1 [scrollbar-gutter:stable] snap-x snap-mandatory touch-pan-x md:max-h-[min(33rem,calc(100vh-14rem))] md:flex-1 md:min-h-0 md:flex-col md:overflow-y-auto md:overflow-x-hidden md:snap-y md:snap-mandatory md:touch-pan-y md:pr-0.5"
                  >
                    {COURSE_IMAGE_SLOT_LABELS.map((label, i) => (
                      <div
                        key={i}
                        data-thumb-slot
                        className="flex w-[4.5rem] shrink-0 snap-start flex-col items-center gap-0.5 md:w-full"
                      >
                        <div className="relative aspect-square w-full shrink-0">
                          <input
                            ref={(el) => {
                              fileInputRefs.current[i] = el;
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) setSlot(i, f);
                            }}
                            disabled={isPending}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (i === 0) fileInputRefs.current[0]?.click();
                              else if (isValidImageUrl(imageSlots[i].preview)) setMainFromThumb(i);
                              else fileInputRefs.current[i]?.click();
                            }}
                            disabled={isPending}
                            className="absolute inset-0 rounded-lg border-2 border-gray-300 bg-gray-100 overflow-hidden hover:border-amber-400 focus:border-amber-500 disabled:opacity-50"
                          >
                            {isValidImageUrl(imageSlots[i].preview) ? (
                              <img src={imageSlots[i].preview} alt={label} className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center px-0.5 text-center text-gray-400 text-[10px] leading-tight">
                                {label}
                              </span>
                            )}
                          </button>
                          {isValidImageUrl(imageSlots[i].preview) ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                clearSlot(i);
                              }}
                              disabled={isPending}
                              className="absolute right-0.5 top-0.5 z-[1] flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white shadow hover:bg-black/75 disabled:opacity-50"
                              aria-label={`移除${label}`}
                              title="移除圖片"
                            >
                              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </button>
                          ) : null}
                        </div>
                        <span className="text-[10px] font-medium text-gray-600">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 hidden shrink-0 items-center justify-center md:flex">
                    <button
                      type="button"
                      onClick={() => scrollThumbStrip(1)}
                      disabled={isPending}
                      className="rounded-md border border-gray-300 bg-white p-1 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      aria-label="縮圖向下捲動"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 課程簡介 */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-500 mb-2">課程簡介</h3>
                <textarea name="course_intro" rows={4} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400" placeholder="簡短介紹課程內容、適合對象與亮點…" disabled={isPending} defaultValue={initialData?.course_intro ?? ""} />
              </div>

              {/* READ MORE */}
              <div className="flex justify-center">
                <button type="button" className="w-full max-w-xs py-3 px-4 rounded-xl bg-amber-500 text-white font-medium text-center">
                  READ MORE
                </button>
              </div>

              {/* 圖文編輯：工具列 + 編輯區；緊湊單一區塊、全寬控制項、響應式排列 */}
              <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">圖文編輯</h3>
                <div className="mb-3 space-y-2.5 rounded-lg border border-gray-100 bg-gray-50/80 p-2 sm:p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="w-full text-[11px] font-medium text-gray-500 sm:hidden">文字</span>
                    <select
                      className="h-8 min-w-0 flex-1 basis-[5.5rem] rounded-md border border-gray-300 bg-white px-2 text-sm sm:flex-none sm:basis-auto"
                      onFocus={() => editorRef.current?.focus()}
                      onChange={(e) => applyFormat("fontSize", e.target.value)}
                      disabled={isPending}
                    >
                      <option value="1">字體小</option>
                      <option value="2">字體中</option>
                      <option value="3">字體大</option>
                      <option value="4">字體特大</option>
                    </select>
                    <button
                      type="button"
                      className="h-8 rounded-md border border-gray-300 bg-white px-2.5 text-sm hover:bg-gray-100 disabled:opacity-50"
                      onClick={() => applyFormat("bold")}
                      disabled={isPending}
                    >
                      粗體
                    </button>
                    <button
                      type="button"
                      className="h-8 rounded-md border border-gray-300 bg-white px-2.5 text-sm hover:bg-gray-100 disabled:opacity-50"
                      onClick={() => applyFormat("italic")}
                      disabled={isPending}
                    >
                      斜體
                    </button>
                    <span className="hidden text-gray-200 sm:inline" aria-hidden>
                      |
                    </span>
                    <div
                      className="flex h-8 min-w-0 items-center gap-1 rounded-md border border-gray-300 bg-white px-1.5"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <span className="hidden text-xs text-gray-600 sm:inline">顏色</span>
                      <input
                        type="color"
                        className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                        defaultValue="#000000"
                        onChange={(e) => applyFormat("foreColor", e.target.value)}
                        disabled={isPending}
                        title="字體顏色"
                      />
                    </div>
                    <input
                      ref={editorImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      disabled={isPending || editorImageUploading}
                      onChange={handleEditorImageFile}
                    />
                    <button
                      type="button"
                      className="h-8 flex-1 min-w-0 rounded-md border border-amber-300 bg-amber-50 px-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 sm:flex-none"
                      onClick={() => editorImageInputRef.current?.click()}
                      disabled={isPending || editorImageUploading}
                    >
                      {editorImageUploading ? "上傳中…" : "上傳圖片"}
                    </button>
                  </div>

                  <div className="border-t border-gray-200/80 pt-2.5 sm:border-t-0 sm:pt-0">
                    <div className="flex flex-col gap-2 sm:gap-2 md:flex-row md:items-end md:gap-2">
                      <div className="min-w-0 flex-1 md:max-w-md lg:max-w-lg">
                        <label htmlFor="insert-course-image-slot" className="mb-0.5 block text-xs text-gray-600 sm:mb-0 sm:sr-only">
                          插入課程圖片
                        </label>
                        <select
                          id="insert-course-image-slot"
                          className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                          value={courseImageInsertMax >= 1 ? pendingInsertImageNum : ""}
                          onChange={(e) => setPendingInsertImageNum(Number(e.target.value))}
                          disabled={isPending || editorImageUploading || courseImageInsertMax < 1}
                        >
                          {courseImageInsertMax < 1 ? (
                            <option value="">請先上傳主圖與連續附圖</option>
                          ) : (
                            Array.from({ length: courseImageInsertMax }, (_, i) => {
                              const num = i + 1;
                                const slotLabel = COURSE_IMAGE_SLOT_LABELS[i];
                              return (
                                <option key={num} value={num}>
                                  圖片{num}（{slotLabel}）
                                </option>
                              );
                            })
                          )}
                        </select>
                      </div>
                      <input
                        ref={postContentInlineInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          void insertPostContentInlineImage(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                        disabled={isPending || editorImageUploading}
                      />
                      <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:gap-2">
                        <button
                          type="button"
                          onClick={commitInsertCourseImage}
                          disabled={isPending || editorImageUploading || courseImageInsertMax < 1}
                          className="h-9 rounded-lg bg-amber-500 px-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 sm:min-w-[5.5rem] sm:px-3"
                        >
                          確定插入
                        </button>
                        <button
                          type="button"
                          onClick={() => postContentInlineInputRef.current?.click()}
                          disabled={isPending || editorImageUploading}
                          className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60 sm:gap-1.5 sm:px-3 sm:text-sm"
                        >
                          <ImagePlus className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                          <span className="min-w-0 text-center leading-tight">插入其他圖片</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={`mx-auto ${COURSE_POST_BODY_COLUMN_MAX_W_CLASS}`}>
                  <div
                    ref={editorRef}
                    contentEditable={!isPending}
                    onInput={syncPostContentHiddenFromEditor}
                    className={`prose prose-gray min-h-[min(50vh,28rem)] w-full max-w-none rounded-lg border border-gray-300 bg-white px-3 py-3 text-base leading-relaxed text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30 sm:px-4 sm:py-4 ${COURSE_PROSE_PORTRAIT_AWARE_IMAGE_CLASS}`}
                    data-placeholder="輸入內文；「插入課程圖片／插入其他圖片」會在編輯區顯示與前台版型一致的圖；儲存後課程圖以 [圖片n] 寫入資料庫、附圖上傳至雲端。"
                  />
                </div>
                <input ref={postContentHiddenRef} type="hidden" name="post_content" />
              </div>

              {/* 購買須知／客戶需知（不變動） */}
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">購買須知／客戶需知</h2>
                <div className="space-y-5">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">活動場域類型</label>
                    <select name="customer_venue" className="w-full rounded-lg border border-gray-300 px-3 py-2" disabled={isPending} defaultValue={initialData?.customer_notice?.活動場域類型 ?? ""}>
                      {活動場域類型選項.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">課程時段／長度</label>
                    <select name="customer_duration" className="w-full rounded-lg border border-gray-300 px-3 py-2" disabled={isPending} defaultValue={initialData?.customer_notice?.課程時段長度 ?? ""}>
                      {課程時段長度選項.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">教學語言</label>
                    <div className="flex flex-wrap gap-4">
                      {教學語言選項.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2">
                          <input type="checkbox" name="customer_lang" value={opt.value} className="rounded border-gray-300" disabled={isPending} defaultChecked={initialData?.customer_notice?.教學語言?.includes(opt.value)} />
                          <span className="text-sm text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                      <input type="text" name="customer_lang_custom" placeholder="自行填寫" className="max-w-[120px] rounded border border-gray-300 px-2 py-1 text-sm" disabled={isPending} defaultValue={initialData?.customer_notice?.教學語言自行填寫 ?? ""} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">家長陪同規則</label>
                    <select name="customer_parent" className="w-full rounded-lg border border-gray-300 px-3 py-2" disabled={isPending} defaultValue={initialData?.customer_notice?.家長陪同規則 ?? ""}>
                      {家長陪同規則選項.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">體驗成果</label>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {體驗成果選項.map((opt) => (
                        <label key={opt} className="flex items-center gap-2">
                          <input type="checkbox" name="customer_outcome" value={opt} className="rounded border-gray-300" disabled={isPending} defaultChecked={initialData?.customer_notice?.體驗成果?.includes(opt)} />
                          <span className="text-sm text-gray-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">費用包含項目</label>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {費用包含項目選項.map((opt) => (
                        <label key={opt} className="flex items-center gap-2">
                          <input type="checkbox" name="customer_fee" value={opt} className="rounded border-gray-300" disabled={isPending} defaultChecked={initialData?.customer_notice?.費用包含項目?.includes(opt)} />
                          <span className="text-sm text-gray-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">寵物攜帶規定</label>
                    <select name="customer_pet" className="w-full rounded-lg border border-gray-300 px-3 py-2" disabled={isPending} defaultValue={initialData?.customer_notice?.寵物攜帶規定 ?? ""}>
                      {寵物攜帶規定選項.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">師生比例</label>
                    <div className="flex items-center gap-2">
                      <input type="number" name="customer_ratio_n" min={1} className="w-16 rounded border border-gray-300 px-2 py-1.5 text-center" disabled={isPending} defaultValue={initialData?.customer_notice?.師生比例分子 ?? 1} />
                      <span className="text-gray-500">:</span>
                      <input type="number" name="customer_ratio_d" min={1} className="w-16 rounded border border-gray-300 px-2 py-1.5 text-center" disabled={isPending} defaultValue={initialData?.customer_notice?.師生比例分母 ?? 10} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">最低成行人數</label>
                      <div className="flex items-center gap-2">
                        <input type="number" name="customer_min_people" min={1} className="w-20 rounded border border-gray-300 px-2 py-1.5" disabled={isPending} defaultValue={initialData?.customer_notice?.最低成行人數 ?? 5} />
                        <span className="text-sm text-gray-600">人</span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">活動未達人數處置</label>
                      <select name="customer_not_met" className="w-full rounded-lg border border-gray-300 px-3 py-2" disabled={isPending} defaultValue={initialData?.customer_notice?.未達人數處置 ?? ""}>
                        {未達人數處置選項.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* 注意事項 */}
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">注意事項</h2>
                <textarea name="notes" rows={6} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900" placeholder={注意事項範例} disabled={isPending} defaultValue={initialData?.notes ?? ""} />
              </section>

              {/* 活動地點與交通（activity_address、nearby_transport；儲存時由後台依地址寫入 map_embed_html，與總站共用 DB） */}
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">活動地點與交通</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">活動詳細地址</label>
                    <input
                      type="text"
                      value={activityAddress}
                      onChange={(e) => {
                        setActivityAddress(e.target.value);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      placeholder="例如：台北市士林區士商路150號"
                      disabled={isPending}
                    />
                    <p className="mt-1.5 text-xs text-gray-500">
                      僅需填寫地址；儲存後會依此自動產生地圖（課程頁地圖區塊顯示）。
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">附近大眾運輸</label>
                    <textarea
                      value={nearbyTransport}
                      onChange={(e) => setNearbyTransport(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      placeholder={"公車 ○○站，步行 4 分鐘\n捷運 ○○站出口，步行 10 分鐘"}
                      disabled={isPending}
                    />
                  </div>
                </div>
              </section>

              {/* 該課程常見問題（寫入 classes.course_faq_items，與總站共用 DB） */}
              <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">常見問題（該課程）</h2>
                  <button
                    type="button"
                    onClick={() => setCourseFaqItems((prev) => [...prev, { question: "", answer: "" }])}
                    className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
                    disabled={isPending}
                  >
                    + 新增問答
                  </button>
                </div>
                <p className="mb-3 text-xs text-gray-500">與全站 FAQ（後台「常見問題」）不同；此處僅屬本課程。</p>
                <div className="space-y-3">
                  {courseFaqItems.map((item, i) => (
                    <div key={i} className="rounded-lg border border-gray-200 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">Q{i + 1}</p>
                        <button
                          type="button"
                          onClick={() =>
                            setCourseFaqItems((prev) =>
                              prev.length <= 1 ? [{ question: "", answer: "" }] : prev.filter((_, idx) => idx !== i)
                            )
                          }
                          className="rounded bg-rose-500 px-2 py-1 text-xs font-medium text-white hover:bg-rose-600"
                          disabled={isPending}
                        >
                          刪除
                        </button>
                      </div>
                      <label className="mb-1 block text-sm text-gray-700">問題：</label>
                      <input
                        type="text"
                        value={item.question}
                        onChange={(e) =>
                          setCourseFaqItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, question: e.target.value } : x)))
                        }
                        className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                        disabled={isPending}
                      />
                      <label className="mb-1 block text-sm text-gray-700">回答：</label>
                      <textarea
                        rows={3}
                        value={item.answer}
                        onChange={(e) =>
                          setCourseFaqItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, answer: e.target.value } : x)))
                        }
                        className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                        disabled={isPending}
                      />
                    </div>
                  ))}
                </div>
              </section>
            </article>

            {/* 右欄：反白，選項 0-3、標題、選擇時間及人數 */}
            <aside className="mt-8 md:mt-0 md:col-span-5 lg:col-span-4">
              <div className="md:sticky md:top-24 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">適齡區間（歲）</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      name="age_min_ui"
                      min={0}
                      max={120}
                      step={1}
                      inputMode="numeric"
                      placeholder="最小"
                      value={ageMin}
                      onChange={(e) => setAgeMin(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      disabled={isPending}
                    />
                    <span className="text-gray-500">—</span>
                    <input
                      type="number"
                      name="age_max_ui"
                      min={0}
                      max={120}
                      step={1}
                      inputMode="numeric"
                      placeholder="最大"
                      value={ageMax}
                      onChange={(e) => setAgeMax(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      disabled={isPending}
                    />
                    <span className="text-sm text-gray-600">歲</span>
                  </div>
                  {sidebarPreviewLabels.length > 0 && (
                    <p className="mt-2 text-sm text-gray-600">已選：{sidebarPreviewLabels.join("、")}</p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">標題</label>
                  <input
                    name="title"
                    type="text"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    placeholder="課程名稱"
                    disabled={isPending}
                    defaultValue={initialData?.title ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (showHqCourseAdminUi && slugManuallyEditedRef.current) return;
                      setSlugInput(slugifyCourseTitle(v));
                      if (slugSuggestTimerRef.current != null) {
                        clearTimeout(slugSuggestTimerRef.current);
                      }
                        slugSuggestTimerRef.current = setTimeout(() => {
                        slugSuggestTimerRef.current = null;
                        if (showHqCourseAdminUi && slugManuallyEditedRef.current) return;
                        void suggestCourseSlugFromTitle(v)
                          .then((s) => {
                            if (!showHqCourseAdminUi || !slugManuallyEditedRef.current) setSlugInput(s);
                          })
                          .catch(() => {
                            /* 維持本地 slugify */
                          });
                      }, 450);
                    }}
                  />
                </div>
                {showHqCourseAdminUi ? (
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">網址代稱（英文）</label>
                    <input
                      type="text"
                      value={slugInput}
                      onChange={(e) => {
                        slugManuallyEditedRef.current = true;
                        setSlugInput(e.target.value);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900"
                      placeholder="kids-baking-class"
                      disabled={isPending}
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="網址代稱"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      前台網址為 <code className="rounded bg-gray-100 px-1">/course/代稱</code>
                      ；小寫英數與連字號，勿與 booking、page 等保留字或 UUID 格式相同。變更標題時會自動建議代稱（後台已設定{" "}
                      <code className="rounded bg-gray-100 px-1">GOOGLE_TRANSLATION_API_KEY</code>{" "}
                      時，中文標題會先經 Google 翻譯再產生英文代稱）。若已手動編輯代稱則不再覆寫。
                    </p>
                  </div>
                ) : null}
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">總站主題分類</label>
                  <select
                    key={`mc-${initialData?.id ?? "new"}-${globalCategories.join("\u0001")}`}
                    name="marketplace_category"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    disabled={isPending}
                    defaultValue={initialData?.marketplace_category ?? ""}
                  >
                    <option value="">請選擇</option>
                    {globalCategories.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                {showHqCourseAdminUi ? (
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">分站自訂分類</label>
                    <input
                      name="store_category"
                      type="text"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      placeholder="例如：蒙特梭利"
                      disabled={isPending}
                      defaultValue={initialData?.store_category ?? ""}
                    />
                  </div>
                ) : null}
                {showHqCourseAdminUi && !courseId && merchants.length > 1 ? (
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">所屬商家</label>
                    <select
                      value={selectedCreateMerchantId}
                      onChange={(e) => setSelectedCreateMerchantId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                      disabled={isPending}
                      aria-label="所屬商家"
                    >
                      {merchants.map((m) => (
                        <option key={m.merchant_id} value={m.merchant_id}>
                          {m.site_name}（{m.merchant_id}）
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">新增課程寫入的 merchant_id；總站代銷列表課請選總站商家。</p>
                  </div>
                ) : null}
                {showHqCourseAdminUi && !courseId && selectedCreateMerchantId === siteHqMerchantId && siteHqMerchantId !== "" ? (
                  <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        name="auto_listing_pairing_code"
                        value="on"
                        className="mt-1 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        disabled={isPending}
                      />
                      <span className="text-sm text-gray-800">
                        <strong>代銷列表課</strong>：建立時<strong>自動產生配對碼</strong>（<code className="rounded bg-white/80 px-1">listing_bind_token</code>
                        ）。僅在未填下方「庫存綁定」兩格、且未手填配對碼時生效。
                      </span>
                    </label>
                  </div>
                ) : null}
                <div className="mb-4 space-y-2">
                  <label className="mb-2 block text-sm font-medium text-gray-700">上課地區</label>
                  <select
                    name="city_region"
                    value={cityRegion}
                    onChange={(e) => {
                      setCityRegion(e.target.value);
                      setCityDistrict("");
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    disabled={isPending}
                  >
                    <option value="">請選擇縣市</option>
                    {CITY_REGIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <label className="mb-1 block text-xs font-medium text-gray-600">鄉鎮市區</label>
                  <select
                    name="city_district"
                    value={cityDistrict}
                    onChange={(e) => setCityDistrict(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    disabled={isPending || !cityRegion || districtOptions.length === 0}
                  >
                    <option value="">{cityRegion ? "請選擇鄉鎮市區" : "請先選縣市"}</option>
                    {districtOptions.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                {showHqCourseAdminUi ? (
                  <>
                    <div className="mb-4 rounded-lg border border-dashed border-sky-300 bg-sky-50/50 p-3">
                      <label className="mb-1 block text-sm font-medium text-gray-800">總站列表對應（老師填）</label>
                      <p className="mb-2 text-xs text-gray-600">
                        總部先在總站建好「列表課」後，可給您<strong>配對碼</strong>（建議）或「總站商家 ID + 列表課 UUID」兩格。填寫並<strong>儲存課程</strong>後，系統會自動把該列表課綁到<strong>本門課</strong>的名額與訂單。
                        有填配對碼時，下方兩格<strong>不會寫入資料庫</strong>（可留空）；僅在未填配對碼時才使用手動兩格。
                      </p>
                      <label className="mb-1 block text-xs font-medium text-gray-700">配對碼（listing_bind_token）</label>
                      <input
                        name="hq_listing_bind_token"
                        type="text"
                        className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 font-mono"
                        placeholder="總站提供的配對碼（可單獨填此欄完成綁定）"
                        disabled={isPending}
                        autoComplete="off"
                      />
                      <p className="mb-2 text-xs text-gray-500">或改用手動兩格（需一起填或一起留空）：</p>
                      <input
                        name="hq_listing_merchant_id"
                        type="text"
                        className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        placeholder="總站商家 ID（總站的 NEXT_PUBLIC_CLIENT_ID）"
                        disabled={isPending}
                        defaultValue={initialData?.hq_listing_merchant_id ?? ""}
                      />
                      <input
                        name="hq_listing_class_id"
                        type="text"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 font-mono"
                        placeholder="總站列表課 UUID（總站該筆 classes.id）"
                        disabled={isPending}
                        defaultValue={initialData?.hq_listing_class_id ?? ""}
                      />
                    </div>
                    <div className="mb-4 rounded-lg border border-dashed border-amber-200 bg-amber-50/40 p-3">
                      <label className="mb-1 block text-sm font-medium text-gray-800">庫存綁定（僅總站列表課）</label>
                      <p className="mb-2 text-xs text-gray-600">
                        <strong>總站後台</strong>編輯「列表課」時若老師尚未用上方自動綁定，可在此手動填老師的 <code className="rounded bg-white px-1">NEXT_PUBLIC_CLIENT_ID</code> 與老師課程 UUID。
                        一般<strong>老師分站只需填上方藍框</strong>即可。
                      </p>
                      <input
                        name="inventory_merchant_id"
                        type="text"
                        className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        placeholder="庫存商家 ID（老師）"
                        disabled={isPending}
                        defaultValue={initialData?.inventory_merchant_id ?? ""}
                      />
                      <input
                        name="inventory_class_id"
                        type="text"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 font-mono"
                        placeholder="庫存課程 UUID（老師端 classes.id）"
                        disabled={isPending}
                        defaultValue={initialData?.inventory_class_id ?? ""}
                      />
                    </div>
                  </>
                ) : null}
                <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-gray-800">選擇時間（課程可預約場次）</h3>
                  <button
                    type="button"
                    onClick={() => setDateTimeModalOpen(true)}
                    className="w-full py-3 px-4 rounded-xl border border-gray-200 bg-white text-left text-gray-600 hover:border-amber-400 hover:bg-amber-50/50 flex items-center justify-between"
                  >
                    <span>點選以新增多筆日期與時段</span>
                    <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                  </button>
                  {scheduledSlots.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {scheduledSlots.map((slot, i) => (
                        <li key={`${slot.date}-${slot.time}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                          <span className="font-medium text-gray-900 shrink-0">{slot.date} {slot.time}</span>
                          <span className="text-gray-600 shrink-0">名額</span>
                          <input
                            type="number"
                            min={1}
                            value={slot.capacity}
                            onChange={(e) => {
                              const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setScheduledSlots((prev) => prev.map((s, j) => (j === i ? { ...s, capacity: v } : s)));
                            }}
                            className="w-14 rounded border border-gray-200 px-2 py-1 text-center text-gray-900"
                            disabled={isPending}
                          />
                          <button
                            type="button"
                            onClick={() => setScheduledSlots((prev) => prev.filter((_, j) => j !== i))}
                            className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800 shrink-0"
                            aria-label="移除"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {scheduledSlots.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">已設定 {scheduledSlots.length} 個場次</p>
                  )}
                </div>
                <div className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasSale}
                      onChange={(e) => setHasSale(e.target.checked)}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      disabled={isPending}
                    />
                    <span className="text-sm font-medium text-gray-700">設為特價</span>
                  </label>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">{hasSale ? "售價（原價）" : "售價"}</label>
                    <input name="price" type="number" min={0} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900" placeholder="0" disabled={isPending} defaultValue={initialData?.price ?? ""} />
                  </div>
                  {hasSale && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">特價</label>
                      <input name="sale_price" type="number" min={0} required={hasSale} className="w-full rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-gray-900" placeholder="特價金額" disabled={isPending} defaultValue={initialData?.sale_price ?? ""} />
                    </div>
                  )}
                </div>
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">加購價</label>
                    <button
                      type="button"
                      onClick={() => setAddonItems((prev) => [...prev, { name: "", price: "" }])}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      disabled={isPending}
                    >
                      <Plus className="h-4 w-4" /> 新增加購項目
                    </button>
                  </div>
                  {addonItems.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-4 text-center text-sm text-gray-500">可新增多筆加購項目（名稱與價格）</p>
                  ) : (
                    <ul className="space-y-2">
                      {addonItems.map((item, i) => (
                        <li key={i} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => setAddonItems((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], name: e.target.value };
                              return next;
                            })}
                            placeholder="名稱"
                            className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            disabled={isPending}
                          />
                          <input
                            type="number"
                            min={0}
                            value={item.price}
                            onChange={(e) => setAddonItems((prev) => {
                              const next = [...prev];
                              next[i] = { ...next[i], price: e.target.value };
                              return next;
                            })}
                            placeholder="價格"
                            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            disabled={isPending}
                          />
                          <button
                            type="button"
                            onClick={() => setAddonItems((prev) => prev.filter((_, j) => j !== i))}
                            className="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800 shrink-0"
                            aria-label="移除"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </aside>

            {/* 手機版：主內容與右欄（含適齡等）之後，儲存鈕置於最底；桌機與主欄寬同列對齊 */}
            <div className="mt-2 flex w-full max-w-full justify-end border-t border-gray-200 pt-4 sm:pt-4 md:col-span-7 md:mt-0 md:border-0 md:pt-0 lg:col-span-8">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex w-full min-h-[44px] min-w-0 max-w-md items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-3 font-medium text-white hover:bg-amber-600 disabled:opacity-60 touch-manipulation sm:min-w-[120px] md:max-w-none md:w-auto"
              >
                {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {isPending ? "儲存中…" : courseId ? "儲存變更" : "儲存課程"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <DateTimeModal
        open={dateTimeModalOpen}
        onClose={() => setDateTimeModalOpen(false)}
        onAddBatch={(slots) => setScheduledSlots((prev) => [...prev, ...slots])}
        defaultCapacity={initialData?.capacity ?? 10}
      />
    </div>
  );
}
