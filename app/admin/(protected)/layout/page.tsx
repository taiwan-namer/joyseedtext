"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronUp, ChevronDown, Loader2, Save, Plus, Image as ImageIcon, GripVertical } from "lucide-react";
import {
  getFrontendSettings,
  updateLayoutBlocks,
  uploadLayoutBlockBackground,
} from "@/app/actions/frontendSettingsActions";
import {
  LAYOUT_SECTION_IDS,
  LAYOUT_SECTION_LABELS,
  getDefaultLayoutBlocks,
  type LayoutBlock,
} from "@/app/lib/frontendSettingsShared";

/** 畫布最大寬度（與前台 max-w-7xl 一致，參考 joyseedisland 等站） */
const CANVAS_MAX_WIDTH_PX = 1280;

export default function AdminLayoutPage() {
  const [blocks, setBlocks] = useState<LayoutBlock[]>(getDefaultLayoutBlocks());
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    getFrontendSettings()
      .then((s) => {
        setBlocks(
          s.layoutBlocks && s.layoutBlocks.length > 0 ? s.layoutBlocks : getDefaultLayoutBlocks()
        );
      })
      .catch(() => setBlocks(getDefaultLayoutBlocks()))
      .finally(() => setLoading(false));
  }, []);

  const currentIds = blocks.map((b) => b.id);
  const availableToAdd = LAYOUT_SECTION_IDS.filter((id) => !currentIds.includes(id));

  const addBlock = (sectionId: string) => {
    const nextOrder = blocks.length;
    setBlocks([...blocks, { id: sectionId, order: nextOrder, heightPx: null, backgroundImageUrl: null }]);
    setMessage(null);
  };

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return;
    const next = blocks.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i }));
    setBlocks(next);
    setMessage(null);
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...blocks];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setBlocks(next.map((b, i) => ({ ...b, order: i })));
    setMessage(null);
  };

  const moveDown = (index: number) => {
    if (index >= blocks.length - 1) return;
    const next = [...blocks];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setBlocks(next.map((b, i) => ({ ...b, order: i })));
    setMessage(null);
  };

  const setBlockHeight = (index: number, heightPx: number | null) => {
    const next = [...blocks];
    next[index] = { ...next[index], heightPx: heightPx && heightPx > 0 ? heightPx : null };
    setBlocks(next);
  };

  const setBlockBackgroundUrl = (index: number, url: string | null) => {
    const next = [...blocks];
    next[index] = { ...next[index], backgroundImageUrl: url };
    setBlocks(next);
  };

  const handleBackgroundUpload = async (blockId: string, index: number, file: File) => {
    setUploadingBlockId(blockId);
    setMessage(null);
    const formData = new FormData();
    formData.set("background_image", file);
    try {
      const result = await uploadLayoutBlockBackground(formData);
      if (result.success) {
        setBlockBackgroundUrl(index, result.url);
        setMessage({ type: "success", text: "背景圖已上傳至 R2，請按「儲存版面」寫入資料庫" });
      } else {
        setMessage({ type: "error", text: result.error });
      }
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "上傳失敗" });
    } finally {
      setUploadingBlockId(null);
    }
  };

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateLayoutBlocks(blocks);
      if (result.success) {
        setMessage({ type: "success", text: result.message ?? "已儲存" });
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
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
    <div className="space-y-4">
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
        左側：可加入的積木、目前的積木。右側：畫布（與前台一致寬度 {CANVAS_MAX_WIDTH_PX}px），可調區塊高度、上傳背景圖。儲存後套用到前台，手機版會依同一設定響應。
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

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 左側：可加入的積木 + 目前的積木（直列） */}
        <aside className="lg:w-56 shrink-0 space-y-6">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">可加入的積木</h2>
            <ul className="space-y-1.5">
              {availableToAdd.length === 0 ? (
                <li className="text-xs text-gray-500">已全部加入</li>
              ) : (
                availableToAdd.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => addBlock(id)}
                      className="w-full flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 hover:bg-amber-50 hover:border-amber-200 transition-colors"
                    >
                      <Plus className="h-4 w-4 shrink-0 text-amber-600" />
                      {LAYOUT_SECTION_LABELS[id] ?? id}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">目前的積木</h2>
            <p className="text-xs text-gray-500 mb-2">順序與右側畫布一致</p>
            <ul className="space-y-1">
              {blocks.map((b, i) => (
                <li key={`${b.id}-${i}`} className="flex items-center gap-2 text-sm text-gray-700">
                  <GripVertical className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>{LAYOUT_SECTION_LABELS[b.id] ?? b.id}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* 右側：畫布（與前台一致寬度，區塊可調高度與背景圖） */}
        <div className="flex-1 min-w-0 flex flex-col items-center">
          <div
            className="w-full rounded-xl border border-gray-200 bg-gray-100 overflow-hidden"
            style={{ maxWidth: CANVAS_MAX_WIDTH_PX }}
          >
            <div className="px-3 py-2 bg-gray-200 border-b border-gray-300 text-xs text-gray-600 text-center">
              畫布寬度 {CANVAS_MAX_WIDTH_PX}px（與前台一致）· 手機版會自動縮放
            </div>
            <div className="p-4 space-y-4">
              {blocks.map((block, index) => (
                <div
                  key={`${block.id}-${index}`}
                  className="rounded-lg border-2 border-dashed border-gray-400 bg-white/95 overflow-hidden"
                  style={{
                    minHeight: block.heightPx ?? 80,
                    backgroundImage: block.backgroundImageUrl ? `url(${block.backgroundImageUrl})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white/90 border-b border-gray-200">
                    <span className="font-medium text-gray-800">
                      {LAYOUT_SECTION_LABELS[block.id] ?? block.id}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600">
                        高度(px):
                        <input
                          type="number"
                          min={0}
                          step={10}
                          value={block.heightPx ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            setBlockHeight(index, v === "" ? null : parseInt(v, 10));
                          }}
                          placeholder="自動"
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                        />
                      </label>
                      <span className="relative">
                        <input
                          ref={(el) => {
                            fileInputRefs.current[`${block.id}-${index}`] = el;
                          }}
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleBackgroundUpload(block.id, index, file);
                            e.target.value = "";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[`${block.id}-${index}`]?.click()}
                          disabled={uploadingBlockId === block.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {uploadingBlockId === block.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ImageIcon className="h-3.5 w-3.5" />
                          )}
                          {block.backgroundImageUrl ? "更換背景" : "上傳背景"}
                        </button>
                      </span>
                      <button
                        type="button"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        aria-label="上移"
                        className="p-1.5 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(index)}
                        disabled={index === blocks.length - 1}
                        aria-label="下移"
                        className="p-1.5 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBlock(index)}
                        disabled={blocks.length <= 1}
                        aria-label="移除"
                        className="p-1.5 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 text-xs"
                      >
                        移除
                        </button>
                    </div>
                  </div>
                  {block.backgroundImageUrl && (
                    <div className="h-24 flex items-center justify-center text-xs text-gray-500">
                      背景圖已設定 · 儲存後套用前台
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isPending ? "儲存中…" : "儲存版面"}
            </button>
            <span className="text-sm text-gray-500">儲存後前台首頁將依此版面、高度與背景圖顯示</span>
          </div>
        </div>
      </div>
    </div>
  );
}
