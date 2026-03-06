"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Mail, Gift } from "lucide-react";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { HeaderMember } from "@/app/components/HeaderMember";
import { createClient } from "@/lib/supabase/client";

export default function BookingSuccessPage() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") ?? "";
  const { siteName } = useStoreSettings();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user);
    });
  }, []);

  const goToLogin = () => {
    window.location.href = `/login?next=${encodeURIComponent("/member")}`;
  };

  const goToEmailSignup = () => {
    window.location.href = "/?openLogin=email";
  };

  return (
    <div className="min-h-screen flex flex-col bg-page">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm shrink-0">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-brand">
            {siteName}
          </Link>
          <HeaderMember />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {/* 1. 預約成功提示 */}
        <CheckCircle
          className="w-16 h-16 mx-auto text-green-500 flex-shrink-0"
          strokeWidth={1.5}
        />
        <h1 className="text-2xl font-bold mt-4 text-gray-800">
          預約已送出！
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          {bookingId
            ? `您的訂單編號 ${bookingId.slice(0, 8)}…，可至會員中心查看。請記得於上課當日現場繳費。`
            : "請記得於上課當日現場繳費。"}
        </p>

        {/* 僅在未登入時顯示綁定帳號區：已登入（Gmail/Email）則不顯示 */}
        {isLoggedIn === false && (
          <>
            <div className="bg-orange-50 p-4 rounded-xl mt-6 text-left">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-500 shrink-0" />
                <h2 className="font-semibold text-gray-800">
                  🎉 專屬福利：綁定帳號
                </h2>
              </div>
              <ul className="text-sm text-gray-700 space-y-1 mt-2 list-none pl-0">
                <li>1. 下次報名免填資料。</li>
                <li>2. 隨時查看預約與退款進度。</li>
                <li>3. 獲取專屬優惠碼。</li>
              </ul>
            </div>
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={goToEmailSignup}
                className="w-full py-3 px-4 rounded-xl font-medium text-gray-900 bg-white border border-gray-300 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <Mail className="w-5 h-5 shrink-0 text-gray-500" />
                <span>使用 E-mail 登入或註冊</span>
              </button>
              <button
                type="button"
                onClick={goToLogin}
                className="w-full py-3 px-4 rounded-xl font-medium text-gray-900 bg-white border border-gray-300 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full border border-gray-400 text-xs font-bold text-gray-700 shrink-0">
                  G
                </span>
                <span>使用 Google 帳號綁定</span>
              </button>
            </div>
          </>
        )}

        {/* 會員中心 / 返回首頁 */}
        <div className="mt-6 flex flex-col items-center gap-2">
          {bookingId && (
            <Link
              href="/member"
              className="text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              前往會員中心查看訂單
            </Link>
          )}
          <Link
            href="/"
            className="text-xs text-gray-400 underline hover:text-gray-600 transition-colors"
          >
            返回首頁
          </Link>
        </div>
      </div>
      </main>
    </div>
  );
}
