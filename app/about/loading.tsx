import { Loader2 } from "lucide-react";

/** 從首頁等導向「關於我們」頁時的過場（含手機） */
export default function PublicAboutLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 px-4">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500 shrink-0" aria-hidden />
      <p className="text-sm text-gray-500">載入關於我們…</p>
    </div>
  );
}
