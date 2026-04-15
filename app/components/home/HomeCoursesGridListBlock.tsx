"use client";

import Link from "next/link";
import NextImage from "next/image";
import { Image as LucideImage } from "lucide-react";
import type { Activity } from "@/app/lib/homeSectionTypes";

type Props = {
  variant: "grid" | "list";
  activities: Activity[];
  loading: boolean;
  error?: string | null;
  /** 後台畫布：顯示版型說明與無資料時的線框示意 */
  showPreviewHint?: boolean;
};

function EmptyLayoutMock({ variant }: { variant: "grid" | "list" }) {
  if (variant === "grid") {
    return (
      <div
        className="grid grid-cols-2 sm:grid-cols-3 gap-3 opacity-70"
        aria-hidden
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border-2 border-dashed border-amber-300/90 bg-amber-50/40 p-2 flex flex-col gap-2"
          >
            <div className="aspect-square rounded-lg bg-amber-100/80 border border-amber-200/60" />
            <div className="h-2.5 rounded bg-amber-200/70 w-3/4 mx-auto" />
            <div className="h-2 rounded bg-amber-100/80 w-1/2 mx-auto" />
            <div className="h-7 rounded-md bg-amber-200/50 w-full" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3 opacity-70" aria-hidden>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="flex flex-row gap-4 p-3 rounded-xl border-2 border-dashed border-amber-300/90 bg-amber-50/40"
        >
          <div className="w-24 sm:w-32 shrink-0 aspect-square rounded-lg bg-amber-100/80 border border-amber-200/60" />
          <div className="flex-1 flex flex-col gap-2 justify-center min-w-0">
            <div className="h-3 rounded bg-amber-200/70 w-2/3" />
            <div className="h-2.5 rounded bg-amber-100/80 w-1/3" />
            <div className="h-8 rounded-md bg-amber-200/50 w-24 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 熱門課程「網格」與「列表」版型：與總站首頁積木對應；無資料時可顯示線框示意。
 */
export default function HomeCoursesGridListBlock({
  variant,
  activities,
  loading,
  error,
  showPreviewHint = false,
}: Props) {
  const isList = variant === "list";

  if (loading) {
    return (
      <div className={isList ? "space-y-4" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"}>
        {Array.from({ length: isList ? 2 : 4 }).map((_, i) => (
          <div
            key={i}
            className={`bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm animate-pulse ${
              isList ? "flex flex-row sm:flex-row gap-4 p-4" : "flex flex-col"
            }`}
          >
            <div
              className={`bg-gray-200 ${isList ? "w-full sm:w-40 shrink-0 aspect-square" : "aspect-square"}`}
            />
            <div className="p-3 space-y-2 flex-1">
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
              <div className="h-8 bg-gray-200 rounded-lg w-full mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-white p-6 text-sm text-red-600">{error}</div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="space-y-4">
        {showPreviewHint ? (
          <p className="text-xs text-amber-900/90 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
            {isList
              ? "列表版型示意：橫向圖＋文字；有上架課程後會自動帶入。"
              : "網格版型示意：多欄卡片；有上架課程後會自動帶入。"}
          </p>
        ) : null}
        <EmptyLayoutMock variant={variant} />
        <p className="text-center text-sm text-gray-500">目前尚無課程</p>
      </div>
    );
  }

  return (
    <div className={isList ? "space-y-4" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"}>
      {activities.map((activity) => {
        const isSoldOut = activity.stock === 0;
        return (
          <article
            key={activity.id}
            className={`bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
              isList ? "flex flex-row sm:flex-row gap-4 p-4" : "flex flex-col"
            }`}
          >
            <div
              className={`relative bg-gray-200 flex items-center justify-center overflow-hidden ${
                isList ? "w-full sm:w-40 shrink-0 aspect-square" : "aspect-square"
              }`}
            >
              {activity.imageUrl ? (
                <NextImage
                  src={activity.imageUrl}
                  alt=""
                  fill
                  sizes={
                    isList ? "(max-width:640px) 100vw, 160px" : "(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
                  }
                  className="object-cover"
                />
              ) : (
                <LucideImage className="w-14 h-14 text-gray-400 relative z-[1]" strokeWidth={1.5} />
              )}
            </div>
            <div className="p-3 flex-1 flex flex-col min-h-0">
              <h3 className="font-medium text-gray-800 line-clamp-2 mb-2 text-sm">{activity.title}</h3>
              <p className="text-amber-600 font-semibold text-sm mb-2">
                NT$ {activity.price.toLocaleString()} 起
              </p>
              <Link
                href={activity.detailHref}
                className={`mt-auto w-full py-2.5 rounded-lg text-sm font-medium text-center transition-colors block ${
                  isSoldOut
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed pointer-events-none"
                    : "bg-amber-500 text-white hover:bg-amber-600"
                }`}
              >
                {isSoldOut ? "不開放報名" : "立即報名"}
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
