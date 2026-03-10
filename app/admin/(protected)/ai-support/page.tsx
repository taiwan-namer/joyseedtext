import Link from "next/link";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { getStoreSettings } from "@/app/actions/storeSettingsActions";
import { AdminAiSupportClient } from "./AdminAiSupportClient";

export default async function AdminAiSupportPage() {
  const settings = await getStoreSettings();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          返回後台
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900">AI 客服</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <MessageCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">前台 AI 客服</h2>
            <p className="mt-1 text-sm text-gray-600">
              訪客在網站右下角可開啟 AI 客服，詢問課程、常見問題；查詢訂單需先登入。AI 回答內容來自
              <Link href="/admin/faq" className="text-amber-600 hover:underline">常見問題</Link>
              {" "}與課程資料，請至相關頁面維護。
            </p>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              前往前台查看 →
            </Link>
          </div>
        </div>
      </div>

      <AdminAiSupportClient
        initialAiChatEnabled={settings.aiChatEnabled}
        initialAiChatWelcomeMessage={settings.aiChatWelcomeMessage ?? ""}
      />
    </div>
  );
}
