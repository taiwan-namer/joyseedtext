import { CourseCardSkeleton } from "@/app/components/CourseCardSkeleton";
import { COURSES_LIST_PAGE_SIZE } from "@/lib/constants";

/** 篩選／分頁導航時的過場（與舊 Suspense fallback 一致） */
export default function CoursesListLoading() {
  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <div className="h-7 w-32 rounded-md bg-gray-200 animate-pulse" />
          <div className="h-8 w-24 rounded-md bg-gray-200 animate-pulse" />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="h-4 w-48 rounded bg-gray-200 animate-pulse mb-8" />
        <div className="h-8 w-40 rounded bg-gray-200 animate-pulse mb-8" />
        <div className="h-40 rounded-xl bg-gray-200 animate-pulse mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: COURSES_LIST_PAGE_SIZE }).map((_, i) => (
            <CourseCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
