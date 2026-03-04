"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { getFrontendSettings, updateFrontendSettings } from "@/app/actions/frontendSettingsActions";
import type { CarouselItem } from "@/app/lib/frontendSettingsShared";

/** 會員圖示預設列表（client 端保證為陣列，避免從 server 匯入在 bundle 中非陣列） */
const FALLBACK_MEMBER_ICON_URLS: string[] = [
  "/member-icons/1.svg", "/member-icons/2.svg", "/member-icons/3.svg", "/member-icons/4.svg", "/member-icons/5.svg",
  "/member-icons/6.svg", "/member-icons/7.svg", "/member-icons/8.svg", "/member-icons/9.svg", "/member-icons/10.svg",
];

function toMemberIconArray(value: unknown): string[] {
  if (Array.isArray(value) && value.length > 0) {
    const filtered = value.filter((u): u is string => typeof u === "string");
    return filtered.length > 0 ? filtered : FALLBACK_MEMBER_ICON_URLS;
  }
  return FALLBACK_MEMBER_ICON_URLS;
}

export default function FrontendSettingsPage() {
  const router = useRouter();
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroTitle, setHeroTitle] = useState("");
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
  const [navCoursesLabel, setNavCoursesLabel] = useState("課程介紹");
  const [navBookingLabel, setNavBookingLabel] = useState("課程預約");
  const [navFaqLabel, setNavFaqLabel] = useState("常見問題");
  const [heroImageUrlInput, setHeroImageUrlInput] = useState("");
  const [memberIconGallery, setMemberIconGallery] = useState<string[]>(() => FALLBACK_MEMBER_ICON_URLS);
  const [memberIconSelectedIndex, setMemberIconSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getFrontendSettings()
      .then((s) => {
        setHeroImageUrl(s.heroImageUrl);
        setHeroImageUrlInput(s.heroImageUrl ?? "");
        setHeroTitle(s.heroTitle ?? "探索孩子的無限潛能");
        setCarouselItems(s.carouselItems.length > 0 ? s.carouselItems : [
          { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
          { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
          { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
        ]);
        setNavCoursesLabel(s.navCoursesLabel ?? "課程介紹");
        setNavBookingLabel(s.navBookingLabel ?? "課程預約");
        setNavFaqLabel(s.navFaqLabel ?? "常見問題");
        const gallery = toMemberIconArray(s.memberIconGallery);
        setMemberIconGallery(gallery);
        setMemberIconSelectedIndex(Math.min(s.memberIconSelectedIndex ?? 0, Math.max(0, gallery.length - 1)));
      })
      .catch((err) => {
        setMessage({ type: "error", text: err?.message ?? "無法載入前台設定" });
      })
      .finally(() => setLoading(false));
  }, []);

  const addCarouselItem = () => {
    setCarouselItems((prev) => [
      ...prev,
      { id: `w${Date.now()}`, title: "", subtitle: "", imageUrl: null, visible: true },
    ]);
  };

  const removeCarouselItem = (index: number) => {
    setCarouselItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCarouselItem = (index: number, field: keyof CarouselItem, value: string | null | boolean) => {
    setCarouselItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === "visible") return { ...item, visible: value !== false && value !== "false" && value !== "0" };
        return { ...item, [field]: value ?? "" };
      })
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("hero_title", heroTitle);
    formData.set("hero_image_url", heroImageUrlInput.trim());
    formData.set("carousel_length", String(carouselItems.length));
    carouselItems.forEach((item, i) => {
      formData.set(`carousel_${i}_title`, item.title);
      formData.set(`carousel_${i}_subtitle`, item.subtitle);
      formData.set(`carousel_${i}_image_url`, (item.imageUrl ?? "").trim());
      formData.set(`carousel_${i}_visible`, item.visible === false ? "0" : "1");
    });
    formData.set("nav_courses_label", navCoursesLabel);
    formData.set("nav_booking_label", navBookingLabel);
    formData.set("nav_faq_label", navFaqLabel);
    const galleryForSubmit = toMemberIconArray(memberIconGallery);
    formData.set("member_icon_gallery_json", JSON.stringify(galleryForSubmit));
    formData.set("member_icon_selected_index", String(memberIconSelectedIndex));
    startTransition(async () => {
      const result = await updateFrontendSettings(formData);
      if (result.success) {
        setMessage({ type: "success", text: result.message ?? "已儲存" });
        router.refresh();
        getFrontendSettings().then((s) => {
          setHeroImageUrlInput(s.heroImageUrl ?? "");
          const gallery = toMemberIconArray(s.memberIconGallery);
          setMemberIconGallery(gallery);
          setMemberIconSelectedIndex(Math.min(s.memberIconSelectedIndex ?? 0, Math.max(0, gallery.length - 1)));
        });
      } else {
        setMessage({ type: "error", text: result.error });
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
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          返回後台
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900">前台設定</h1>
      <p className="text-sm text-gray-600">
        設定首頁上方大圖與輪播圖，修改圖片後儲存即可套用至前台。
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
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

        {/* 大圖 */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">大圖（主橫幅）</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">主圖</label>
            {(heroImageUrlInput || heroImageUrl) && (
              <div className="mb-3 w-full max-w-3xl aspect-video rounded-lg bg-gray-100 overflow-hidden border border-gray-200">
                <img src={heroImageUrlInput || heroImageUrl || ""} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
            <p className="mb-2 text-xs text-amber-700">建議大小：1920×1080（16:9）</p>
            <input
              type="url"
              name="hero_image_url"
              value={heroImageUrlInput}
              onChange={(e) => setHeroImageUrlInput(e.target.value)}
              placeholder="圖片網址"
              className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              disabled={isPending}
            />
            <div className="flex items-center gap-2">
              <input
                type="file"
                name="hero_image"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="block w-full max-w-xs text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-50 file:px-4 file:py-2 file:text-amber-800 file:font-medium hover:file:bg-amber-100"
                disabled={isPending}
              />
              <span className="text-xs text-gray-500">或上傳檔案（尚未選取檔案時可填網址）</span>
            </div>
          </div>
        </section>

        {/* 輪播圖 */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h2 className="text-base font-semibold text-gray-900">輪播圖</h2>
            <button
              type="button"
              onClick={addCarouselItem}
              className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              <Plus className="w-4 h-4" />
              新增一則
            </button>
          </div>
          <div className="space-y-8">
            {carouselItems.map((item, index) => (
              <div
                key={item.id}
                className="rounded-lg border border-gray-200 bg-gray-50/50 p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">輪播 {index + 1}</span>
                  {carouselItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCarouselItem(index)}
                      className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                      aria-label="刪除此則"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {/* 大圖預覽 */}
                {item.imageUrl && (
                  <div className="w-full max-w-3xl aspect-[12/5] rounded-lg bg-gray-200 overflow-hidden border border-gray-200">
                    <img src={item.imageUrl ?? ""} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
                {/* 縮圖列：本則 + 其他兩則 */}
                <div className="flex gap-2 flex-wrap">
                  {[index, (index + 1) % carouselItems.length, (index + 2) % carouselItems.length].map((idx) => {
                    const it = carouselItems[idx];
                    const url = it?.imageUrl;
                    const active = idx === index;
                    return (
                      <div
                        key={`${it?.id}-${idx}`}
                        className={`w-24 h-12 rounded overflow-hidden border-2 shrink-0 bg-gray-100 ${active ? "border-amber-500" : "border-gray-200"}`}
                      >
                        {url ? <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">無圖</div>}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-amber-700">建議大小：1200×500</p>
                {/* 狀態、URL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div>
                    <label className="mb-0.5 block text-xs font-medium text-gray-600">狀態</label>
                    <select
                      value={item.visible === false ? "0" : "1"}
                      onChange={(e) => updateCarouselItem(index, "visible", e.target.value === "1")}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      disabled={isPending}
                    >
                      <option value="1">顯示</option>
                      <option value="0">隱藏</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs font-medium text-gray-600">URL</label>
                    <input
                      type="url"
                      value={item.imageUrl ?? ""}
                      onChange={(e) => updateCarouselItem(index, "imageUrl", e.target.value || null)}
                      placeholder="圖片網址"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      disabled={isPending}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    name={`carousel_${index}_image`}
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="block w-full max-w-xs text-sm text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-amber-50 file:px-3 file:py-1.5 file:text-amber-800 file:text-xs"
                    disabled={isPending}
                  />
                  <span className="text-xs text-gray-500">或上傳檔案（尚未選取檔案時可填網址）</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 導覽列與會員圖示 */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">導覽列與會員圖示</h2>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">會員圖示（請從下方選一張）</p>
              <p className="mb-3 text-xs text-gray-500">以下 10 個圖示擇一顯示於前台右上角會員按鈕；建議顯示尺寸 48×48。</p>
              <div className="flex flex-wrap gap-3">
                {toMemberIconArray(memberIconGallery).map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setMemberIconSelectedIndex(i)}
                    className={`flex items-center justify-center w-14 h-14 rounded-full overflow-hidden border-2 transition-colors shrink-0 bg-gray-50 ${
                      memberIconSelectedIndex === i ? "border-amber-500 ring-2 ring-amber-200" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img src={url} alt="" className="w-10 h-10 object-contain" />
                  </button>
                ))}
              </div>
              {memberIconSelectedIndex >= 0 && memberIconSelectedIndex < toMemberIconArray(memberIconGallery).length && (
                <p className="mt-2 text-xs text-amber-700">已選第 {memberIconSelectedIndex + 1} 個圖示</p>
              )}
            </div>
            <div className="pt-4 border-t border-gray-100">
              <p className="mb-3 text-sm font-medium text-gray-700">導覽列文字（右上角連結）</p>
              <p className="mb-2 text-xs text-gray-500">「關於我們」請至 介紹項 → 關於我們 設定。</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-0.5 block text-xs font-medium text-gray-600">課程介紹</label>
              <input
                type="text"
                value={navCoursesLabel}
                onChange={(e) => setNavCoursesLabel(e.target.value)}
                placeholder="課程介紹"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-gray-600">課程預約</label>
              <input
                type="text"
                value={navBookingLabel}
                onChange={(e) => setNavBookingLabel(e.target.value)}
                placeholder="課程預約"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-gray-600">常見問題</label>
              <input
                type="text"
                value={navFaqLabel}
                onChange={(e) => setNavFaqLabel(e.target.value)}
                placeholder="常見問題"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                disabled={isPending}
              />
            </div>
          </div>
            </div>
          </div>
        </section>

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
    </div>
  );
}
