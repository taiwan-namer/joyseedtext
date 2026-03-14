"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { getSeoSettings, updateSeoSettings } from "@/app/actions/frontendSettingsActions";

export default function SeoPage() {
  const router = useRouter();
  const [seoTitle, setSeoTitle] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoFaviconUrl, setSeoFaviconUrl] = useState("");
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getSeoSettings()
      .then((data) => {
        setSeoTitle(data.seoTitle ?? "");
        setSeoKeywords(data.seoKeywords ?? "");
        setSeoDescription(data.seoDescription ?? "");
        setSeoFaviconUrl(data.seoFaviconUrl ?? "");
      })
      .catch((err) => {
        setMessage({ type: "error", text: err?.message ?? "無法載入" });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleFaviconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setFaviconPreview(URL.createObjectURL(file));
    } else {
      setFaviconPreview(null);
    }
  };

  const displayFaviconUrl = faviconPreview || seoFaviconUrl || null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData(e.currentTarget);
    formData.set("seo_title", seoTitle);
    formData.set("seo_keywords", seoKeywords);
    formData.set("seo_description", seoDescription);
    formData.set("seo_favicon_url", seoFaviconUrl);
    startTransition(async () => {
      const result = await updateSeoSettings(formData);
      if (result.success) {
        setMessage({ type: "success", text: result.message ?? "已儲存" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  };

  const titleLen = seoTitle.length;
  const keywordsCount = seoKeywords ? seoKeywords.split(",").filter((s) => s.trim()).length : 0;
  const descLen = seoDescription.length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        載入中…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          返回後台
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900 bg-slate-800 text-white px-4 py-2 rounded">SEO設定</h1>
      <p className="text-sm text-gray-600">
        設定網頁標題（分頁名稱）、關鍵字與描述，將顯示於搜尋結果與瀏覽器分頁，有助於搜尋引擎優化。
      </p>

      {/* 預覽區：長條型、與瀏覽器分頁相同 UI（左圖示 + 右標題） */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500">分頁預覽（與瀏覽器分頁相同呈現）</p>
        <div className="rounded-lg bg-gray-700 shadow-inner flex items-center gap-2 px-3 py-2.5 min-h-[40px]">
          <div className="w-7 h-7 rounded flex-shrink-0 overflow-hidden bg-gray-600 flex items-center justify-center">
            {displayFaviconUrl ? (
              <img src={displayFaviconUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-white text-sm font-semibold">V</span>
            )}
          </div>
          <p className="text-white text-sm truncate flex-1 min-w-0" title={seoTitle || "未設定"}>
            {seoTitle || "請在下方填寫網頁標題（分頁名稱）"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              分頁圖示（Favicon）
            </label>
            <p className="text-xs text-gray-500 mb-2">上傳圖片可取代分頁左側的「V」圖示，建議使用正方形圖片（如 32×32 或 64×64）。</p>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="seo_favicon" className="inline-block rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                  選擇圖片
                </label>
                <input
                  id="seo_favicon"
                  name="seo_favicon"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFaviconFileChange}
                  disabled={isPending}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="seo_favicon_url" className="mb-0.5 block text-xs text-gray-500">或貼上圖示網址</label>
                <input
                  id="seo_favicon_url"
                  type="text"
                  value={seoFaviconUrl}
                  onChange={(e) => setSeoFaviconUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="seo_title" className="mb-1 block text-sm font-medium text-gray-700">
              分頁名稱（網頁標題）:
            </label>
            <input
              id="seo_title"
              type="text"
              name="seo_title"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="例：童趣島 WonderVoyage | 兒童才藝活動報名"
              maxLength={80}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              disabled={isPending}
            />
            <p className="mt-1 text-xs text-gray-600">此標題會顯示於瀏覽器分頁與搜尋結果，三十字以內最佳。</p>
            {titleLen > 0 && (
              <p className="mt-0.5 text-xs text-gray-500">{titleLen} 字</p>
            )}
          </div>

          <div>
            <label htmlFor="seo_keywords" className="mb-1 block text-sm font-medium text-gray-700">
              關鍵字:
            </label>
            <input
              id="seo_keywords"
              type="text"
              name="seo_keywords"
              value={seoKeywords}
              onChange={(e) => setSeoKeywords(e.target.value)}
              placeholder="例：冬令營,夏令營,小小職人,幼兒五感體驗,親子活動"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              disabled={isPending}
            />
            <p className="mt-1 text-xs text-red-600">* 請用,號區格，十組內最佳</p>
            {keywordsCount > 0 && (
              <p className="mt-0.5 text-xs text-gray-500">{keywordsCount} 組</p>
            )}
          </div>

          <div>
            <label htmlFor="seo_description" className="mb-1 block text-sm font-medium text-gray-700">
              網頁描述:
            </label>
            <textarea
              id="seo_description"
              name="seo_description"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="例：幫助孩子在玩樂中學習,家長也能輕鬆找優質課程,全台最豐富的親子活動就在童趣島!"
              rows={4}
              maxLength={300}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y"
              disabled={isPending}
            />
            <p className="mt-1 text-xs text-red-600">* 兩百字以內最佳</p>
            {descLen > 0 && (
              <p className="mt-0.5 text-xs text-gray-500">{descLen} 字</p>
            )}
          </div>
        </section>

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-2.5 font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isPending ? "儲存中…" : "儲存"}
          </button>
        </div>
      </form>
    </div>
  );
}
