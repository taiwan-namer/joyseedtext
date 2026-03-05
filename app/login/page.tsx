"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HeaderMember } from "@/app/components/HeaderMember";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") ?? "/";
  const { siteName } = useStoreSettings();
  const [loading, setLoading] = useState<"google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading("google");
    try {
      const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`;
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (err) {
        setError(err.message);
        setLoading(null);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "登入失敗");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex flex-col">
      <header className="border-b border-amber-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-lg px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-brand">
            {siteName}
          </Link>
          <HeaderMember />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">登入 / 註冊</h1>
            <p className="mt-2 text-gray-600 text-sm">
              使用以下方式快速登入，首次使用即自動註冊會員
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-white p-6 sm:p-8 shadow-sm space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-lg px-4 py-3 text-sm bg-red-50 text-red-800 border border-red-200"
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={!!loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border-2 border-gray-200 bg-white text-gray-800 font-medium hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <GoogleIcon className="w-6 h-6 shrink-0" />
              {loading === "google" ? "處理中…" : "以 Google 帳號繼續"}
            </button>

            <div className="relative my-4">
              <span className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </span>
              <span className="relative flex justify-center text-xs text-gray-500 bg-white px-2">或</span>
            </div>

            <Link
              href={`/register?next=${encodeURIComponent(nextUrl)}`}
              className="block w-full py-3 px-4 rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-800 font-medium hover:bg-amber-100 hover:border-amber-300 text-center transition-colors"
            >
              使用 E-mail 註冊
            </Link>
          </div>

          <p className="mt-6 text-center text-xs text-gray-500">
            登入即表示同意本站服務條款與隱私政策
          </p>
        </div>
      </main>
    </div>
  );
}
