"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { X, Eye, EyeOff, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { syncAuthUserToMembers } from "@/app/actions/memberActions";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** 從網址 ?openLogin=email 進來時傳 2，直接顯示 E-mail 登入表單 */
  initialStep?: 1 | 2 | 3;
  /** 登入／註冊成功後呼叫（例如結帳頁用來觸發完成報名） */
  onSuccess?: () => void;
  /** OAuth 導向時帶上的 next，回站時導回此網址 */
  returnTo?: string;
  /** 使用 Google 登入、即將導出前呼叫（例如結帳頁寫入暫存） */
  onBeforeGoogleRedirect?: () => void;
};

type Step = 1 | 2 | 3;

export default function LoginModal({
  isOpen,
  onClose,
  initialStep,
  onSuccess,
  returnTo,
  onBeforeGoogleRedirect,
}: LoginModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(initialStep ?? 1);
      setFormError(null);
    }
  }, [isOpen, initialStep]);

  const handleGoogleLogin = useCallback(async () => {
    setFormError(null);
    setOauthLoading(true);
    try {
      onBeforeGoogleRedirect?.();
      const origin = typeof location !== "undefined" ? location.origin : "";
      if (returnTo && typeof document !== "undefined") {
        document.cookie = `auth_return_to=${encodeURIComponent(returnTo)}; path=/; max-age=600; SameSite=Lax`;
      }
      const supabase = createClient();
      const redirectTo = `${origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setFormError(error.message);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "登入失敗");
    } finally {
      setOauthLoading(false);
    }
  }, [returnTo, onBeforeGoogleRedirect]);

  const handleLoginSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const form = e.currentTarget;
    const email = (form.querySelector<HTMLInputElement>('[name="email"]')?.value ?? "").trim();
    const password = form.querySelector<HTMLInputElement>('[name="password"]')?.value ?? "";
    if (!email || !password) {
      setFormError("請輸入電子郵件與密碼");
      return;
    }
    setLoginLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setFormError(error.message);
        return;
      }
      await syncAuthUserToMembers();
      onSuccess?.();
      onClose();
    } finally {
      setLoginLoading(false);
    }
  }, [onClose, onSuccess]);

  const handleRegisterSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const form = e.currentTarget;
    const email = (form.querySelector<HTMLInputElement>('[name="email"]')?.value ?? "").trim();
    const password = form.querySelector<HTMLInputElement>('[name="password"]')?.value ?? "";
    const confirm = form.querySelector<HTMLInputElement>('[name="confirmPassword"]')?.value ?? "";
    if (!email || !password) {
      setFormError("請填寫電子郵件與密碼");
      return;
    }
    if (password !== confirm) {
      setFormError("兩次密碼輸入不一致");
      return;
    }
    if (password.length < 6) {
      setFormError("密碼至少 6 碼");
      return;
    }
    setRegisterLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setFormError(error.message);
        return;
      }
      await syncAuthUserToMembers();
      // Supabase 若已關閉「確認信箱」，signUp 會直接回傳 session，視為註冊完成
      if (data.session) {
        onSuccess?.();
        onClose();
        return;
      }
      setFormError(null);
      setStep(2);
      setFormError("請至信箱收取驗證信完成註冊");
    } finally {
      setRegisterLoading(false);
    }
  }, [onClose, onSuccess]);

  const { siteName } = useStoreSettings();
  function ModalHeader({ title }: { title?: string }) {
    return (
      <div className="text-center pt-6 pb-2">
        <p className="text-xl font-bold text-brand">{siteName}</p>
        <p className="text-xs text-gray-500 mt-0.5">全台親子體驗第一預訂平台</p>
        {title && <h2 className="text-lg font-bold text-gray-900 mt-4">{title}</h2>}
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="relative w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 z-10"
          aria-label="關閉"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 圖1：選擇 Google 或 E-mail（無跳轉，全在彈窗內完成） */}
        {step === 1 && (
          <>
            <div className="px-6 pt-6 pb-2">
              <ModalHeader />
            </div>
            <div className="px-6 pb-6 space-y-4">
              {formError && (
                <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-100" role="alert">
                  {formError}
                </div>
              )}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={oauthLoading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-gray-200 bg-white text-gray-800 font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors"
              >
                <GoogleIcon className="w-5 h-5 shrink-0" />
                {oauthLoading ? "處理中…" : "使用 Google 登入"}
              </button>
              <button
                type="button"
                onClick={() => { setFormError(null); setStep(2); }}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-gray-200 bg-white text-gray-800 font-medium hover:bg-gray-50 transition-colors"
              >
                <Mail className="w-5 h-5 shrink-0 text-gray-500" />
                使用 E-mail 登入或註冊
              </button>
            </div>
            <div className="px-6 pb-6 text-center text-sm text-gray-500 space-y-1">
              <p>
                <Link href="/" className="text-amber-600 hover:underline">聯絡我們</Link>
              </p>
              <p>
                註冊或登入即表示您瞭解並同意
                <Link href="/" className="text-amber-600 hover:underline"> 服務條款 </Link>
                及
                <Link href="/" className="text-amber-600 hover:underline"> 隱私政策</Link>。
              </p>
            </div>
          </>
        )}

        {/* 圖2：登入（無驗證碼） */}
        {step === 2 && (
          <>
            <div className="px-6 pt-4">
              <ModalHeader title="登入" />
            </div>
            <div className="px-6 pb-6">
              {formError && (
                <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-100 mb-4" role="alert">
                  {formError}
                </div>
              )}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-gray-900 mb-1">帳號</label>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="請輸入電子郵件"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="login-password" className="block text-sm font-medium text-gray-900">密碼</label>
                    <button type="button" className="text-sm text-gray-500 hover:text-amber-600" onClick={() => setFormError("忘記密碼功能將由後端提供")}>
                      忘記密碼?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="請輸入密碼"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-2.5 rounded-lg font-medium text-gray-800 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-60 transition-colors"
                >
                  {loginLoading ? "登入中…" : "登入"}
                </button>
              </form>
              <p className="text-center text-sm text-gray-600 mt-4">
                是新朋友嗎?{" "}
                <button type="button" className="text-amber-600 font-medium hover:underline" onClick={() => { setFormError(null); setStep(3); }}>
                  建立新帳號
                </button>
              </p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  className="w-full text-center text-sm text-amber-600 hover:underline"
                  onClick={() => { setFormError(null); setStep(1); }}
                >
                  使用其他方式
                </button>
              </div>
            </div>
          </>
        )}

        {/* 圖3：註冊 */}
        {step === 3 && (
          <>
            <div className="px-6 pt-4">
              <ModalHeader title="註冊" />
            </div>
            <div className="px-6 pb-6">
              {formError && (
                <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-100 mb-4" role="alert">
                  {formError}
                </div>
              )}
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label htmlFor="reg-email" className="block text-sm font-medium text-gray-900 mb-1">帳號</label>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    placeholder="請輸入電子郵件"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label htmlFor="reg-password" className="block text-sm font-medium text-gray-900 mb-1">密碼</label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="請輸入密碼"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-confirm" className="block text-sm font-medium text-gray-900 mb-1">請確認密碼</label>
                  <div className="relative">
                    <input
                      id="reg-confirm"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="請確認密碼"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? "隱藏密碼" : "顯示密碼"}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">密碼強度</span>
                  <div className="flex gap-1">
                    <span className="w-8 h-1.5 rounded bg-gray-200" />
                    <span className="w-8 h-1.5 rounded bg-gray-200" />
                    <span className="w-8 h-1.5 rounded bg-gray-200" />
                  </div>
                  <span className="text-sm text-gray-500">無</span>
                </div>
                <button
                  type="submit"
                  disabled={registerLoading}
                  className="w-full py-2.5 rounded-lg font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-60 transition-colors"
                >
                  {registerLoading ? "註冊中…" : "註冊"}
                </button>
              </form>
              <p className="text-center text-sm text-gray-600 mt-4">
                已經是會員嗎?{" "}
                <button type="button" className="text-amber-600 font-medium hover:underline" onClick={() => { setFormError(null); setStep(2); }}>
                  登入
                </button>
              </p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  className="w-full text-center text-sm text-amber-600 hover:underline"
                  onClick={() => { setFormError(null); setStep(1); }}
                >
                  使用其他方式
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
