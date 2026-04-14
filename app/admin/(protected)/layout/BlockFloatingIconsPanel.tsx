"use client";

import { useEffect, useRef, useState } from "react";
import type { HeroFloatingIcon, LayoutBlock } from "@/app/lib/frontendSettingsShared";
import { formatFloatingIconSlotLabel } from "@/app/lib/frontendSettingsShared";

/** 與總站畫布一致：裝飾圖上傳、列表寬高（畫布 px）、刪除 */
export default function BlockFloatingIconsPanel({
  block,
  heroFloatUploading,
  onUploadClick,
  editViewport,
  previewPxFromStored,
  storedPxFromPreview,
  onPatchIcon,
  onRemoveIcon,
  focusedIconId = null,
}: {
  block: LayoutBlock;
  heroFloatUploading: boolean;
  onUploadClick: () => void;
  editViewport: "desktop" | "mobile";
  previewPxFromStored: (n: number) => number;
  storedPxFromPreview: (n: number) => number;
  onPatchIcon: (iconId: string, patch: Partial<HeroFloatingIcon>) => void;
  onRemoveIcon: (iconId: string) => void;
  focusedIconId?: string | null;
}) {
  const [dimDrafts, setDimDrafts] = useState<Record<string, string>>({});
  const [dimFocus, setDimFocus] = useState<string | null>(null);
  const dimKey = (iconId: string, axis: "w" | "h") => `${iconId}:${axis}`;
  const iconRowRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    if (!focusedIconId) return;
    const el = iconRowRefs.current[focusedIconId];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedIconId]);

  return (
    <div className="rounded-lg border border-amber-200/80 bg-white/90 p-3 space-y-3">
      <p className="text-xs text-gray-600 leading-relaxed">
        {editViewport === "mobile"
          ? "目前編輯「手機專用」座標（leftPctMobile 等）；未填時前台手機仍沿用桌機座標。尺寸以手機畫布縮放換算；拖曳下方手機預覽內裝飾圖亦會寫入此欄。完成後請按「儲存版面」。"
          : "尺寸欄位以「目前桌機畫布縮放後」為準（例如 50% 畫布輸入 100px，會自動換算為前台 200px）。拖曳虛線框調位置，完成後請按「儲存版面」。"}
        下方列表與畫布虛線框左上角「編號 1、編號 2…」順序一致。
      </p>
      <div>
        <button
          type="button"
          onClick={onUploadClick}
          disabled={heroFloatUploading}
          className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          {heroFloatUploading ? "上傳中…" : "上傳裝飾圖"}
        </button>
      </div>
      {(block.floatingIcons?.length ?? 0) > 0 ? (
        <ul className="max-h-52 space-y-2 overflow-y-auto text-xs">
          {(block.floatingIcons ?? []).map((ic, idx) => {
            const wStored = editViewport === "mobile" ? (ic.widthPxMobile ?? ic.widthPx) : ic.widthPx;
            const hStored =
              editViewport === "mobile"
                ? (ic.heightPxMobile ?? ic.heightPx ?? ic.widthPx)
                : (ic.heightPx ?? ic.widthPx);
            return (
              <li
                key={ic.id}
                ref={(el) => {
                  iconRowRefs.current[ic.id] = el;
                }}
                className={`flex flex-wrap items-center gap-2 border-b border-gray-100 pb-2 last:border-0 rounded-md transition-colors ${
                  focusedIconId === ic.id ? "bg-amber-50 ring-2 ring-amber-400/80 -mx-1 px-1" : ""
                }`}
              >
                <span className="w-14 shrink-0 font-semibold text-amber-900 tabular-nums">
                  {formatFloatingIconSlotLabel(idx)}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ic.imageUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded bg-gray-50 object-contain"
                />
                <label className="flex items-center gap-1">
                  寬
                  <input
                    type="number"
                    step={1}
                    value={
                      dimFocus === dimKey(ic.id, "w")
                        ? (dimDrafts[dimKey(ic.id, "w")] ?? String(previewPxFromStored(wStored)))
                        : previewPxFromStored(wStored)
                    }
                    onFocus={() => {
                      const k = dimKey(ic.id, "w");
                      setDimFocus(k);
                      setDimDrafts((d) => ({ ...d, [k]: String(previewPxFromStored(wStored)) }));
                    }}
                    onChange={(e) => {
                      setDimDrafts((d) => ({ ...d, [dimKey(ic.id, "w")]: e.target.value }));
                    }}
                    onBlur={() => {
                      const k = dimKey(ic.id, "w");
                      const raw = dimDrafts[k] ?? String(previewPxFromStored(wStored));
                      setDimFocus((f) => (f === k ? null : f));
                      setDimDrafts((d) => {
                        const n = { ...d };
                        delete n[k];
                        return n;
                      });
                      const v = parseInt(String(raw).trim(), 10);
                      if (Number.isFinite(v)) {
                        onPatchIcon(ic.id, { widthPx: storedPxFromPreview(Math.max(16, v)) });
                      }
                    }}
                    className="w-20 rounded border border-gray-300 px-1 py-0.5"
                  />
                  px(畫布)
                </label>
                <label className="flex items-center gap-1">
                  高
                  <input
                    type="number"
                    step={1}
                    value={
                      dimFocus === dimKey(ic.id, "h")
                        ? (dimDrafts[dimKey(ic.id, "h")] ?? String(previewPxFromStored(hStored)))
                        : previewPxFromStored(hStored)
                    }
                    onFocus={() => {
                      const k = dimKey(ic.id, "h");
                      setDimFocus(k);
                      setDimDrafts((d) => ({
                        ...d,
                        [k]: String(previewPxFromStored(hStored)),
                      }));
                    }}
                    onChange={(e) => {
                      setDimDrafts((d) => ({ ...d, [dimKey(ic.id, "h")]: e.target.value }));
                    }}
                    onBlur={() => {
                      const k = dimKey(ic.id, "h");
                      const raw = dimDrafts[k] ?? String(previewPxFromStored(hStored));
                      setDimFocus((f) => (f === k ? null : f));
                      setDimDrafts((d) => {
                        const n = { ...d };
                        delete n[k];
                        return n;
                      });
                      const v = parseInt(String(raw).trim(), 10);
                      if (Number.isFinite(v)) {
                        onPatchIcon(ic.id, { heightPx: storedPxFromPreview(Math.max(16, v)) });
                      }
                    }}
                    className="w-20 rounded border border-gray-300 px-1 py-0.5"
                  />
                  px(畫布)
                </label>
                <button
                  type="button"
                  className="ml-auto text-red-600 hover:underline"
                  onClick={() => onRemoveIcon(ic.id)}
                >
                  刪除
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">尚無裝飾圖，可先上傳一張。</p>
      )}
    </div>
  );
}
