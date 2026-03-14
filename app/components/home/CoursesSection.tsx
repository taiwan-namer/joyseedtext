"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Image, ChevronLeft, ChevronRight } from "lucide-react";
import type { Activity } from "@/app/lib/homeSectionTypes";

const ACTIVITY_CARD_WIDTH = 280;
const ACTIVITY_GAP = 16;
const ACTIVITY_AUTO_SCROLL_MS = 4500;

type Variant = "carousel" | "grid" | "list";

type Props = { activities: Activity[]; variant?: Variant };

function CourseCard({ activity }: { activity: Activity }) {
  const isSoldOut = activity.stock === 0;
  return (
    <article className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="aspect-square bg-gray-200 flex items-center justify-center overflow-hidden">
        {activity.imageUrl ? (
          <img src={activity.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <Image className="w-14 h-14 text-gray-400" strokeWidth={1.5} />
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          {activity.category && (
            <span className="text-xs text-gray-500 truncate">{activity.category}</span>
          )}
          {activity.ageTags && activity.ageTags.length > 0 && (
            <span className="text-xs text-gray-600 shrink-0">{activity.ageTags.join("、")}</span>
          )}
        </div>
        <h3 className="font-medium text-gray-800 line-clamp-2 mb-2 text-sm">{activity.title}</h3>
        {activity.description && (
          <p className="text-xs text-gray-600 line-clamp-2 mb-2 leading-relaxed">
            {activity.description}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 mb-3">
          <p className="text-amber-600 font-semibold text-sm">
            NT$ {activity.price.toLocaleString()} 起
          </p>
        </div>
        <Link
          href={activity.detailHref}
          className={`mt-auto w-full py-2.5 rounded-lg text-sm font-medium text-center transition-colors block ${
            isSoldOut
              ? "bg-gray-200 text-gray-500 cursor-not-allowed pointer-events-none"
              : "bg-amber-500 text-white hover:bg-amber-600"
          }`}
        >
          立即報名
        </Link>
      </div>
    </article>
  );
}

function CourseListItem({ activity }: { activity: Activity }) {
  const isSoldOut = activity.stock === 0;
  return (
    <article className="flex flex-col sm:flex-row gap-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="shrink-0 w-full sm:w-40 aspect-square sm:aspect-[1] rounded-lg overflow-hidden bg-gray-200">
        {activity.imageUrl ? (
          <img src={activity.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Image className="w-10 h-10 text-gray-400" strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {activity.category && (
            <span className="text-xs text-gray-500">{activity.category}</span>
          )}
          {activity.ageTags && activity.ageTags.length > 0 && (
            <span className="text-xs text-gray-600">{activity.ageTags.join("、")}</span>
          )}
        </div>
        <h3 className="font-medium text-gray-800 mb-1">{activity.title}</h3>
        {activity.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-2">{activity.description}</p>
        )}
        <div className="flex items-center justify-between gap-4 mt-auto">
          <p className="text-amber-600 font-semibold">NT$ {activity.price.toLocaleString()} 起</p>
          <Link
            href={activity.detailHref}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isSoldOut
                ? "bg-gray-200 text-gray-500 cursor-not-allowed pointer-events-none"
                : "bg-amber-500 text-white hover:bg-amber-600"
            }`}
          >
            立即報名
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function CoursesSection({ activities, variant = "carousel" }: Props) {
  const [activityIndex, setActivityIndex] = useState(0);
  const activityScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (variant !== "carousel" || activities.length === 0) return;
    const timer = setInterval(() => {
      setActivityIndex((i) => (i + 1) % activities.length);
    }, ACTIVITY_AUTO_SCROLL_MS);
    return () => clearInterval(timer);
  }, [activities.length, variant]);

  useEffect(() => {
    if (variant !== "carousel") return;
    const el = activityScrollRef.current;
    if (!el || activities.length === 0) return;
    const step = ACTIVITY_CARD_WIDTH + ACTIVITY_GAP;
    el.scrollTo({ left: Math.min(activityIndex, activities.length - 1) * step, behavior: "smooth" });
  }, [activityIndex, activities.length, variant]);

  if (variant === "grid") {
    return (
      <section className="w-full py-6 pb-8 bg-page">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">熱門課程</h2>
          {activities.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-500 text-sm">
              尚無課程，請至後台新增課程
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {activities.map((activity) => (
                <CourseCard key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (variant === "list") {
    return (
      <section className="w-full py-6 pb-8 bg-page">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">熱門課程</h2>
          {activities.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-500 text-sm">
              尚無課程，請至後台新增課程
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <CourseListItem key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-6 pb-8 relative bg-page">
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">熱門課程</h2>
      </div>
      <div className="relative w-full">
        <button
          type="button"
          onClick={() =>
            setActivityIndex((i) => (i === 0 ? Math.max(0, activities.length - 1) : i - 1))
          }
          aria-label="上一則課程"
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-amber-500 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={() =>
            setActivityIndex((i) => (i >= Math.max(0, activities.length - 1) ? 0 : i + 1))
          }
          aria-label="下一則課程"
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-amber-500 hover:text-white transition-colors"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
        <div
          ref={activityScrollRef}
          className="w-full overflow-x-auto scrollbar-hide px-4 sm:px-12 snap-x snap-mandatory scroll-smooth"
        >
          <div className="flex gap-4 min-w-max py-2">
            {activities.length === 0 ? (
              <div className="shrink-0 w-[280px] snap-start bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
                尚無課程，請至後台新增課程
              </div>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} className="shrink-0 w-[280px] snap-start">
                  <CourseCard activity={activity} />
                </div>
              ))
            )}
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 flex justify-center gap-2 mt-4">
          {activities.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActivityIndex(i)}
              aria-label={`第 ${i + 1} 個課程`}
              className={`h-2 rounded-full transition-all ${
                i === activityIndex ? "w-6 bg-amber-500" : "w-2 bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
