"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { registerMember, sendRegistrationOtp } from "@/app/actions/memberActions";
import { HeaderMember } from "@/app/components/HeaderMember";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { createClient } from "@/lib/supabase/client";
import { mapSupabaseAuthErrorToZh } from "@/lib/auth/supabaseAuthErrorZh";

const OTP_COOLDOWN_SEC = 60;

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") ?? "/";
  const { siteName } = useStoreSettings();
  const supabase = createClient();

  const safeNext = nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : "/";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSendOtp = async () => {
    setResult(null);
    const em = email.trim().toLowerCase();
    if (!em) {
      setResult({ type: "error", message: "請先填寫電子信箱，再傳送認證碼。" });
      return;
    }
    setSendingOtp(true);
    try {
      const res = await sendRegistrationOtp(em);
      if (res.success) {
        setCooldown(OTP_COOLDOWN_SEC);
        setResult({
          type: "success",
          message: "已寄出驗證碼，請至信箱查看（若未收到請稍候或檢查垃圾郵件）。",
        });
      } else {
        setResult({ type: "error", message: res.error });
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    const em = email.trim().toLowerCase();
    const pw = password;
    const pw2 = passwordConfirm;
    const code = otp.trim();
    if (!em) {
      setResult({ type: "error", message: "請填寫電子信箱。" });
      return;
    }
    if (pw.length < 6) {
      setResult({ type: "error", message: "密碼請至少 6 個字元。" });
      return;
    }
    if (pw !== pw2) {
      setResult({ type: "error", message: "兩次輸入的密碼不一致。" });
      return;
    }
    if (!code) {
      setResult({ type: "error", message: "請填寫信箱驗證碼。" });
      return;
    }
    setLoading(true);
    try {
      const { error: otpErr } = await supabase.auth.verifyOtp({
        email: em,
        token: code,
        type: "email",
      });
      if (otpErr) {
        setResult({ type: "error", message: mapSupabaseAuthErrorToZh(otpErr.message) });
        return;
      }

      const { error: pwErr } = await supabase.auth.updateUser({ password: pw });
      if (pwErr) {
        setResult({ type: "error", message: mapSupabaseAuthErrorToZh(pwErr.message) });
        return;
      }

      const res = await registerMember({ name, phone });
      if (res.success) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("member_registered", "1");
        }
        setResult({
          type: "success",
          message: "🎉 註冊成功！已為您登入，也可直接前往下一步。",
        });
        setName("");
        setPhone("");
        setOtp("");
        setPassword("");
        setPasswordConfirm("");
      } else {
        setResult({ type: "error", message: res.error });
      }
    } catch (err) {
      setResult({
        type: "error",
        message: mapSupabaseAuthErrorToZh(err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setLoading(false);
    }
  }, [email, password, passwordConfirm, otp, name, phone, supabase]);

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
            <h1 className="text-2xl font-bold text-gray-900">加入會員</h1>
            <p className="mt-2 text-gray-600 text-sm">
              請使用電子信箱註冊：先傳送認證碼，再完成驗證與密碼設定
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
                <p>{result.message}</p>
                {result.type === "success" && (
                  <Link
                    href={safeNext}
                    className="mt-2 inline-block font-medium underline hover:no-underline"
                  >
                    前往下一步 →
                  </Link>
                )}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                電子信箱（帳號） <span className="text-amber-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                密碼 <span className="text-amber-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 個字元"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 mb-1">
                確認密碼 <span className="text-amber-500">*</span>
              </label>
              <input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                required
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="請再次輸入密碼"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                信箱驗證碼 <span className="text-amber-500">*</span>
              </label>
              <div className="flex gap-2 items-stretch">
                <input
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\s/g, ""))}
                  placeholder="請輸入信中的驗證碼"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || sendingOtp || cooldown > 0}
                  className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {sendingOtp ? "傳送中…" : cooldown > 0 ? `${cooldown} 秒後可重送` : "傳送認證碼"}
                </button>
              </div>
            </div>

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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-medium bg-amber-500 text-white hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "處理中..." : "註冊"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            已有帳號？{" "}
            <Link
              href={`/login?next=${encodeURIComponent(safeNext)}`}
              className="font-medium text-amber-800 hover:underline"
            >
              前往登入
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-gray-500">
            送出即表示同意本站會員條款與個資使用說明
          </p>
        </div>
      </main>
    </div>
  );
}
