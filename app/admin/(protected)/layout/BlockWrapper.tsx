"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type { LayoutBlock } from "@/app/lib/frontendSettingsShared";

type Props = {
  block: LayoutBlock;
  isSelected: boolean;
  onSelect: () => void;
  onResizeHeight: (heightPx: number | null) => void;
  children: React.ReactNode;
  blockLabel: string;
  /** 頁尾區塊若由子元件自行鋪背景（與前台 HomePageFooter 一致），勿在外層重複鋪圖 */
  skipBackgroundImage?: boolean;
  /** 畫布 CSS transform 縮放（0.25–1）；拖曳高度時將螢幕位移換算為前台設計 px */
  previewScale?: number;
};

/** 畫布上的區塊外層：可點選、可拖曳底部改變高度 */
export default function BlockWrapper({
  block,
  isSelected,
  onSelect,
  onResizeHeight,
  children,
  blockLabel,
  skipBackgroundImage = false,
  previewScale = 1,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const scale = previewScale > 0 ? previewScale : 1;

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      startYRef.current = e.clientY;
      startHeightRef.current = block.heightPx ?? 200;
    },
    [block.heightPx]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const dy = e.clientY - startYRef.current;
      const designDy = dy / scale;
      let newH = Math.max(80, startHeightRef.current + designDy);
      onResizeHeight(newH);
    },
    [isDragging, onResizeHeight, scale]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const rawH = block.heightPx != null && block.heightPx > 0 ? block.heightPx : null;
  const canvasPreviewH = rawH != null ? Math.round(rawH * scale) : null;
  const heightBadge =
    rawH == null
      ? "自動"
      : scale !== 1
        ? `畫布 ${canvasPreviewH} px（前台 ${rawH} px）`
        : `${rawH} px`;

  const blockStyle: React.CSSProperties = {
    minHeight: block.heightPx != null && block.heightPx > 0 ? block.heightPx : undefined,
    ...(skipBackgroundImage || !block.backgroundImageUrl
      ? {}
      : {
          backgroundImage: `url(${block.backgroundImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }),
  };

  return (
    <div
      className="relative"
      style={blockStyle}
      data-block-id={block.id}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("[data-resize-handle]")) return;
          if (t.closest("[data-floating-icon-editor]")) return;
          onSelect();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className={`relative transition-shadow ${isSelected ? "ring-2 ring-amber-500 ring-inset shadow-lg" : "hover:ring-2 hover:ring-amber-300 hover:ring-inset"}`}
      >
        {children}
      </div>
      {/* 選中時顯示區塊名稱與目前高度（畫布上即時顯示） */}
      {isSelected && (
        <div className="pointer-events-none absolute top-2 left-2 z-10 flex items-center gap-2">
          <span className="rounded bg-amber-500/90 px-2 py-1 text-xs font-medium text-white shadow">
            {blockLabel}
          </span>
          <span className="rounded bg-gray-800/90 px-2 py-1 text-xs font-medium text-white shadow">
            高度: {heightBadge}
          </span>
        </div>
      )}
      {/* 底部拖曳條：調整高度（即時顯示目前高度） */}
      <div
        data-resize-handle
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 left-0 right-0 h-4 cursor-n-resize bg-amber-500/60 hover:bg-amber-500 flex items-center justify-center z-20 group"
        title="拖曳以調整區塊高度"
      >
        <span className="text-white text-xs font-medium">
          {heightBadge} · 拖曳調整
        </span>
      </div>
    </div>
  );
}
