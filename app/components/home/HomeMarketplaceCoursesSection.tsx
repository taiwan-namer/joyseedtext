"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { Image as LucideImage, ChevronLeft, ChevronRight } from "lucide-react";
import type { Activity } from "@/app/lib/homeSectionTypes";

const ACTIVITY_CARD_WIDTH = 280;
const ACTIVITY_GAP = 16;
const ACTIVITY_AUTO_SCROLL_MS = 4500;

type Props = {
  /** 與首頁畫布 courses 區塊背景／高度一致 */
  blockStyle?: React.CSSProperties;
  /** 由父層統一載入（與網格／列表區塊同一批資料） */
  activities: Activity[];
  loading: boolean;
  error?: string | null;
};

/**
 * 首頁「熱門課程」橫向輪播列：課程資料由父層 `getCoursesForHomepage` 取得後傳入。
 */
export default function HomeMarketplaceCoursesSection({ blockStyle, activities, loading, error }: Props) {
  const [activityIndex, setActivityIndex] = useState(0);
  const activityScrollRef = useRef<HTMLDivElement>(null);

  const filteredActivities = useMemo(() => activities, [activities]);

  useEffect(() => {
    if (filteredActivities.length === 0) return;
    const timer = setInterval(() => {
      setActivityIndex((i) => (i + 1) % filteredActivities.length);
    }, ACTIVITY_AUTO_SCROLL_MS);
    return () => clearInterval(timer);
  }, [filteredActivities.length]);

  useEffect(() => {
    const el = activityScrollRef.current;
    if (!el || filteredActivities.length === 0) return;
    const step = ACTIVITY_CARD_WIDTH + ACTIVITY_GAP;
    el.scrollTo({ left: Math.min(activityIndex, filteredActivities.length - 1) * step, behavior: "smooth" });
  }, [activityIndex, filteredActivities.length]);

  return (
    <section className="w-full py-6 pb-8 relative bg-page" style={blockStyle}>
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">熱門課程</h2>
      </div>
      <div className="relative w-full">
        <button
          type="button"
          disabled={loading || filteredActivities.length === 0}
          onClick={() =>
            setActivityIndex((i) => (i === 0 ? Math.max(0, filteredActivities.length - 1) : i - 1))
          }
          aria-label="上一則課程"
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-amber-500 hover:text-white transition-colors disabled:opacity-40"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          type="button"
          disabled={loading || filteredActivities.length === 0}
          onClick={() =>
            setActivityIndex((i) =>
              i >= Math.max(0, filteredActivities.length - 1) ? 0 : i + 1
            )
          }
          aria-label="下一則課程"
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-amber-500 hover:text-white transition-colors disabled:opacity-40"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
        <div
          ref={activityScrollRef}
          className="w-full overflow-x-auto scrollbar-hide px-4 sm:px-12 snap-x snap-mandatory scroll-smooth"
        >
          <div className="flex gap-4 min-w-max py-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="shrink-0 w-[280px] snap-start bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm animate-pulse flex flex-col"
                >
                  <div className="aspect-square bg-gray-200" />
                  <div className="p-3 space-y-2 flex-1">
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-8 bg-gray-200 rounded-lg w-full mt-2" />
                  </div>
                </div>
              ))
            ) : error ? (
              <div className="shrink-0 w-full max-w-md snap-start bg-white rounded-xl border border-red-100 p-6 text-sm text-red-600">
                {error}
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="shrink-0 w-[280px] snap-start bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
                目前尚無課程
              </div>
            ) : (
              filteredActivities.map((activity) => {
                const isSoldOut = activity.stock === 0;
                return (
                  <article
                    key={activity.id}
                    className="shrink-0 w-[280px] snap-start bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                  >
                    <div className="relative aspect-square bg-gray-200 flex items-center justify-center overflow-hidden">
                      {activity.imageUrl ? (
                        <NextImage
                          src={activity.imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="280px"
                        />
                      ) : (
                        <LucideImage className="w-14 h-14 text-gray-400 relative z-[1]" strokeWidth={1.5} />
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
              })
            )}
          </div>
        </div>
        {!loading && filteredActivities.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 flex justify-center gap-2 mt-4">
            {filteredActivities.map((_, i) => (
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
        )}
      </div>
    </section>
  );
}
