"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getSlotRemainingCounts, type SlotRemaining } from "@/app/actions/bookingActions";
import SlotDateTimePickerModal from "@/app/components/SlotDateTimePickerModal";
import { CourseAgeRangePill } from "@/app/components/CourseCoverBadges";
import type { CourseForPublic } from "@/app/actions/productActions";
import type { CourseDetail } from "@/app/course/course-data";

type CourseBookingInput = CourseForPublic | CourseDetail;

type Props = {
  course: CourseBookingInput;
  /** DB 課程 id；靜態假資料可為 null */
  classId: string | null;
  /** 結帳與導向用（通常等於 `course.slug`） */
  routeSlug: string;
  ageTags: string[];
  ageRange: string;
};

export default function CoursePostBookingPanel({
  course,
  classId,
  routeSlug,
  ageTags,
  ageRange,
}: Props) {
  const router = useRouter();
  const [dateTimeModalOpen, setDateTimeModalOpen] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState<{ date: string; time: string } | null>(null);
  const [selectedAddonIndices, setSelectedAddonIndices] = useState<number[]>([]);
  const [slotRemainingList, setSlotRemainingList] = useState<SlotRemaining[]>([]);

  const tagList = ageTags.length > 0 ? ageTags : ageRange ? [ageRange] : [];
  const slotCount = Array.isArray(course.scheduledSlots) ? course.scheduledSlots.length : 0;

  const hasSale =
    typeof course.salePrice === "number" &&
    typeof course.price === "number" &&
    course.salePrice < (course.price ?? 0);
  const basePrice = hasSale && course.salePrice != null ? course.salePrice : course.price ?? 0;
  const addonTotal = Array.isArray(course.addonPrices)
    ? selectedAddonIndices.reduce((sum, i) => {
        const price = Number(course.addonPrices?.[i]?.price);
        return sum + (Number.isFinite(price) && price >= 0 ? price : 0);
      }, 0)
    : 0;
  const totalPrice = basePrice + addonTotal;

  useEffect(() => {
    if (!dateTimeModalOpen || !classId) return;
    let cancelled = false;
    getSlotRemainingCounts(classId).then((res) => {
      if (!cancelled && res.success) setSlotRemainingList(res.slots);
      else if (!cancelled) setSlotRemainingList([]);
    });
    return () => {
      cancelled = true;
    };
  }, [dateTimeModalOpen, classId]);

  useEffect(() => {
    if (!selectedDateTime) return;
    const q = new URLSearchParams({
      date: selectedDateTime.date,
      time: selectedDateTime.time,
      total: String(totalPrice),
    });
    if (selectedAddonIndices.length > 0) {
      q.set("addon", selectedAddonIndices.join(","));
    }
    router.prefetch(`/course/${routeSlug}/checkout?${q.toString()}`);
  }, [selectedDateTime, selectedAddonIndices, totalPrice, routeSlug, router]);

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
      startTransition(() => {
        router.push(`/course/${routeSlug}/checkout?${q.toString()}`);
      });
      return;
    }
    setDateTimeModalOpen(true);
  };

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">課程預約</h2>
      <h3 className={`text-xl font-bold text-gray-900 ${tagList.length > 0 ? "" : "mb-4"}`}>
        {course.title}
      </h3>
      {tagList.length > 0 ? (
        <div className="mb-4 mt-2 flex flex-wrap gap-2">
          {tagList.map((tag) => (
            <CourseAgeRangePill key={tag} size="lg">
              {tag}
            </CourseAgeRangePill>
          ))}
        </div>
      ) : null}

      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">選擇日期與時間</label>
        <button
          type="button"
          onClick={() => setDateTimeModalOpen(true)}
          className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-gray-600 transition-colors hover:border-brand hover:bg-brand/10"
        >
          {selectedDateTime ? (
            <span className="font-medium text-gray-900">
              {selectedDateTime.date} {selectedDateTime.time}
            </span>
          ) : (
            <span>請選擇日期與時段</span>
          )}
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        </button>
        {slotCount > 0 ? (
          <p className="mt-1.5 text-xs text-gray-500">可預約場次：{slotCount} 個時段</p>
        ) : null}
      </div>

      {course.price != null ? (
        <div className="mb-4 flex items-center justify-between gap-4 text-sm">
          {course.salePrice != null && course.salePrice < (course.price ?? 0) ? (
            <>
              <p className="text-gray-500">
                售價 <span className="line-through">NT$ {course.price.toLocaleString()}</span>
              </p>
              <p className="text-lg font-bold text-brand">特價 NT$ {course.salePrice.toLocaleString()}</p>
            </>
          ) : (
            <p className="text-lg font-bold text-gray-900">售價 NT$ {(course.price ?? 0).toLocaleString()}</p>
          )}
        </div>
      ) : null}

      {Array.isArray(course.addonPrices) && course.addonPrices.length > 0 ? (
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-gray-700">加購價</p>
          <ul className="space-y-3">
            {course.addonPrices.map((addon, i) => {
              const price = Number(addon.price);
              const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;
              return (
                <li key={i} className="flex items-center gap-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selectedAddonIndices.includes(i)}
                    onClick={() => toggleAddon(i)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 transition-colors hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1"
                  >
                    {selectedAddonIndices.includes(i) ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                    ) : null}
                  </button>
                  <span className="flex-1 text-gray-700">{String(addon.name ?? "")}</span>
                  <span className="font-medium text-gray-900">+ NT$ {safePrice.toLocaleString()}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="flex items-center justify-between text-base font-bold text-gray-900">
              <span>總計</span>
              <span>NT$ {totalPrice.toLocaleString()}</span>
            </p>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={goToCheckout}
        className="w-full rounded-full bg-brand px-4 py-3 font-medium text-white transition-colors hover:bg-brand-hover"
      >
        立即預定
      </button>

      <SlotDateTimePickerModal
        open={dateTimeModalOpen}
        onClose={() => setDateTimeModalOpen(false)}
        onConfirm={(date, time) => setSelectedDateTime({ date, time })}
        availableSlots={course.scheduledSlots ?? []}
        remainingCapacity={("capacity" in course ? course.capacity : null) ?? null}
        slotRemainingList={slotRemainingList}
      />
    </section>
  );
}

