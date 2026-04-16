"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { User, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import LoginModal from "./LoginModal";
import { getCurrentMemberName } from "@/app/actions/bookingActions";

/**
 * 右上角會員區：未登入顯示「登入」（點擊開彈窗），已登入顯示消費者姓名（連結至會員中心）+ 「登出」按鈕
 */
export function HeaderMember() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setMemberName(null);
      return;
    }
    let cancelled = false;
    getCurrentMemberName().then((name) => {
      if (!cancelled) setMemberName(name);
    });
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  // 網址 ?openLogin=email 或 ?openLogin=1 時自動開啟登入彈窗（例如從預約成功頁引導）
  useEffect(() => {
    const open = searchParams.get("openLogin");
    if (open === "email" || open === "1") setLoginOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!loginOpen) return;
    router.prefetch("/");
    router.prefetch("/member");
  }, [loginOpen, router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        {isLoggedIn ? (
          <>
            <Link
              href="/member"
              prefetch
              className="flex items-center gap-2 min-h-[44px] min-w-[44px] justify-center sm:min-w-0 sm:justify-start p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors touch-manipulation"
              aria-label={memberName ? `${memberName}，會員中心` : "會員中心"}
            >
              <User size={22} />
              <span className="text-sm hidden sm:inline max-w-[8rem] truncate" title={memberName ?? "會員中心"}>
                {memberName || "會員中心"}
              </span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors touch-manipulation"
              aria-label="登出"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">登出</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="flex items-center gap-2 min-h-[44px] min-w-[44px] justify-center sm:min-w-0 sm:justify-start p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors touch-manipulation"
            aria-label="登入"
          >
            <User size={22} />
            <span className="text-sm hidden sm:inline">登入</span>
          </button>
        )}
      </div>
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} initialStep={searchParams.get("openLogin") === "email" ? 2 : undefined} />
    </>
  );
}
