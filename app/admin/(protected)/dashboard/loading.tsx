import { Loader2 } from "lucide-react";

/** 導航至後台 Dashboard 時的過場（含手機側欄） */
export default function AdminDashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500 shrink-0" aria-hidden />
      <p className="text-sm text-gray-500">載入 Dashboard…</p>
    </div>
  );
}
