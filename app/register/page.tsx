"use client";

import { useState } from "react";
import Link from "next/link";
import { registerMember } from "@/app/actions/memberActions";
import { HeaderMember } from "@/app/components/HeaderMember";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";

export default function RegisterPage() {
  const { siteName } = useStoreSettings();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setLoading(true);
    try {
      const res = await registerMember({ name, phone, email });
      if (res.success) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("member_registered", "1");
        }
        setResult({ type: "success", message: "🎉 註冊成功！" });
        setName("");
        setPhone("");
        setEmail("");
      } else {
        setResult({ type: "error", message: res.error });
      }
    } finally {
      setLoading(false);
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
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">加入會員</h1>
            <p className="mt-2 text-gray-600 text-sm">
              填寫以下資料，即可成為會員並接收最新活動與優惠
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-amber-100 bg-white p-6 sm:p-8 shadow-sm space-y-5"
          >
            {result && (
              <div
                role="alert"
                className={`rounded-lg px-4 py-3 text-sm ${
                  result.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {result.message}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                姓名 <span className="text-amber-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="請輸入您的姓名"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                手機號碼 <span className="text-amber-500">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09xxxxxxxx"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                電子信箱 <span className="text-amber-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-medium bg-amber-500 text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "處理中..." : "加入會員"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500">
            送出即表示同意本站會員條款與個資使用說明
          </p>
        </div>
      </main>
    </div>
  );
}
