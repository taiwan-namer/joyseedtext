import { Loader2 } from "lucide-react";

/**
 * 後台保護區預設過場：導航至尚未有專屬 loading 的子路由時顯示（含 `/admin` 商品管理區、手機側欄）。
 */
export default function AdminProtectedLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500 shrink-0" aria-hidden />
      <p className="text-sm text-gray-500">載入中…</p>
    </div>
  );
}
