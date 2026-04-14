"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { isValidImageUrl } from "@/lib/safeMedia";

const SESSION_KEY = "wv_entry_popup_dismissed";

export type EntryPopupAdProps = {
  enabled: boolean;
  imageUrl: string | null | undefined;
  linkUrl: string | null | undefined;
};

/**
 * 首頁進站彈窗（建議圖 480×640）；同一瀏覽器分頁工作階段僅顯示一次。
 */
export default function EntryPopupAd({ enabled, imageUrl, linkUrl }: EntryPopupAdProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || !imageUrl?.trim()) return;
    if (!isValidImageUrl(imageUrl.trim())) return;
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1") {
        return;
      }
    } catch {
      /* ignore */
    }
    setOpen(true);
  }, [enabled, imageUrl]);

  const close = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const href = linkUrl?.trim() ?? "";
  const img = imageUrl?.trim() ?? "";

  if (!open || !img) return null;

  const onPanelClick = () => {
    if (href) window.open(href, "_blank", "noopener,noreferrer");
    else close();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto overscroll-y-contain bg-black/50 p-3 pt-16 sm:items-center sm:p-4 sm:pt-4"
      role="dialog"
      aria-modal="true"
      aria-label="網站公告"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="relative my-auto flex min-h-0 w-[min(480px,calc(100vw-1.5rem))] max-w-full flex-col">
        <button
          type="button"
          onClick={close}
          className="absolute -right-1 -top-1 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-900/85 text-white shadow-md transition hover:bg-gray-900"
          aria-label="關閉"
        >
          <X className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPanelClick();
          }}
          className="relative block w-full min-h-0 cursor-pointer overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label={href ? "開啟連結" : "關閉廣告"}
        >
          {/* 寬度優先填滿彈窗（避免 max-h+contain 先限高 → 圖變窄、左右大白邊）；過高則由外層 overlay 捲動 */}
          <Image
            src={img}
            alt="促銷活動"
            width={480}
            height={640}
            className="block h-auto w-full max-w-full"
            sizes="(max-width: 520px) 92vw, 480px"
            unoptimized={img.startsWith("http")}
            priority
          />
        </button>
        {href ? (
          <p className="mt-2 text-center text-xs text-white/90 drop-shadow">
            點擊圖片開啟連結；點背景或右上角可關閉
          </p>
        ) : (
          <p className="mt-2 text-center text-xs text-white/90 drop-shadow">點擊圖片、背景或右上角關閉</p>
        )}
      </div>
    </div>
  );
}
