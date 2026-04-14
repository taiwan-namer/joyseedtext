"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  type HeroFloatingIcon,
  effectiveFloatingCoords,
  floatingIconDisplayHeight,
} from "@/app/lib/frontendSettingsShared";
import { getAboutFloatingIconComputedPct } from "@/app/about/aboutFloatingLayout";

type Props = {
  icons: HeroFloatingIcon[] | undefined;
  coordinateViewport?: "desktop" | "mobile";
  horizontalCenterSlots1Based?: readonly number[];
  horizontalRowGroups1Based?: readonly (readonly number[])[];
  verticalNudgePxBySlot1Based?: Readonly<Record<number, number>>;
  underContent?: boolean;
  wrapperClassName?: string;
};

const FLOATING_CANVAS_BASE_WIDTH_PX = 1280;

function useNarrowMaxMd(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const apply = () => setNarrow(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);
  return narrow;
}

export default function HeroFloatingIconsLayer({
  icons,
  coordinateViewport,
  horizontalCenterSlots1Based,
  horizontalRowGroups1Based,
  verticalNudgePxBySlot1Based,
  underContent = false,
  wrapperClassName = "",
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hostWidth, setHostWidth] = useState<number>(FLOATING_CANVAS_BASE_WIDTH_PX);
  const narrowAuto = useNarrowMaxMd();
  const resolvedMode: "desktop" | "mobile" =
    coordinateViewport === "mobile" ? "mobile" : coordinateViewport === "desktop" ? "desktop" : narrowAuto ? "mobile" : "desktop";
  const full = icons ?? [];
  const list = full.filter((i) => i.enabled !== false && i.imageUrl?.trim());
  const centerSet = horizontalCenterSlots1Based ?? [];
  const rowGroups = horizontalRowGroups1Based ?? [];
  const nudgeMap = verticalNudgePxBySlot1Based ?? {};
  const iconScale = Math.max(0.2, hostWidth / FLOATING_CANVAS_BASE_WIDTH_PX);
  const useAboutRules = resolvedMode === "desktop" && (centerSet.length > 0 || rowGroups.length > 0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const apply = () => {
      const w = Math.max(1, el.clientWidth || FLOATING_CANVAS_BASE_WIDTH_PX);
      setHostWidth((prev) => (prev === w ? prev : w));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [list.length]);

  if (list.length === 0) return null;

  const zClass = underContent ? "z-[1]" : "z-[30]";
  return (
    <div
      ref={hostRef}
      className={`pointer-events-none absolute inset-0 ${zClass} ${wrapperClassName}`.trim()}
      aria-hidden
    >
      {list.map((icon) => {
        const slotIdx = full.findIndex((x) => x.id === icon.id);
        const slot1Based = slotIdx >= 0 ? slotIdx + 1 : 0;
        const { leftPct, topPct } = useAboutRules
          ? getAboutFloatingIconComputedPct(icon, slot1Based, full, {
              horizontalCenterSlots1Based: centerSet,
              horizontalRowGroups1Based: rowGroups,
              hostWidthPx: hostWidth,
              iconScale,
            })
          : (() => {
              const eff = effectiveFloatingCoords(icon, resolvedMode);
              return { leftPct: eff.leftPct, topPct: eff.topPct };
            })();
        const nudgeY = (nudgeMap[slot1Based] ?? 0) * iconScale;
        const transform =
          nudgeY !== 0 ? `translate(-50%, calc(-50% + ${nudgeY}px))` : "translate(-50%, -50%)";
        const eff = effectiveFloatingCoords(icon, resolvedMode);
        const wPx = eff.widthPx;
        const displayH = floatingIconDisplayHeight({ ...icon, widthPx: wPx, heightPx: eff.heightPx }) * iconScale;
        const displayW = wPx * iconScale;
        return (
          <div
            key={icon.id}
            className="absolute box-border overflow-hidden"
            data-floating-slot={slot1Based > 0 ? slot1Based : undefined}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              transform,
              width: displayW,
              maxWidth: "100%",
              height: displayH,
              zIndex: 1 + (icon.zIndex ?? 0),
            }}
          >
            <div className="relative h-full w-full">
              <Image
                src={icon.imageUrl}
                alt=""
                fill
                sizes={`${Math.max(32, Math.ceil(Math.max(displayW, 48)))}px`}
                className="object-contain select-none"
                draggable={false}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
