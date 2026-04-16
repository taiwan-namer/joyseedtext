"use client";

import { useLayoutEffect, useRef, useState } from "react";
import HeroFloatingIconsEditor from "@/app/admin/(protected)/layout/HeroFloatingIconsEditor";
import HeroFloatingIconsLayer from "@/app/components/home/HeroFloatingIconsLayer";
import {
  LAYOUT_ADMIN_PREVIEW_VIEWPORT_WIDTH_PX,
  LAYOUT_DESIGN_CANVAS_WIDTH_PX,
  LAYOUT_VIEWPORT_REFERENCE_HEIGHT_PX,
  type HeroFloatingIcon,
} from "@/app/lib/frontendSettingsShared";

const VIEW_W = LAYOUT_ADMIN_PREVIEW_VIEWPORT_WIDTH_PX;
const VIEW_H = LAYOUT_VIEWPORT_REFERENCE_HEIGHT_PX;

type Props = {
  icons: HeroFloatingIcon[];
  onChange: (next: HeroFloatingIcon[]) => void;
  coordinateMode: "desktop" | "mobile";
  selectedFloatingIconId: string | null;
  onSelectFloatingIcon: (id: string | null) => void;
  onRemoveIcon: (id: string) => void;
  uploading?: boolean;
  onRequestUpload: () => void;
};

/**
 * 全螢幕裝飾層編輯：參考 1920×1080 視窗，虛線標示主內容欄（1280）位置。
 * 座標為「視窗」百分比，與前台 fixed 全螢幕層一致。
 */
export default function ViewportFloatingIconsEditorPanel({
  icons,
  onChange,
  coordinateMode,
  selectedFloatingIconId,
  onSelectFloatingIcon,
  onRemoveIcon,
  uploading = false,
  onRequestUpload,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.45);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w < 8) return;
      const s = Math.min(1, (w - 8) / VIEW_W);
      setFitScale((prev) => (Math.abs(prev - s) < 0.002 ? prev : s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scaledW = VIEW_W * fitScale;
  const scaledH = VIEW_H * fitScale;

  return (
    <div className="space-y-3 rounded-xl border border-amber-200/80 bg-white/90 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">全螢幕裝飾層</h2>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed max-w-xl">
            相對<strong>瀏覽器視窗</strong>的百分比座標，可放在主內容欄（虛線）兩側留白；與各區塊內裝飾圖分開。
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestUpload}
          disabled={uploading}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          {uploading ? "上傳中…" : "新增裝飾圖"}
        </button>
      </div>

      <div ref={wrapRef} className="w-full overflow-x-auto rounded-lg border border-gray-200 bg-gray-100/90 p-2">
        <div className="relative mx-auto overflow-hidden rounded-md shadow-inner" style={{ width: scaledW, height: scaledH }}>
          <div
            className="absolute left-0 top-0 bg-page"
            style={{
              width: VIEW_W,
              height: VIEW_H,
              transform: `scale(${fitScale})`,
              transformOrigin: "top left",
            }}
          >
            <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-gray-100/40 to-page" aria-hidden />
            <div
              className="pointer-events-none absolute left-1/2 top-0 z-[1] h-full -translate-x-1/2 border-x border-dashed border-amber-500/45"
              style={{ width: LAYOUT_DESIGN_CANVAS_WIDTH_PX, maxWidth: "100%" }}
              aria-hidden
            />
            <div className="relative z-[5] h-full w-full">
              {icons.length > 0 ? (
                <HeroFloatingIconsLayer
                  icons={icons}
                  coordinateViewport={coordinateMode}
                  scaleReferenceWidthPx={VIEW_W}
                />
              ) : null}
              <HeroFloatingIconsEditor
                overlayMode
                coordinateMode={coordinateMode}
                icons={icons}
                onChange={onChange}
                selectedIconId={selectedFloatingIconId}
                onIconPointerDown={(id) => onSelectFloatingIcon(id)}
                scaleReferenceWidthPx={VIEW_W}
              />
            </div>
          </div>
        </div>
      </div>

      {icons.length > 0 ? (
        <ul className="space-y-1.5 text-xs text-gray-700">
          {icons.map((ic, idx) => (
            <li key={ic.id} className="flex items-center justify-between gap-2 rounded border border-gray-200/80 bg-white px-2 py-1.5">
              <button
                type="button"
                onClick={() => onSelectFloatingIcon(ic.id)}
                className={`min-w-0 flex-1 text-left truncate ${selectedFloatingIconId === ic.id ? "text-amber-800 font-medium" : ""}`}
              >
                編號 {idx + 1}
                {selectedFloatingIconId === ic.id ? "（已選）" : ""}
              </button>
              <button
                type="button"
                onClick={() => onRemoveIcon(ic.id)}
                className="shrink-0 text-red-600 hover:underline"
              >
                移除
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">尚無全螢幕裝飾圖，請按「新增裝飾圖」上傳。</p>
      )}
    </div>
  );
}
