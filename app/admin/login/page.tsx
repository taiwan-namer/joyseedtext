"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { adminLogin } from "@/app/actions/adminAuthActions";

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next") ?? "/admin";
  const nextSafe =
    (nextRaw.startsWith("/admin") && !nextRaw.startsWith("//")) ||
    (nextRaw.startsWith("/api/admin/") && !nextRaw.startsWith("//"));
  const next = nextSafe ? nextRaw : "/admin";
  const { siteName } = useStoreSettings();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await adminLogin(formData);
    setPending(false);
    if (result.success) {
      // 用整頁導向避免 router.push + refresh 造成的短暫卡頓，cookie 已由 server action 寫入
      window.location.href = next;
      return;
    }
    setError(result.error);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">{siteName}</h1>
          <p className="text-sm text-gray-500 mt-1">後台管理</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          {error && (
            <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-100" role="alert">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="admin-account" className="block text-sm font-medium text-gray-700 mb-1">
              帳號
            </label>
            <input
              id="admin-account"
              name="account"
              type="text"
              autoComplete="username"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="請輸入帳號"
              disabled={pending}
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1">
              密碼
            </label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="請輸入密碼"
              disabled={pending}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 rounded-lg font-medium text-white bg-gray-700 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-60 transition-colors"
          >
            {pending ? "登入中…" : "登入"}
          </button>
        </form>
      </div>
    </div>
  );
}
