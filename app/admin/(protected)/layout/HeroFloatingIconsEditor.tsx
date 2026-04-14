"use client";

import { useRef, useCallback, useState, useEffect, type CSSProperties } from "react";
import {
  type HeroFloatingIcon,
  effectiveFloatingCoords,
  floatingIconDisplayHeight,
  formatFloatingIconSlotLabel,
} from "@/app/lib/frontendSettingsShared";
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
  overlayMode?: boolean;
  /** desktop：寫入 leftPct/topPct；mobile：寫入 leftPctMobile/topPctMobile（與桌機分開） */
  coordinateMode?: "desktop" | "mobile";
};

const FLOATING_CANVAS_BASE_WIDTH_PX = 1280;

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

/** 後台畫布：區塊內可拖曳之裝飾圖（百分比座標，中心錨點） */
export default function HeroFloatingIconsEditor({
  icons,
  onChange,
  horizontalCenterSlots1Based,
  horizontalRowGroups1Based,
  verticalNudgePxBySlot1Based,
  overlayMode = false,
  coordinateMode = "desktop",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hostWidth, setHostWidth] = useState<number>(FLOATING_CANVAS_BASE_WIDTH_PX);
  const iconScale = Math.max(0.2, hostWidth / FLOATING_CANVAS_BASE_WIDTH_PX);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = () => {
      const w = Math.max(1, el.clientWidth || FLOATING_CANVAS_BASE_WIDTH_PX);
      setHostWidth((prev) => (prev === w ? prev : w));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (draggingId == null) return;
    if (!icons.some((i) => i.id === draggingId)) setDraggingId(null);
  }, [icons, draggingId]);

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
    setDraggingId(id);
  };

  const active = icons.filter((i) => i.enabled !== false);
  const nudgeMap = verticalNudgePxBySlot1Based ?? {};

  return (
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
        const outerStyle: CSSProperties = {
          left: `${leftPct}%`,
          top: `${topPct}%`,
          transform,
          width: displayW,
          maxWidth: "100%",
          height: "auto",
          zIndex: 20 + (icon.zIndex ?? 0),
        };
        return (
          <button
            key={icon.id}
            type="button"
            data-floating-slot={slot1Based > 0 ? slot1Based : undefined}
            className="pointer-events-auto absolute box-border touch-none select-none cursor-grab rounded-none border-0 bg-transparent p-0 shadow-none outline-none ring-0 focus-visible:ring-2 focus-visible:ring-amber-400/45 focus-visible:ring-offset-0 active:cursor-grabbing"
            style={outerStyle}
            onPointerDown={(e) => onPointerDownIcon(e, icon.id)}
            aria-label={`拖曳調整${slotLabel}裝飾圖位置`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={icon.imageUrl}
              alt=""
              className="pointer-events-none block h-auto w-full object-contain select-none"
              style={{ maxHeight: displayH }}
              draggable={false}
            />
          </button>
        );
      })}
    </div>
  );
}
