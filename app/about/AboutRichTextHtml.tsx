"use client";

import { stripGoogleFontsFromHtml } from "@/lib/stripGoogleFontsFromHtml";

type Props = {
  html: string;
  className?: string;
};

/** 關於頁內文（CMS HTML） */
export default function AboutRichTextHtml({ html, className }: Props) {
  const safe = stripGoogleFontsFromHtml(html);
  return (
    <div
      className={className ?? "home-rich-text about-page-rich-text w-full min-w-0"}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
