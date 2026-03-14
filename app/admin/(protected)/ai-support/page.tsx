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

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">三大回應模板</h2>
        <p className="mb-4 text-sm text-gray-600">
          AI 會依使用者問題判斷類型，從對應來源查資料後回覆。目前支援三種：
        </p>
        <ul className="space-y-4">
          <li className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">1</span>
            <div>
              <h3 className="font-medium text-gray-900">課程</h3>
              <p className="mt-0.5 text-sm text-gray-600">推薦課程、適合年齡、本週活動、價格等。資料來自課程列表與課程介紹，回傳課程卡片（圖片、查看課程、立即報名）。</p>
              <p className="mt-1 text-xs text-gray-500">建議測試：有哪些適合 3 歲的課程？／本週有什麼活動？</p>
            </div>
          </li>
          <li className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">2</span>
            <div>
              <h3 className="font-medium text-gray-900">訂單</h3>
              <p className="mt-0.5 text-sm text-gray-600">查詢我的報名、訂單狀態。僅限已登入會員，回傳訂單列表與「查看課程」連結。</p>
              <p className="mt-1 text-xs text-gray-500">建議測試：我的訂單狀態是什麼？／我報名了什麼課？（需先登入前台）</p>
            </div>
          </li>
          <li className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-700">3</span>
            <div>
              <h3 className="font-medium text-gray-900">常見問題</h3>
              <p className="mt-0.5 text-sm text-gray-600">退款、付款方式、取消、聯絡方式等。資料來自
                <Link href="/admin/faq" className="text-amber-600 hover:underline">常見問題</Link>
                ，請在該頁維護正確內容（如匯款／退款說明）。
              </p>
              <p className="mt-1 text-xs text-gray-500">建議測試：怎麼退款？／如何繳費？／如何聯絡？</p>
            </div>
          </li>
        </ul>
      </div>

      <AdminAiSupportClient
        initialAiChatEnabled={settings.aiChatEnabled}
        initialAiChatWelcomeMessage={settings.aiChatWelcomeMessage ?? ""}
      />
    </div>
  );
}
