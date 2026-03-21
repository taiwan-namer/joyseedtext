/** 課程列表／篩選載入時佔位，降低 CLS 與閃爍 */
export function CourseCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <article
      className={`animate-pulse bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm flex flex-col ${className}`}
    >
      <div className="aspect-square bg-gray-200" />
      <div className="p-3 flex-1 flex flex-col gap-2 min-h-[120px]">
        <div className="flex justify-between gap-2">
          <div className="h-3 bg-gray-200 rounded w-16" />
          <div className="h-3 bg-gray-200 rounded w-20" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-4/5" />
        <div className="h-8 bg-gray-200 rounded-lg w-full mt-auto" />
      </div>
    </article>
  );
}
