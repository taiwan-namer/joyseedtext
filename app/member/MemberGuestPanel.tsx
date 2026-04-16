import Link from "next/link";
import { UserPlus } from "lucide-react";

type Props = { siteName: string };

/** 未登入時的會員中心引導（由伺服端輸出，無需等 client 判斷登入狀態） */
export default function MemberGuestPanel({ siteName }: Props) {
  return (
    <div className="min-h-screen bg-page flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" prefetch className="text-xl font-bold text-brand hover:opacity-90 transition-colors">
            {siteName}
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-6">
            <UserPlus className="w-8 h-8 text-brand" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">會員專屬頁面</h1>
          <p className="text-gray-600 text-sm mb-6">
            此為會員中心，請先註冊成為會員後即可使用預約查詢、歷史訂單等功能。
          </p>
          <Link
            href="/login"
            prefetch
            className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium bg-brand text-white hover:bg-brand-hover transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            使用 Google 登入
          </Link>
          <Link
            href="/register"
            prefetch
            className="block mt-3 text-center text-sm text-gray-600 hover:text-brand transition-colors"
          >
            或使用信箱註冊
          </Link>
          <Link href="/" prefetch className="block mt-4 text-sm text-gray-500 hover:text-brand transition-colors">
            返回首頁
          </Link>
        </div>
      </main>
    </div>
  );
}
