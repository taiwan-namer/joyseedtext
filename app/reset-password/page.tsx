"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { HeaderMember } from "@/app/components/HeaderMember";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { mapSupabaseAuthErrorToZh } from "@/lib/auth/supabaseAuthErrorZh";

export default function ResetPasswordPage() {
  const { siteName } = useStoreSettings();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    if (password.length < 6) {
      setResult({ type: "error", message: "密碼請至少 6 個字元。" });
      return;
    }
    if (password !== passwordConfirm) {
      setResult({ type: "error", message: "兩次輸入的密碼不一致。" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setResult({ type: "error", message: mapSupabaseAuthErrorToZh(error.message) });
        return;
      }
      setResult({ type: "success", message: "密碼已更新，請使用新密碼登入。" });
      setPassword("");
      setPasswordConfirm("");
    } catch (e) {
      setResult({
        type: "error",
        message: mapSupabaseAuthErrorToZh(e instanceof Error ? e.message : String(e)),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex flex-col">
      <header className="border-b border-amber-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-lg px-4 h-14 flex items-center justify-between">
          <Link href="/" prefetch className="text-lg font-bold text-brand touch-manipulation">
            {siteName}
          </Link>
          <HeaderMember />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">重設密碼</h1>
            <p className="mt-2 text-gray-600 text-sm">請設定新的登入密碼（至少 6 個字元）</p>
          </div>

          <form className="rounded-2xl border border-amber-100 bg-white p-6 sm:p-8 shadow-sm space-y-5" onSubmit={handleSubmit}>
            {result && (
              <div
                role="alert"
                className={`rounded-lg px-4 py-3 text-sm ${
                  result.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                <p>{result.message}</p>
                {result.type === "success" && (
                  <Link href="/login" className="mt-2 inline-block font-medium underline hover:no-underline">
                    前往登入 →
                  </Link>
                )}
              </div>
            )}

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                新密碼 <span className="text-amber-500">*</span>
              </label>
              <input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 個字元"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="new-password-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                確認新密碼 <span className="text-amber-500">*</span>
              </label>
              <input
                id="new-password-confirm"
                name="newPasswordConfirm"
                type="password"
                autoComplete="new-password"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="再次輸入新密碼"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-medium bg-amber-500 text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "處理中..." : "更新密碼"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
