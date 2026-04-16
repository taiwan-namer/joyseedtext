/** 導航至課程預約頁時的過場 */
export default function CourseBookingLoading() {
  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-screen-md px-4 h-14 flex items-center justify-between">
          <div className="h-7 w-28 rounded-md bg-gray-200 animate-pulse" />
          <div className="h-9 w-20 rounded-md bg-gray-200 animate-pulse" />
        </div>
      </header>
      <div className="mx-auto max-w-screen-md px-4 py-6">
        <div className="h-4 w-40 rounded bg-gray-200 animate-pulse mb-6" />
        <div className="h-7 w-32 rounded bg-gray-200 animate-pulse mb-8" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
