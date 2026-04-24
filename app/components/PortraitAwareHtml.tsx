"use client";

import { useEffect, useRef } from "react";

type PortraitAwareHtmlProps = {
  html: string;
  className: string;
};

const PORTRAIT_CLASS = "is-portrait-image";

function markPortraitImage(img: HTMLImageElement) {
  if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
  const isPortrait = img.naturalHeight > img.naturalWidth;
  img.classList.toggle(PORTRAIT_CLASS, isPortrait);
  img.style.aspectRatio = isPortrait ? "1 / 1" : "";
  img.style.objectFit = isPortrait ? "cover" : "";
}

/**
 * 在圖片載入後偵測直／橫，直圖加上 `is-portrait-image` 供外層用 Tailwind 做方格 cover 等樣式。
 */
export default function PortraitAwareHtml({ html, className }: PortraitAwareHtmlProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];
    const listeners: Array<{ img: HTMLImageElement; onLoad: () => void }> = [];
    for (const img of imgs) {
      const onLoad = () => markPortraitImage(img);
      if (img.complete) onLoad();
      else img.addEventListener("load", onLoad, { once: true });
      listeners.push({ img, onLoad });
    }
    return () => {
      for (const { img, onLoad } of listeners) {
        img.removeEventListener("load", onLoad);
      }
    };
  }, [html]);
  return <div ref={rootRef} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
