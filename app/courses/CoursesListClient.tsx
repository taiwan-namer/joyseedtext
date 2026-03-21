"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { HeaderMember } from "@/app/components/HeaderMember";
import { CourseCardSkeleton } from "@/app/components/CourseCardSkeleton";
import { getCoursesForListpage } from "@/app/actions/productActions";
import type { CourseForPublic } from "@/app/actions/productActions";
import { COURSES_LIST_PAGE_SIZE, MARKETPLACE_CATEGORIES } from "@/lib/constants";

function parsePositiveInt(value: string | null, fallback: number): number {
  if (value == null || value === "") return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseOptionalAge(value: string): number | null {
  if (value === "") return null;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0 || n > 99) return null;
  return n;
}

function buildQueryString(next: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  Object.entries(next).forEach(([k, v]) => {
    if (v != null && String(v).trim() !== "") p.set(k, String(v).trim());
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

export default function CoursesListClient() {
  const { siteName } = useStoreSettings();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseForPublic[]>([]);
  const [total, setTotal] = useState(0);

  const page = parsePositiveInt(searchParams.get("page"), 1);
  const category = searchParams.get("category") ?? "";
  const searchQuery = searchParams.get("searchQuery") ?? "";
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";
  const minAge = searchParams.get("minAge") ?? "";
  const maxAge = searchParams.get("maxAge") ?? "";

  const queryKey = useMemo(() => searchParams.toString(), [searchParams]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getCoursesForListpage({
      page,
      pageSize: COURSES_LIST_PAGE_SIZE,
      category: category || undefined,
      searchQuery: searchQuery || undefined,
      startDate: startDate || null,
      endDate: endDate || null,
      minAge: parseOptionalAge(minAge),
      maxAge: parseOptionalAge(maxAge),
    });
    setLoading(false);
    if (!res.success) {
      setCourses([]);
      setTotal(0);
      setError(res.error);
      return;
    }
    setCourses(res.data);
    setTotal(res.total);
  }, [page, category, searchQuery, startDate, endDate, minAge, maxAge]);

  useEffect(() => {
    void fetchList();
  }, [fetchList, queryKey]);

  const totalPages = Math.max(1, Math.ceil(total / COURSES_LIST_PAGE_SIZE));

  const goPage = (p: number) => {
    const next = {
      page: p > 1 ? String(p) : undefined,
      category: category || undefined,
      searchQuery: searchQuery || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      minAge: minAge || undefined,
      maxAge: maxAge || undefined,
    };
    router.push(`${pathname}${buildQueryString(next)}`);
  };

  const onFilterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = {
      page: undefined as string | undefined,
      category: (fd.get("category") as string)?.trim() || undefined,
      searchQuery: (fd.get("searchQuery") as string)?.trim() || undefined,
      startDate: (fd.get("startDate") as string)?.trim() || undefined,
      endDate: (fd.get("endDate") as string)?.trim() || undefined,
      minAge: (fd.get("minAge") as string)?.trim() || undefined,
      maxAge: (fd.get("maxAge") as string)?.trim() || undefined,
    };
    router.push(`${pathname}${buildQueryString(next)}`);
  };

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="text-xl font-bold text-brand shrink-0">
            {siteName}
          </Link>
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/courses/intro" className="text-sm text-gray-600 hover:text-brand whitespace-nowrap hidden sm:inline">
              介紹文章
            </Link>
            <HeaderMember />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <nav className="mb-6 text-sm text-gray-500" aria-label="麵包屑">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/" className="hover:text-brand transition-colors">
                首頁
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 shrink-0" />
              <span className="text-gray-700">課程列表</span>
            </li>
          </ol>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <h1 className="text-xl font-bold text-gray-900">課程列表</h1>
          <Link
            href="/courses/intro"
            className="text-sm text-brand hover:underline w-fit"
          >
            查看課程介紹文章 →
          </Link>
        </div>

        <form
          onSubmit={onFilterSubmit}
          className="mb-8 p-4 rounded-xl border border-gray-200 bg-white space-y-4 shadow-sm"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="block text-sm">
              <span className="text-gray-600 mb-1 block">關鍵字</span>
              <input
                name="searchQuery"
                type="search"
                defaultValue={searchQuery}
                placeholder="課程名稱"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 mb-1 block">主題分類</span>
              <select
                name="category"
                defaultValue={category}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
              >
                <option value="">全部分類</option>
                {MARKETPLACE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
              <label className="block text-sm">
                <span className="text-gray-600 mb-1 block">開始日期</span>
                <input
                  name="startDate"
                  type="date"
                  defaultValue={startDate}
                  className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600 mb-1 block">結束日期</span>
                <input
                  name="endDate"
                  type="date"
                  defaultValue={endDate}
                  className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-gray-600 mb-1 block">最小年齡</span>
              <input
                name="minAge"
                type="number"
                min={0}
                max={99}
                defaultValue={minAge}
                placeholder="選填"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600 mb-1 block">最大年齡</span>
              <input
                name="maxAge"
                type="number"
                min={0}
                max={99}
                defaultValue={maxAge}
                placeholder="選填"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90"
            >
              套用篩選
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => router.push(pathname)}
            >
              清除
            </button>
          </div>
        </form>

        {error && (
          <p className="text-red-600 text-sm mb-4" role="alert">
            {error}
            {error.includes("list_classes_for_merchant_page") || error.includes("function") ? (
              <span className="block mt-1 text-gray-600">
                （若為開發環境，請於 Supabase 執行 migration：list_classes_for_merchant_page）
              </span>
            ) : null}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading
            ? Array.from({ length: COURSES_LIST_PAGE_SIZE }).map((_, i) => <CourseCardSkeleton key={i} />)
            : courses.length === 0
              ? (
                  <p className="text-gray-500 col-span-full py-12 text-center">
                    沒有符合條件的課程。
                  </p>
                )
              : courses.map((course) => {
                  const price =
                    course.salePrice != null && course.price != null && course.salePrice < course.price
                      ? course.salePrice
                      : course.price ?? 0;
                  const tags = course.sidebarOptionLabels ?? course.ageTags ?? [];
                  const soldOut = course.capacity === 0;
                  return (
                    <article
                      key={course.id}
                      className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                    >
                      <div className="relative aspect-square bg-gray-200 flex items-center justify-center overflow-hidden">
                        {course.imageUrl ? (
                          <Image
                            src={course.imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          />
                        ) : (
                          <ImageIcon className="w-14 h-14 text-gray-400 relative z-[1]" strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col min-h-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          {course.marketplace_category ? (
                            <span className="text-xs text-gray-500 truncate">{course.marketplace_category}</span>
                          ) : (
                            <span className="text-xs text-gray-400">課程</span>
                          )}
                          {tags.length > 0 && (
                            <span className="text-xs text-gray-600 shrink-0 text-right">{tags.join("、")}</span>
                          )}
                        </div>
                        <h2 className="font-semibold text-gray-900 line-clamp-2 mb-2">{course.title}</h2>
                        <p className="text-amber-600 font-semibold text-sm mb-4">
                          NT$ {price.toLocaleString()} 起
                        </p>
                        <Link
                          href={`/course/${course.id}`}
                          className={`mt-auto w-full py-2.5 rounded-lg text-sm font-medium text-center transition-colors block ${
                            soldOut
                              ? "bg-gray-200 text-gray-500 pointer-events-none"
                              : "bg-amber-500 text-white hover:bg-amber-600"
                          }`}
                        >
                          查看詳情
                        </Link>
                      </div>
                    </article>
                  );
                })}
        </div>

        {!loading && totalPages > 1 && (
          <nav
            className="mt-10 flex flex-wrap items-center justify-center gap-2"
            aria-label="分頁"
          >
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goPage(page - 1)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              上一頁
            </button>
            <span className="text-sm text-gray-600 px-2">
              第 {page} / {totalPages} 頁（共 {total} 筆）
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goPage(page + 1)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-40"
            >
              下一頁
              <ChevronRight className="w-4 h-4" />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
