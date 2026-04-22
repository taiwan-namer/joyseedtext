"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  type HeroFloatingIcon,
  effectiveFloatingCoords,
  floatingIconDisplayHeight,
  floatingIconColumnLeftPctToHostLeftPct,
  LAYOUT_DESIGN_CANVAS_WIDTH_PX,
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
  /**
   * 裝飾圖寬度縮放基準（px）。區塊內預設 1280（與 max-w-7xl 一致）；全頁裝飾層請傳模擬視窗寬（如 1920）。
   */
  scaleReferenceWidthPx?: number;
  /**
   * `content-column-in-viewport`：儲存之橫向座標為「置中內容欄」百分比，繪製時 host 為整頁寬，會換算成 host 上之百分比（既有座標不移位，但可拖進左右留白）。
   */
  horizontalLayout?: "host" | "content-column-in-viewport";
};

function useNarrowMaxMd(): boolean {
  const [narrow, setNarrow] = useState(false);
  /** 必須在繪製前同步（useLayoutEffect），否則未傳 coordinateViewport 時會先以桌機座標／縮放畫一幀，再跳到手機，造成「裝飾圖先跑掉」。 */
  useLayoutEffect(() => {
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
  scaleReferenceWidthPx = LAYOUT_DESIGN_CANVAS_WIDTH_PX,
  horizontalLayout = "host",
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const scaleBase = scaleReferenceWidthPx > 0 ? scaleReferenceWidthPx : LAYOUT_DESIGN_CANVAS_WIDTH_PX;
  /** null=尚未量到容器寬；先不渲染 icon，避免第一幀跳位 */
  const [hostWidth, setHostWidth] = useState<number | null>(null);
  const narrowAuto = useNarrowMaxMd();
  const resolvedMode: "desktop" | "mobile" =
    coordinateViewport === "mobile" ? "mobile" : coordinateViewport === "desktop" ? "desktop" : narrowAuto ? "mobile" : "desktop";
  const full = icons ?? [];
  const list = full.filter((i) => i.enabled !== false && i.imageUrl?.trim());
  const centerSet = horizontalCenterSlots1Based ?? [];
  const rowGroups = horizontalRowGroups1Based ?? [];
  const nudgeMap = verticalNudgePxBySlot1Based ?? {};
  const iconScale =
    hostWidth != null ? Math.max(0.2, hostWidth / scaleBase) : 1;
  const useAboutRules = resolvedMode === "desktop" && (centerSet.length > 0 || rowGroups.length > 0);

  /** 初始 hostWidth 用設計欄寬；實際容器寬度須在繪製前以 ResizeObserver 寫入，否則 iconScale 先為 1 再變小，裝飾圖會先錯位／錯尺寸。 */
  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const apply = () => {
      const w = Math.max(1, el.clientWidth || scaleBase);
      setHostWidth((prev) => (prev === w ? prev : w));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [list.length, scaleBase]);

  if (list.length === 0) return null;

  const zClass = underContent ? "z-[1]" : "z-[30]";
  if (hostWidth === null) {
    return (
      <div
        ref={hostRef}
        className={`pointer-events-none absolute inset-0 ${zClass} ${wrapperClassName}`.trim()}
        aria-hidden
      />
    );
  }

  return (
    <div
      ref={hostRef}
      className={`pointer-events-none absolute inset-0 ${zClass} ${wrapperClassName}`.trim()}
      aria-hidden
    >
      {list.map((icon) => {
        const slotIdx = full.findIndex((x) => x.id === icon.id);
        const slot1Based = slotIdx >= 0 ? slotIdx + 1 : 0;
        const { leftPct: rawLeftPct, topPct } = useAboutRules
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
        const leftPct =
          !useAboutRules && horizontalLayout === "content-column-in-viewport"
            ? floatingIconColumnLeftPctToHostLeftPct(rawLeftPct, hostWidth, LAYOUT_DESIGN_CANVAS_WIDTH_PX)
            : rawLeftPct;
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
            className="absolute box-border overflow-visible"
            data-floating-slot={slot1Based > 0 ? slot1Based : undefined}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              transform,
              width: displayW,
              /* 勿設 maxWidth:100%：translate(-50%) 貼邊時會壓縮盒寬，導致無法靠近左右 */
              height: displayH,
              zIndex: 1 + (icon.zIndex ?? 0),
            }}
          >
            <div className="relative h-full w-full">
              {/* 使用原生 img：裝飾圖來自 R2 任意公開網域，next/image 需逐一設定 remotePatterns，否則前台不顯示 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={icon.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-contain select-none"
                draggable={false}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
