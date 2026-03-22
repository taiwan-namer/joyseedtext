"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { Image as LucideImage, ChevronLeft, ChevronRight } from "lucide-react";
import { getCoursesForHomepage } from "@/app/actions/productActions";
import type { CourseForPublic } from "@/app/actions/productActions";
import { dedupeCategoryList } from "@/lib/constants";
import type { Activity } from "@/app/lib/homeSectionTypes";

const ACTIVITY_CARD_WIDTH = 280;
const ACTIVITY_GAP = 16;
const ACTIVITY_AUTO_SCROLL_MS = 4500;

function courseToActivity(c: CourseForPublic): Activity {
  const price =
    c.salePrice != null && c.price != null && c.salePrice < c.price ? c.salePrice : c.price ?? 0;
  return {
    id: c.id,
    title: c.title,
    price,
    stock: c.capacity ?? 0,
    imageUrl: c.imageUrl ?? null,
    detailHref: `/course/${c.id}`,
    ageTags: c.sidebarOptionLabels ?? c.ageTags ?? [],
    category: c.marketplace_category?.trim() ? c.marketplace_category.trim() : "課程",
  };
}

type Props = {
  /** 與首頁畫布 courses 區塊背景／高度一致 */
  blockStyle?: React.CSSProperties;
};

/**
 * 首頁「依總站主題分籤」課程列：分籤來自 /api/global-categories（與課程列表一致），
 * 課程來自 getCoursesForHomepage（全店精簡列，依 marketplace_category 篩選）。
 * 避免只取前 N 筆導致分籤內容與後台修改不同步。
 */
export default function HomeMarketplaceCoursesSection({ blockStyle }: Props) {
  const [categoryLabels, setCategoryLabels] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activityIndex, setActivityIndex] = useState(0);
  const activityScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCategoriesLoading(true);
      try {
        const res = await fetch("/api/global-categories", { method: "GET", cache: "no-store" });
        if (!res.ok) throw new Error("categories fetch failed");
        const data = (await res.json()) as { categories?: unknown };
        const raw = data?.categories;
        const list = Array.isArray(raw)
          ? raw.map((v): string | null => (typeof v === "string" ? v.trim() : null)).filter((v): v is string => !!v)
          : [];
        if (!cancelled) {
          setCategoryLabels(dedupeCategoryList(list));
        }
      } catch {
        if (!cancelled) setCategoryLabels([]);
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCoursesLoading(true);
      setCoursesError(null);
      try {
        const res = await getCoursesForHomepage();
        if (cancelled) return;
        if (!res.success) {
          setAllActivities([]);
          setCoursesError(res.error);
          return;
        }
        setAllActivities(res.data.map(courseToActivity));
      } catch (e) {
        if (!cancelled) {
          setAllActivities([]);
          setCoursesError(e instanceof Error ? e.message : "載入課程失敗");
        }
      } finally {
        if (!cancelled) setCoursesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (categoryLabels.length === 0) {
      setSelectedCategory(null);
      return;
    }
    setSelectedCategory((prev) => {
      if (prev && categoryLabels.includes(prev)) return prev;
      return categoryLabels[0];
    });
  }, [categoryLabels]);

  const filteredActivities = useMemo(() => {
    if (!selectedCategory) return [];
    return allActivities.filter((a) => (a.category ?? "").trim() === selectedCategory);
  }, [allActivities, selectedCategory]);

  useEffect(() => {
    setActivityIndex(0);
    const el = activityScrollRef.current;
    if (el) el.scrollTo({ left: 0, behavior: "auto" });
  }, [selectedCategory]);

  useEffect(() => {
    if (filteredActivities.length === 0) return;
    const timer = setInterval(() => {
      setActivityIndex((i) => (i + 1) % filteredActivities.length);
    }, ACTIVITY_AUTO_SCROLL_MS);
    return () => clearInterval(timer);
  }, [filteredActivities.length, selectedCategory]);

  useEffect(() => {
    const el = activityScrollRef.current;
    if (!el || filteredActivities.length === 0) return;
    const step = ACTIVITY_CARD_WIDTH + ACTIVITY_GAP;
    el.scrollTo({ left: Math.min(activityIndex, filteredActivities.length - 1) * step, behavior: "smooth" });
  }, [activityIndex, filteredActivities.length]);

  const loading = categoriesLoading || coursesLoading;

  const onSelectCategory = useCallback((label: string) => {
    setSelectedCategory(label);
  }, []);

  return (
    <section className="w-full py-6 pb-8 relative bg-page" style={blockStyle}>
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">熱門課程</h2>
      </div>

      {/* 總站主題分籤（與 global_categories 一致） */}
      <div className="max-w-7xl mx-auto px-4 mb-5">
        {categoriesLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[72px] flex flex-col items-center gap-1.5">
                <div className="w-14 h-14 rounded-xl bg-gray-200" />
                <div className="h-3 w-12 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : categoryLabels.length === 0 ? (
          <p className="text-sm text-gray-500">尚未設定總站主題分類，請至總站 store_settings.global_categories 設定。</p>
        ) : (
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
            {categoryLabels.map((label) => {
              const selected = label === selectedCategory;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onSelectCategory(label)}
                  className={`shrink-0 snap-start flex flex-col items-center gap-1.5 w-[76px] sm:w-[80px] p-1.5 rounded-xl transition-all ${
                    selected
                      ? "ring-2 ring-amber-500 ring-offset-2 ring-offset-[var(--color-background)] bg-white"
                      : "opacity-90 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center text-xs font-semibold leading-tight text-center px-1 ${
                      selected ? "bg-amber-100 text-amber-900" : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {label.slice(0, 4)}
                  </div>
                  <span className="text-[10px] sm:text-xs text-gray-700 text-center leading-tight line-clamp-2 w-full">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
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
            ) : coursesError ? (
              <div className="shrink-0 w-full max-w-md snap-start bg-white rounded-xl border border-red-100 p-6 text-sm text-red-600">
                {coursesError}
              </div>
            ) : !selectedCategory ? null : filteredActivities.length === 0 ? (
              <div className="shrink-0 w-[280px] snap-start bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
                「{selectedCategory}」尚無課程
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
