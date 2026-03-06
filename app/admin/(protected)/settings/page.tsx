"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getStoreSettings, updateStoreSettings } from "@/app/actions/storeSettingsActions";
import { updateAdminPassword } from "@/app/actions/adminAuthActions";
import { Loader2, Check } from "lucide-react";

/** 淺色柔和背景色圖庫（供用戶選擇，篩選以不刺眼為主） */
const SOFT_BACKGROUND_PALETTE = [
  "#fafaf9",
  "#f5f5f4",
  "#fafaf8",
  "#f7f5f3",
  "#f5f0eb",
  "#fefce8",
  "#fef9c3",
  "#ecfccb",
  "#d1fae5",
  "#dbeafe",
  "#e0e7ff",
  "#fce7f3",
  "#f3e8ff",
  "#fef2f2",
  "#fff7ed",
  "#fffbeb",
  "#f0fdf4",
  "#f0f9ff",
  "#faf5ff",
  "#f8fafc",
] as const;

export default function AdminSettingsPage() {
  const router = useRouter();
  const [siteName, setSiteName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#F59E0B");
  const [backgroundColor, setBackgroundColor] = useState("#fafaf9");
  const [socialFbUrl, setSocialFbUrl] = useState("");
  const [socialIgUrl, setSocialIgUrl] = useState("");
  const [socialLineUrl, setSocialLineUrl] = useState("");
  const [socialFbOn, setSocialFbOn] = useState(false);
  const [socialIgOn, setSocialIgOn] = useState(false);
  const [socialLineOn, setSocialLineOn] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);

  useEffect(() => {
    getStoreSettings().then((s) => {
      setSiteName(s.siteName);
      setPrimaryColor(s.primaryColor);
      setBackgroundColor(s.backgroundColor ?? "#fafaf9");
      const fb = (s.socialFbUrl ?? "").trim();
      const ig = (s.socialIgUrl ?? "").trim();
      const line = (s.socialLineUrl ?? "").trim();
      setSocialFbUrl(fb);
      setSocialIgUrl(ig);
      setSocialLineUrl(line);
      setSocialFbOn(!!fb);
      setSocialIgOn(!!ig);
      setSocialLineOn(!!line);
      setContactEmail(s.contactEmail ?? "");
      setContactPhone(s.contactPhone ?? "");
      setContactAddress(s.contactAddress ?? "");
      setLoading(false);
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateStoreSettings(
        siteName,
        primaryColor,
        backgroundColor,
        socialFbOn ? socialFbUrl : "",
        socialIgOn ? socialIgUrl : "",
        socialLineOn ? socialLineUrl : "",
        contactEmail,
        contactPhone,
        contactAddress
      );
      if (result.success) {
        setMessage({ type: "success", text: result.message ?? "已儲存" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    setPasswordPending(true);
    updateAdminPassword(currentPassword, newPassword, confirmPassword).then((result) => {
      setPasswordPending(false);
      if (result.success) {
        setPasswordMessage({ type: "success", text: result.message ?? "密碼已更新" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMessage({ type: "error", text: result.error });
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        載入中…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900">基本資料</h1>
      <p className="text-sm text-gray-600">
        設定網站名稱、主色系與背景色，前台會依此顯示。下方示範區可先預覽再儲存，無須反覆至前台查看。
      </p>

      {/* 示範區：主色系與背景色即時預覽（未儲存前可見） */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-gray-700">示範區（儲存前可預覽）</p>
        <div
          className="rounded-lg border border-gray-200 p-4 transition-colors"
          style={{ backgroundColor }}
        >
          <p className="mb-2 text-xs text-gray-500">頁面底色</p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block rounded-lg px-3 py-1.5 text-sm font-medium text-white"
              style={{ backgroundColor: primaryColor }}
            >
              主色按鈕
            </span>
            <span className="text-sm text-gray-700" style={{ color: primaryColor }}>
              主色連結 · {siteName || "網站名稱"}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500">滿意後再按「儲存」即可套用至前台。</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {message && (
          <div
            role="alert"
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">網站名字</label>
          <input
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="例：童趣島、wonder"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            disabled={isPending}
          />
          <p className="mt-1 text-xs text-gray-500">修改後，全站顯示的網站名稱會一併更新（例如目前為「童趣島」可改為「wonder」）。</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">網站主色系</label>
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-gray-300 p-0.5 bg-white"
              disabled={isPending}
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-28 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900"
              placeholder="#F59E0B"
              disabled={isPending}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">主色用於按鈕、連結等，與背景色不同。示範區可即時預覽。</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">頁面背景色</label>
          <p className="mb-2 text-xs text-gray-500">以淺色柔和為主，選擇後可於本區塊與上方示範區預覽，再儲存。</p>
          {/* 本區塊內底色示意 */}
          <div className="mb-4 rounded-lg border border-gray-200 overflow-hidden">
            <p className="px-3 py-1.5 text-xs text-gray-500 bg-gray-50 border-b border-gray-100">目前底色示意</p>
            <div
              className="h-14 w-full transition-colors"
              style={{ backgroundColor }}
            />
          </div>
          {/* 自訂顏色（與主色系相同操作） */}
          <p className="mb-2 text-xs text-gray-600 font-medium">自訂顏色</p>
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-gray-300 p-0.5 bg-white"
              disabled={isPending}
            />
            <input
              type="text"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="w-28 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900"
              placeholder="#fafaf9"
              disabled={isPending}
            />
          </div>
          {/* 色票圖庫（淺色柔和） */}
          <p className="mt-4 mb-2 text-xs text-gray-600 font-medium">色票（淺色柔和）</p>
          <div className="flex flex-wrap gap-2">
            {SOFT_BACKGROUND_PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setBackgroundColor(hex)}
                className={`h-8 w-8 rounded-lg border-2 shadow-sm transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 ${
                  backgroundColor.toLowerCase() === hex.toLowerCase()
                    ? "border-amber-500 ring-2 ring-amber-500/30"
                    : "border-gray-300"
                }`}
                style={{ backgroundColor: hex }}
                title={hex}
              >
                {backgroundColor.toLowerCase() === hex.toLowerCase() ? (
                  <Check className="mx-auto h-4 w-4 text-gray-600" strokeWidth={2.5} />
                ) : null}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">點選色票或使用自訂色塊／色碼，可於上方「目前底色示意」即時預覽。</p>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">聯絡資訊</h2>
          <p className="text-xs text-gray-500 mb-4">顯示於首頁聯絡方式區塊與頁尾；填寫地址後，首頁會自動依地址顯示 Google 地圖。</p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">信箱</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="service@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">電話</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="02-1234-5678"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">地址</label>
              <input
                type="text"
                value={contactAddress}
                onChange={(e) => setContactAddress(e.target.value)}
                placeholder="例：新竹縣竹北市嘉豐南路二段67號"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                disabled={isPending}
              />
              <p className="mt-1 text-xs text-gray-500">填寫後首頁聯絡方式右側會自動顯示該地址的 Google 地圖。</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">社群連結</h2>
          <p className="text-xs text-gray-500 mb-4">開啟後貼上網址，首頁下方會顯示對應圖示；關閉則不顯示。</p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={socialFbOn}
                onClick={() => setSocialFbOn((v) => !v)}
                className={`mt-0.5 flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                  socialFbOn ? "border-amber-500 bg-amber-500" : "border-gray-300 bg-gray-200"
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    socialFbOn ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">Facebook</label>
                {socialFbOn ? (
                  <input
                    type="url"
                    value={socialFbUrl}
                    onChange={(e) => setSocialFbUrl(e.target.value)}
                    placeholder="https://www.facebook.com/..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    disabled={isPending}
                  />
                ) : (
                  <p className="text-xs text-gray-500">關閉時首頁不顯示 Facebook 圖示</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={socialIgOn}
                onClick={() => setSocialIgOn((v) => !v)}
                className={`mt-0.5 flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                  socialIgOn ? "border-amber-500 bg-amber-500" : "border-gray-300 bg-gray-200"
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    socialIgOn ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">Instagram</label>
                {socialIgOn ? (
                  <input
                    type="url"
                    value={socialIgUrl}
                    onChange={(e) => setSocialIgUrl(e.target.value)}
                    placeholder="https://www.instagram.com/..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    disabled={isPending}
                  />
                ) : (
                  <p className="text-xs text-gray-500">關閉時首頁不顯示 Instagram 圖示</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={socialLineOn}
                onClick={() => setSocialLineOn((v) => !v)}
                className={`mt-0.5 flex h-6 w-11 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ${
                  socialLineOn ? "border-amber-500 bg-amber-500" : "border-gray-300 bg-gray-200"
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    socialLineOn ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">LINE</label>
                {socialLineOn ? (
                  <input
                    type="url"
                    value={socialLineUrl}
                    onChange={(e) => setSocialLineUrl(e.target.value)}
                    placeholder="https://line.me/... 或 加 LINE 連結"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    disabled={isPending}
                  />
                ) : (
                  <p className="text-xs text-gray-500">關閉時首頁不顯示 LINE 圖示</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isPending ? "儲存中…" : "儲存"}
          </button>
        </div>
      </form>

      <form onSubmit={handlePasswordSubmit} className="mt-8 space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">後台登入密碼</h2>
          <p className="mt-1 text-sm text-gray-600">
            設定後，可使用此密碼登入後台，僅供您本人使用，請勿外洩。
          </p>
        </div>
        {passwordMessage && (
          <div
            role="alert"
            className={`rounded-lg border px-4 py-3 text-sm ${
              passwordMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {passwordMessage.text}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">目前密碼</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="請輸入現有後台密碼或萬能鑰匙"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            disabled={passwordPending}
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">新密碼</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="至少 4 個字元"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            disabled={passwordPending}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">確認新密碼</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="再輸入一次新密碼"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            disabled={passwordPending}
            autoComplete="new-password"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={passwordPending || !newPassword || !confirmPassword}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-5 py-2.5 font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {passwordPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {passwordPending ? "更新中…" : "更新後台密碼"}
          </button>
        </div>
      </form>
    </div>
  );
}
