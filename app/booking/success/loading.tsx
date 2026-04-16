/** 付款完成導向預約成功頁時的過場（含 LINE Pay 回跳） */
export default function BookingSuccessLoading() {
  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center gap-3 px-4">
      <div className="h-10 w-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" aria-hidden />
      <p className="text-gray-600 text-sm">載入中…</p>
    </div>
  );
}
