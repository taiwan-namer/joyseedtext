import Link from "next/link";
import { AlertTriangle, ChevronLeft, Clock, FileWarning, Link2, XCircle } from "lucide-react";
import type { VendorBindingGate } from "@/lib/vendorBindingStatus";
import { vendorRegistrationLinkPath } from "@/lib/vendorBindingStatus";

type BlockedGate = Exclude<VendorBindingGate, { kind: "ok" }>;

const bindButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600";

type Props = {
  gate: BlockedGate;
  /** 頂部返回連結，預設為商品列表 /admin */
  backHref?: string;
  backLabel?: string;
};

export default function VendorBindingGatePanel({
  gate,
  backHref = "/admin",
  backLabel = "返回商品列表",
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm font-medium text-gray-600 transition hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </div>

      <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        {gate.kind === "no_binding" && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Link2 className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-gray-900">需先完成分站供應商綁定</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              使用<strong className="font-medium text-gray-800">商品管理區</strong>與
              <strong className="font-medium text-gray-800">新增課程</strong>
              前，須先向總部申請<strong className="font-medium text-gray-800">分站供應商綁定</strong>
              ，並經總部審核通過後方可使用。請點選下方按鈕前往總站完成綁定申請。
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href={vendorRegistrationLinkPath} className={bindButtonClass}>
                前往分站供應商綁定
              </a>
            </div>
          </>
        )}

        {gate.kind === "pending_review" && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <Clock className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-gray-900">審核處理中</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              您的分站供應商申請已由總部受理，目前正在審核中。審核完成後即可使用商品管理與新增課程；無需重複送出申請，請稍待通知。
            </p>
          </>
        )}

        {gate.kind === "rejected" && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <XCircle className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-gray-900">審核未通過</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              總部已將您的分站供應商資格標示為<strong className="font-medium text-gray-800">未通過</strong>
              ，目前無法使用商品管理與新增課程。若需重新申請或洽詢原因，請透過下方連結前往總站與總部確認。
            </p>
            <div className="mt-6">
              <a href={vendorRegistrationLinkPath} className={bindButtonClass}>
                前往總站供應商頁面
              </a>
            </div>
          </>
        )}

        {gate.kind === "supplement_required" && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <FileWarning className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-gray-900">請補件後重新送出</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              總部需要您補齊或更新申請資料。請依下列說明準備文件後，點選下方按鈕前往與「分站供應商綁定」相同的總站流程重新提交。
            </p>
            {gate.adminReviewNote ? (
              <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                <p className="font-medium text-amber-900">總部說明</p>
                <p className="mt-1 whitespace-pre-wrap text-amber-950/90">{gate.adminReviewNote}</p>
              </div>
            ) : null}
            <div className="mt-6">
              <a href={vendorRegistrationLinkPath} className={bindButtonClass}>
                前往補件／分站供應商綁定
              </a>
            </div>
          </>
        )}

        {gate.kind === "error" && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-600">
              <AlertTriangle className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-gray-900">暫無法確認審核狀態</h1>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{gate.message}</p>
            <p className="mt-3 text-xs text-gray-500">
              亦可檢查分站伺服器日誌（resolveVendorBindingGate）與 Supabase 是否已套用 vendor 綁定相關 migration、欄位是否與總站一致。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
