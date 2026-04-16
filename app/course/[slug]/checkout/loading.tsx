import { Loader2 } from "lucide-react";

/** 導航至結帳頁時的過場（含手機） */
export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center gap-3 px-4">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500 shrink-0" aria-hidden />
      <p className="text-gray-600 text-sm">載入結帳頁…</p>
    </div>
  );
}
