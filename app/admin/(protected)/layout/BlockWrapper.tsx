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
};

/** 畫布上的區塊外層：可點選、可拖曳底部改變高度 */
export default function BlockWrapper({
  block,
  isSelected,
  onSelect,
  onResizeHeight,
  children,
  blockLabel,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

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
      let newH = Math.max(80, startHeightRef.current + dy);
      onResizeHeight(newH);
    },
    [isDragging, onResizeHeight]
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

  const blockStyle: React.CSSProperties = {
    minHeight: block.heightPx != null && block.heightPx > 0 ? block.heightPx : undefined,
    backgroundImage: block.backgroundImageUrl ? `url(${block.backgroundImageUrl})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  return (
    <div
      className="relative rounded-lg overflow-hidden"
      style={blockStyle}
      data-block-id={block.id}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
          onSelect();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className={`relative z-0 transition-shadow ${isSelected ? "ring-2 ring-amber-500 ring-inset shadow-lg" : "hover:ring-2 hover:ring-amber-300 hover:ring-inset"}`}
      >
        {children}
      </div>
      {/* 選中時顯示區塊名稱 */}
      {isSelected && (
        <div className="absolute top-2 left-2 z-10 rounded bg-amber-500/90 px-2 py-1 text-xs font-medium text-white shadow">
          {blockLabel}
        </div>
      )}
      {/* 底部拖曳條：調整高度 */}
      <div
        data-resize-handle
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 left-0 right-0 h-4 cursor-n-resize bg-amber-500/60 hover:bg-amber-500 flex items-center justify-center z-20 group"
        title="拖曳以調整區塊高度"
      >
        <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
          拖曳調整高度
        </span>
      </div>
    </div>
  );
}
