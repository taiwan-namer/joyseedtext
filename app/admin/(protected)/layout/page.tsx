"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronUp, ChevronDown, Loader2, Save, EyeOff, Eye } from "lucide-react";
import { getFrontendSettings, updateLayoutOrder, updateFullWidthImageUrl } from "@/app/actions/frontendSettingsActions";
import { LAYOUT_SECTION_IDS, LAYOUT_SECTION_LABELS, DEFAULT_LAYOUT_ORDER } from "@/app/lib/frontendSettingsShared";

/** 畫布寬度與網頁 max-w-7xl 一致（1280px） */
const CANVAS_WIDTH_PX = 1280;

export default function AdminLayoutPage() {
  const router = useRouter();
  const [order, setOrder] = useState<string[]>(DEFAULT_LAYOUT_ORDER);
  const [fullWidthImageUrl, setFullWidthImageUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [saveImagePending, setSaveImagePending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getFrontendSettings()
      .then((s) => {
        setOrder(Array.isArray(s.layoutOrder) && s.layoutOrder.length > 0 ? s.layoutOrder : DEFAULT_LAYOUT_ORDER);
        setFullWidthImageUrl(s.fullWidthImageUrl ?? "");
      })
      .catch(() => setOrder(DEFAULT_LAYOUT_ORDER))
      .finally(() => setLoading(false));
  }, []);

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...order];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setOrder(next);
    setMessage(null);
  };

  const moveDown = (index: number) => {
    if (index >= order.length - 1) return;
    const next = [...order];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setOrder(next);
    setMessage(null);
  };

  /** 隱藏區塊：從版面順序中移除（至少保留一個） */
  const hideSection = (index: number) => {
    if (order.length <= 1) return;
    setOrder(order.filter((_, i) => i !== index));
    setMessage(null);
  };

  /** 顯示區塊：將已隱藏的區塊加回版面末端 */
  const showSection = (sectionId: string) => {
    setOrder([...order, sectionId]);
    setMessage(null);
  };

  const hiddenIds = LAYOUT_SECTION_IDS.filter((id) => !order.includes(id));

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateLayoutOrder(order);
      if (result.success) {
        setMessage({ type: "success", text: result.message ?? "已儲存" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  };

  const showFullWidthImageInput = order.includes("full_width_image");

  const handleSaveFullWidthImage = () => {
    setMessage(null);
    setSaveImagePending(true);
    updateFullWidthImageUrl(fullWidthImageUrl.trim() || null)
      .then((result) => {
        if (result.success) {
          setMessage({ type: "success", text: result.message ?? "單張大圖網址已儲存" });
          router.refresh();
        } else {
          setMessage({ type: "error", text: result.error });
        }
      })
      .finally(() => setSaveImagePending(false));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        載入中…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          返回後台
        </Link>
      </div>

      <h1 className="text-xl font-bold text-gray-900">首頁版面</h1>
      <p className="text-sm text-gray-600 max-w-2xl">
        下方畫布為首頁區塊順序預覽，寬度與前台網頁一致（{CANVAS_WIDTH_PX}px）。每個虛線框代表一個積木，調整順序後按「儲存」即會套用到前台首頁。
      </p>

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

      {/* 畫布：寬度 1280px、高度不限制可捲動 */}
      <div className="flex flex-col items-center w-full overflow-x-auto">
        <div
          className="bg-gray-100 rounded-xl border border-gray-200 overflow-hidden flex flex-col items-center min-h-[480px]"
          style={{ width: CANVAS_WIDTH_PX, maxWidth: "100%" }}
        >
          <div className="w-full px-3 py-2 bg-gray-200 border-b border-gray-300 text-xs text-gray-600 text-center">
            畫布寬度 {CANVAS_WIDTH_PX}px（與網頁一致） · 長度不限制
          </div>
          <div className="w-full flex-1 overflow-y-auto p-4 space-y-4">
            {order.map((sectionId, index) => (
              <div
                key={sectionId}
                className="flex items-stretch gap-2 w-full"
                data-section-id={sectionId}
              >
                {/* 虛線框對應每個積木 */}
                <div
                  className="flex-1 min-h-[72px] rounded-lg border-2 border-dashed border-gray-400 bg-white/90 flex items-center justify-between px-4 py-3"
                  style={{ borderStyle: "dashed" }}
                >
                  <span className="font-medium text-gray-800">
                    {LAYOUT_SECTION_LABELS[sectionId] ?? sectionId}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      aria-label="上移"
                      className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={index === order.length - 1}
                      aria-label="下移"
                      className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => hideSection(index)}
                      disabled={order.length <= 1}
                      aria-label="隱藏此區塊"
                      title="隱藏後前台將不顯示此區塊，可於下方「已隱藏的區塊」再次顯示"
                      className="p-2 rounded-lg border border-gray-300 bg-white text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <EyeOff className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 單張大圖網址（僅在版面含「單張大圖」時顯示） */}
      {showFullWidthImageInput && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">單張大圖網址</h2>
          <p className="text-xs text-gray-500 mb-3">此區塊會顯示一張全寬大圖，請輸入圖片網址（需為可公開存取的 URL）。</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="url"
              value={fullWidthImageUrl}
              onChange={(e) => setFullWidthImageUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              type="button"
              onClick={handleSaveFullWidthImage}
              disabled={saveImagePending}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
            >
              {saveImagePending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saveImagePending ? "儲存中…" : "儲存網址"}
            </button>
          </div>
        </div>
      )}

      {/* 已隱藏的區塊：可再次加入版面（加入至末端） */}
      {hiddenIds.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-gray-500" />
            已隱藏的區塊
          </h2>
          <p className="text-xs text-gray-500 mb-3">點「顯示」可將區塊加回首頁末端，再按「儲存版面」套用。</p>
          <div className="flex flex-wrap gap-2">
            {hiddenIds.map((sectionId) => (
              <div
                key={sectionId}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
              >
                <span className="text-sm text-gray-600">
                  {LAYOUT_SECTION_LABELS[sectionId] ?? sectionId}
                </span>
                <button
                  type="button"
                  onClick={() => showSection(sectionId)}
                  aria-label={`顯示${LAYOUT_SECTION_LABELS[sectionId] ?? sectionId}`}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  顯示
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isPending ? "儲存中…" : "儲存版面"}
        </button>
        <span className="text-sm text-gray-500">儲存後前台首頁將依此順序顯示區塊，已隱藏者不會出現</span>
      </div>
    </div>
  );
}
