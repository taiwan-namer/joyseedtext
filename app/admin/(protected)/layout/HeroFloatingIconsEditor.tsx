"use client";

import { useRef, useCallback, useState, useEffect, useLayoutEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  type HeroFloatingIcon,
  effectiveFloatingCoords,
  floatingIconDisplayHeight,
  formatFloatingIconSlotLabel,
  LAYOUT_DESIGN_CANVAS_WIDTH_PX,
} from "@/app/lib/frontendSettingsShared";

const DEFAULT_SCALE_REF = LAYOUT_DESIGN_CANVAS_WIDTH_PX;
import {
  findRowGroupContainingSlot1Based,
  getAboutFloatingIconComputedPct,
  isAboutFloatingSlotHorizontalCenter1Based,
} from "@/app/about/aboutFloatingLayout";

type Props = {
  icons: HeroFloatingIcon[];
  onChange: (next: HeroFloatingIcon[]) => void;
  /** 與後台列表編號（1-based）一致；這些 slot 水平鎖定置中，拖曳僅改上下 */
  horizontalCenterSlots1Based?: readonly number[];
  /** 關於區：橫列編號群組；拖曳時整列同步 top */
  horizontalRowGroups1Based?: readonly (readonly number[])[];
  /** 依編號垂直微調（px），與前台 HeroFloatingIconsLayer 一致 */
  verticalNudgePxBySlot1Based?: Readonly<Record<number, number>>;
  /**
   * 與 HeroFloatingIconsLayer 並用；後台畫布曾用全透明 img 僅留拖曳區，但若底層 Layer 未合成（z-index／縮放）會導致「上傳後畫布上看不到圖」。
   * 現改為與非 overlay 相同顯示圖片，與 Layer 重疊時視覺仍為單一圖。
   */
  overlayMode?: boolean;
  /** overlay 模式是否仍由 editor 自行顯示圖片；若底層已有 Layer，設 false 可避免雙層渲染偏差 */
  showImageInOverlay?: boolean;
  /** desktop：寫入 leftPct/topPct；mobile：寫入 leftPctMobile/topPctMobile（與桌機分開） */
  coordinateMode?: "desktop" | "mobile";
  /** 與側欄「編號」連動高亮 */
  selectedIconId?: string | null;
  /** 點選裝飾圖時（含拖曳前）通知父層，供側欄捲動至對應編號 */
  onIconPointerDown?: (id: string) => void;
  /** 與 HeroFloatingIconsLayer 之 scaleReferenceWidthPx 一致 */
  scaleReferenceWidthPx?: number;
  /** 全螢幕裝飾圖：選取時在圖旁顯示寬高／刪除（與側欄區塊裝飾圖邏輯一致，數值為畫布預覽 px） */
  viewportInlineToolbar?: boolean;
  /** 與後台畫布縮放一致，用於寬高輸入與儲存 px 換算 */
  canvasPreviewScale?: number;
  onRemoveIcon?: (id: string) => void;
};

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/** 後台畫布：Hero 區內可拖曳之裝飾圖（百分比座標，中心錨點） */
export default function HeroFloatingIconsEditor({
  icons,
  onChange,
  horizontalCenterSlots1Based,
  horizontalRowGroups1Based,
  verticalNudgePxBySlot1Based,
  overlayMode = false,
  showImageInOverlay = true,
  coordinateMode = "desktop",
  selectedIconId = null,
  onIconPointerDown,
  scaleReferenceWidthPx = DEFAULT_SCALE_REF,
  viewportInlineToolbar = false,
  canvasPreviewScale = 1,
  onRemoveIcon,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iconButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scaleBase = scaleReferenceWidthPx > 0 ? scaleReferenceWidthPx : DEFAULT_SCALE_REF;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** null=尚未量到容器寬；先不渲染 icon，避免第一幀跳位 */
  const [hostWidth, setHostWidth] = useState<number | null>(null);
  const iconScale = hostWidth != null ? Math.max(0.2, hostWidth / scaleBase) : 1;
  const previewScale = Math.min(100, Math.max(0.25, canvasPreviewScale));
  const previewPxFromStored = useCallback((n: number) => Math.round(n * previewScale), [previewScale]);
  const storedPxFromPreview = useCallback((n: number) => Math.round(n / previewScale), [previewScale]);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [dimDrafts, setDimDrafts] = useState<Record<string, string>>({});
  const [dimFocus, setDimFocus] = useState<string | null>(null);
  const dimKey = (iconId: string, axis: "w" | "h") => `${iconId}:${axis}`;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = () => {
      const w = Math.max(1, el.clientWidth || scaleBase);
      setHostWidth((prev) => (prev === w ? prev : w));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scaleBase]);

  /** 刪除／上傳替換列表時避免仍拖著已不存在的 id */
  useEffect(() => {
    if (draggingId == null) return;
    if (!icons.some((i) => i.id === draggingId)) setDraggingId(null);
  }, [icons, draggingId]);

  const repositionViewportToolbar = useCallback(() => {
    if (!viewportInlineToolbar || !selectedIconId) {
      setToolbarPos(null);
      return;
    }
    const btn = iconButtonRefs.current[selectedIconId];
    if (!btn) {
      setToolbarPos(null);
      return;
    }
    const rect = btn.getBoundingClientRect();
    const panelW = 248;
    const panelH = 168;
    const margin = 8;
    let left = rect.right + margin;
    if (left + panelW > window.innerWidth - margin) {
      left = Math.max(margin, rect.left - panelW - margin);
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - panelW - margin));
    let top = rect.top;
    if (top + panelH > window.innerHeight - margin) {
      top = Math.max(margin, rect.bottom - panelH);
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - panelH - margin));
    setToolbarPos({ top, left });
  }, [viewportInlineToolbar, selectedIconId]);

  useLayoutEffect(() => {
    repositionViewportToolbar();
  }, [repositionViewportToolbar, icons, draggingId, hostWidth]);

  useEffect(() => {
    if (!viewportInlineToolbar || !selectedIconId) return;
    const onScrollOrResize = () => repositionViewportToolbar();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [viewportInlineToolbar, selectedIconId, repositionViewportToolbar]);

  useEffect(() => {
    if (!viewportInlineToolbar || !selectedIconId || !draggingId) return;
    const onMove = () => repositionViewportToolbar();
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [viewportInlineToolbar, selectedIconId, draggingId, repositionViewportToolbar]);

  const updateIcon = useCallback(
    (id: string, patch: Partial<HeroFloatingIcon>) => {
      onChange(icons.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    },
    [icons, onChange]
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingId || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const leftPct = clampPct(((e.clientX - rect.left) / rect.width) * 100);
      const topPct = clampPct(((e.clientY - rect.top) / rect.height) * 100);
      const isMobile = coordinateMode === "mobile";
      if (
        horizontalCenterSlots1Based?.length &&
        isAboutFloatingSlotHorizontalCenter1Based(icons, draggingId, horizontalCenterSlots1Based)
      ) {
        if (isMobile) updateIcon(draggingId, { topPctMobile: topPct });
        else updateIcon(draggingId, { topPct });
        return;
      }
      const dragIdx = icons.findIndex((x) => x.id === draggingId);
      const dragSlot = dragIdx >= 0 ? dragIdx + 1 : 0;
      const rowGroups = horizontalRowGroups1Based ?? [];
      const row = findRowGroupContainingSlot1Based(dragSlot, rowGroups);
      if (row && row.length > 0) {
        onChange(
          icons.map((ic) => {
            const si = icons.findIndex((x) => x.id === ic.id) + 1;
            if (!row.includes(si)) return ic;
            if (isMobile) return { ...ic, topPctMobile: topPct };
            return { ...ic, topPct };
          })
        );
        return;
      }
      if (isMobile) updateIcon(draggingId, { leftPctMobile: leftPct, topPctMobile: topPct });
      else updateIcon(draggingId, { leftPct, topPct });
    },
    [
      draggingId,
      updateIcon,
      icons,
      horizontalCenterSlots1Based,
      horizontalRowGroups1Based,
      onChange,
      coordinateMode,
    ]
  );

  const endDrag = useCallback(() => {
    setDraggingId(null);
  }, []);

  useEffect(() => {
    if (!draggingId) return;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [draggingId, onPointerMove, endDrag]);

  const onPointerDownIcon = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onIconPointerDown?.(id);
    setDraggingId(id);
  };

  const active = icons.filter((i) => i.enabled !== false);
  const nudgeMap = verticalNudgePxBySlot1Based ?? {};
  const selectedForToolbar =
    viewportInlineToolbar && selectedIconId
      ? icons.find((i) => i.id === selectedIconId && i.enabled !== false)
      : null;

  if (hostWidth === null) {
    return (
      <div
        ref={containerRef}
        data-floating-icon-editor
        className={`pointer-events-none absolute inset-0 ${overlayMode ? "z-[45]" : "z-[30]"}`}
      />
    );
  }

  const toolbarPortal =
    typeof document !== "undefined" &&
    viewportInlineToolbar &&
    toolbarPos &&
    selectedForToolbar &&
    onRemoveIcon
      ? createPortal(
          <div
            className="fixed z-[9999] w-[min(92vw,248px)] rounded-lg border border-amber-200 bg-white p-2.5 shadow-lg"
            style={{ top: toolbarPos.top, left: toolbarPos.left }}
            data-floating-icon-editor
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex gap-2">
              <span className="shrink-0 text-xs font-semibold text-amber-900 tabular-nums">
                {formatFloatingIconSlotLabel(
                  Math.max(0, icons.findIndex((x) => x.id === selectedForToolbar.id))
                )}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedForToolbar.imageUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded bg-gray-50 object-contain"
              />
              <button
                type="button"
                className="ml-auto shrink-0 text-xs text-red-600 hover:underline"
                onClick={() => onRemoveIcon(selectedForToolbar.id)}
              >
                刪除
              </button>
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-gray-800">
              <label className="flex items-center gap-1.5">
                寬
                <input
                  type="number"
                  step={1}
                  value={
                    dimFocus === dimKey(selectedForToolbar.id, "w")
                      ? (dimDrafts[dimKey(selectedForToolbar.id, "w")] ??
                        String(
                          previewPxFromStored(
                            effectiveFloatingCoords(selectedForToolbar, coordinateMode).widthPx
                          )
                        ))
                      : previewPxFromStored(
                          effectiveFloatingCoords(selectedForToolbar, coordinateMode).widthPx
                        )
                  }
                  onFocus={() => {
                    const k = dimKey(selectedForToolbar.id, "w");
                    setDimFocus(k);
                    setDimDrafts((d) => ({
                      ...d,
                      [k]: String(
                        previewPxFromStored(
                          effectiveFloatingCoords(selectedForToolbar, coordinateMode).widthPx
                        )
                      ),
                    }));
                  }}
                  onChange={(e) => {
                    setDimDrafts((d) => ({ ...d, [dimKey(selectedForToolbar.id, "w")]: e.target.value }));
                  }}
                  onBlur={() => {
                    const k = dimKey(selectedForToolbar.id, "w");
                    const raw =
                      dimDrafts[k] ??
                      String(
                        previewPxFromStored(
                          effectiveFloatingCoords(selectedForToolbar, coordinateMode).widthPx
                        )
                      );
                    setDimFocus((f) => (f === k ? null : f));
                    setDimDrafts((d) => {
                      const n = { ...d };
                      delete n[k];
                      return n;
                    });
                    const v = parseInt(String(raw).trim(), 10);
                    if (Number.isFinite(v)) {
                      updateIcon(selectedForToolbar.id, {
                        widthPx: storedPxFromPreview(Math.max(16, v)),
                      });
                    }
                  }}
                  className="w-20 rounded border border-gray-300 px-1 py-0.5"
                />
                px（畫布）
              </label>
              <label className="flex items-center gap-1.5">
                高
                <input
                  type="number"
                  step={1}
                  value={
                    dimFocus === dimKey(selectedForToolbar.id, "h")
                      ? (dimDrafts[dimKey(selectedForToolbar.id, "h")] ??
                        String(
                          previewPxFromStored(
                            floatingIconDisplayHeight({
                              ...selectedForToolbar,
                              ...effectiveFloatingCoords(selectedForToolbar, coordinateMode),
                            })
                          )
                        ))
                      : previewPxFromStored(
                          floatingIconDisplayHeight({
                            ...selectedForToolbar,
                            ...effectiveFloatingCoords(selectedForToolbar, coordinateMode),
                          })
                        )
                  }
                  onFocus={() => {
                    const k = dimKey(selectedForToolbar.id, "h");
                    setDimFocus(k);
                    const eff = effectiveFloatingCoords(selectedForToolbar, coordinateMode);
                    setDimDrafts((d) => ({
                      ...d,
                      [k]: String(
                        previewPxFromStored(
                          floatingIconDisplayHeight({
                            ...selectedForToolbar,
                            widthPx: eff.widthPx,
                            heightPx: eff.heightPx,
                          })
                        )
                      ),
                    }));
                  }}
                  onChange={(e) => {
                    setDimDrafts((d) => ({ ...d, [dimKey(selectedForToolbar.id, "h")]: e.target.value }));
                  }}
                  onBlur={() => {
                    const k = dimKey(selectedForToolbar.id, "h");
                    const eff = effectiveFloatingCoords(selectedForToolbar, coordinateMode);
                    const raw =
                      dimDrafts[k] ??
                      String(
                        previewPxFromStored(
                          floatingIconDisplayHeight({
                            ...selectedForToolbar,
                            widthPx: eff.widthPx,
                            heightPx: eff.heightPx,
                          })
                        )
                      );
                    setDimFocus((f) => (f === k ? null : f));
                    setDimDrafts((d) => {
                      const n = { ...d };
                      delete n[k];
                      return n;
                    });
                    const v = parseInt(String(raw).trim(), 10);
                    if (Number.isFinite(v)) {
                      updateIcon(selectedForToolbar.id, {
                        heightPx: storedPxFromPreview(Math.max(16, v)),
                      });
                    }
                  }}
                  className="w-20 rounded border border-gray-300 px-1 py-0.5"
                />
                px（畫布）
              </label>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
    <div
      ref={containerRef}
      data-floating-icon-editor
      className={`pointer-events-none absolute inset-0 ${overlayMode ? "z-[45]" : "z-[30]"}`}
    >
      {active.map((icon) => {
        const slotIndex = icons.findIndex((x) => x.id === icon.id);
        const slotLabel = formatFloatingIconSlotLabel(slotIndex < 0 ? 0 : slotIndex);
        const slot1Based = slotIndex < 0 ? 0 : slotIndex + 1;
        const centerSlots = horizontalCenterSlots1Based ?? [];
        const rowGroups = horizontalRowGroups1Based ?? [];
        const useAboutRules =
          coordinateMode === "desktop" && (centerSlots.length > 0 || rowGroups.length > 0);
        const { leftPct, topPct } = useAboutRules
          ? getAboutFloatingIconComputedPct(icon, slot1Based, icons, {
              horizontalCenterSlots1Based: centerSlots,
              horizontalRowGroups1Based: rowGroups,
              hostWidthPx: hostWidth,
              iconScale,
            })
          : (() => {
              const eff = effectiveFloatingCoords(icon, coordinateMode);
              return { leftPct: eff.leftPct, topPct: eff.topPct };
            })();
        const nudgeY = (nudgeMap[slot1Based] ?? 0) * iconScale;
        const transform =
          nudgeY !== 0 ? `translate(-50%, calc(-50% + ${nudgeY}px))` : "translate(-50%, -50%)";
        const eff = effectiveFloatingCoords(icon, coordinateMode);
        const wPx = eff.widthPx;
        const displayW = wPx * iconScale;
        const displayH = floatingIconDisplayHeight({ ...icon, widthPx: wPx, heightPx: eff.heightPx }) * iconScale;
        /** 與前台 HeroFloatingIconsLayer 一致：固定 width/height + 中心錨點，避免儲存後位移。 */
        const outerStyle: CSSProperties = {
          left: `${leftPct}%`,
          top: `${topPct}%`,
          transform,
          width: displayW,
          height: displayH,
          zIndex: 20 + (icon.zIndex ?? 0),
        };
        return (
          <button
            key={icon.id}
            type="button"
            ref={(el) => {
              iconButtonRefs.current[icon.id] = el;
            }}
            data-floating-slot={slot1Based > 0 ? slot1Based : undefined}
            className={`pointer-events-auto absolute box-border touch-none select-none cursor-grab rounded-md border-0 bg-transparent p-0 shadow-none outline-none ring-0 focus-visible:ring-2 focus-visible:ring-amber-400/45 focus-visible:ring-offset-0 active:cursor-grabbing ${
              selectedIconId === icon.id ? "ring-2 ring-amber-500 ring-offset-1" : ""
            }`}
            style={outerStyle}
            onPointerDown={(e) => onPointerDownIcon(e, icon.id)}
            aria-label={`拖曳調整${slotLabel}裝飾圖位置`}
          >
            {!overlayMode || showImageInOverlay ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={icon.imageUrl}
                  alt=""
                  className="pointer-events-none block h-full w-full object-contain select-none"
                  draggable={false}
                />
              </>
            ) : null}
          </button>
        );
      })}
    </div>
    {toolbarPortal}
    </>
  );
}
