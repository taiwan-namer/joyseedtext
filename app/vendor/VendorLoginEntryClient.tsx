"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { VendorBindingGate } from "@/lib/vendorBindingStatus";
import { ensureBranchStoreProfile } from "@/app/actions/vendorOnboardingActions";

type Props = {
  merchantId: string;
  hasStoreProfile: boolean;
  initialSiteName: string;
  gate: VendorBindingGate;
};

function gateLabel(gate: VendorBindingGate): string {
  switch (gate.kind) {
    case "ok":
      return "已綁定且審核通過";
    case "no_binding":
      return "未綁定";
    case "pending_review":
      return "審核中";
    case "supplement_required":
      return "需補件";
    case "rejected":
      return "審核未通過";
    case "error":
      return "狀態讀取失敗";
    default:
      return "未知狀態";
  }
}

export default function VendorLoginEntryClient({
  merchantId,
  hasStoreProfile,
  initialSiteName,
  gate,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [siteName, setSiteName] = useState(initialSiteName);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const statusText = useMemo(() => gateLabel(gate), [gate]);

  const handleBootstrap = () => {
    setResult(null);
    startTransition(async () => {
      const res = await ensureBranchStoreProfile(siteName);
      if (!res.success) {
        setResult({ type: "error", message: res.error });
        return;
      }
      setResult({ type: "success", message: res.message });
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-800">分站供應商入口</h1>
          <p className="text-sm text-gray-500 mt-1">先完成分站初始化與 LINE 綁定，再進入後台</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 space-y-1">
          <p>
            <span className="font-medium">分站代碼：</span>
            {merchantId}
          </p>
          <p>
            <span className="font-medium">目前狀態：</span>
            {statusText}
          </p>
        </div>

        {result && (
          <div
            className={`rounded-lg px-4 py-3 text-sm border ${
              result.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            {result.message}
          </div>
        )}

        {!hasStoreProfile ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              尚未建立分站基本資料，請先填寫網站名稱建立第一筆資料，再進行 LINE 綁定。
            </p>
            <div>
              <label htmlFor="vendor-site-name" className="block text-sm font-medium text-gray-700 mb-1">
                網站名稱
              </label>
              <input
                id="vendor-site-name"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="請輸入網站名稱"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                disabled={isPending}
              />
            </div>
            <button
              type="button"
              onClick={handleBootstrap}
              disabled={isPending}
              className="w-full rounded-lg bg-amber-500 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {isPending ? "建立中…" : "建立分站資料"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {gate.kind === "ok" ? (
              <>
                <p className="text-sm text-emerald-700">
                  已完成 LINE 綁定與審核，現在可直接進入後台。
                </p>
                <Link
                  href="/admin"
                  className="block w-full text-center py-3 rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                >
                  進入後台
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-700">
                  請先使用 LINE 前往總站完成綁定流程，完成後會跳回分站並可進入後台。
                </p>
                <Link
                  href="/api/vendor/branch/line-login"
                  className="block w-full text-center py-3 rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                >
                  使用 LINE 登入並綁定
                </Link>
              </>
            )}
          </div>
        )}

        {gate.kind === "error" && (
          <p className="text-xs text-red-700">
            {gate.message}
          </p>
        )}
      </div>
    </div>
  );
}
