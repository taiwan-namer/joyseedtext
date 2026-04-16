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

function pickAgePreview(tags: string[] | undefined): string[] {
  const t = (tags ?? []).map((x) => String(x).trim()).filter(Boolean);
  return t.slice(0, 3);
}

function EmptyLayoutMock({ variant }: { variant: "grid" | "list" }) {
  if (variant === "grid") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 opacity-70" aria-hidden>
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
    <div className="space-y-2.5 opacity-70" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-row items-center gap-3 rounded-2xl border-2 border-dashed border-amber-300/90 bg-amber-50/40 p-3"
        >
          <div className="h-[72px] w-[72px] shrink-0 rounded-xl bg-amber-100/80 border border-amber-200/60" />
          <div className="flex-1 min-w-0 flex flex-col gap-2 py-0.5">
            <div className="h-3 rounded bg-amber-200/70 w-4/5 max-w-[200px]" />
            <div className="h-2 rounded bg-amber-100/80 w-1/3 max-w-[100px]" />
            <div className="flex gap-1.5">
              <div className="h-5 w-12 rounded-full bg-amber-100/80" />
              <div className="h-5 w-14 rounded-full bg-amber-100/80" />
            </div>
          </div>
          <div className="h-9 w-20 shrink-0 rounded-full bg-amber-200/50" />
        </div>
      ))}
    </div>
  );
}

/**
 * 熱門課程「網格」與「列表」版型；列表為固定縮圖寬，避免窄畫布時圖片撐滿變形。
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
      <div className={isList ? "space-y-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"}>
        {Array.from({ length: isList ? 3 : 4 }).map((_, i) => (
          <div
            key={i}
            className={
              isList
                ? "flex flex-row items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm animate-pulse"
                : "bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm flex flex-col animate-pulse"
            }
          >
            {isList ? (
              <>
                <div className="h-[72px] w-[72px] shrink-0 rounded-xl bg-gray-200" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="h-9 w-24 shrink-0 rounded-full bg-gray-200" />
              </>
            ) : (
              <>
                <div className="aspect-square bg-gray-200" />
                <div className="p-3 space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-8 bg-gray-200 rounded-lg w-full mt-2" />
                </div>
              </>
            )}
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
              ? "列表版型：左方固定縮圖、右側標題與報名；有上架課程後會自動帶入。"
              : "網格版型：多欄卡片；有上架課程後會自動帶入。"}
          </p>
        ) : null}
        <EmptyLayoutMock variant={variant} />
        <p className="text-center text-sm text-gray-500">目前尚無課程</p>
      </div>
    );
  }

  if (isList) {
    return (
      <ul className="space-y-3 list-none p-0 m-0">
        {activities.map((activity) => {
          const isSoldOut = activity.stock === 0;
          const agePreview = pickAgePreview(activity.ageTags);
          return (
            <li key={activity.id}>
              <article className="group flex flex-row items-stretch gap-3 rounded-2xl border border-gray-100/90 bg-white p-3 shadow-sm transition-shadow hover:shadow-md hover:border-amber-100">
                <div className="relative h-[72px] w-[72px] sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                  {activity.imageUrl ? (
                    <NextImage
                      src={activity.imageUrl}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <LucideImage className="w-9 h-9 text-gray-400" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-0.5">
                  <h3 className="text-sm font-semibold leading-snug text-gray-900 line-clamp-2 sm:pr-2">
                    {activity.title}
                  </h3>
                  {agePreview.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {agePreview.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex max-w-full truncate rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900/90 ring-1 ring-amber-200/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-sm font-semibold text-amber-600 tabular-nums">
                    NT$ {activity.price.toLocaleString()} 起
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch justify-center self-center pl-1">
                  <Link
                    href={activity.detailHref}
                    prefetch
                    className={`inline-flex min-h-[2.25rem] min-w-[4.5rem] items-center justify-center rounded-full px-4 text-xs font-semibold transition-colors sm:text-sm ${
                      isSoldOut
                        ? "cursor-not-allowed bg-gray-100 text-gray-400 pointer-events-none"
                        : "bg-amber-500 text-white hover:bg-amber-600"
                    }`}
                  >
                    {isSoldOut ? "額滿" : "報名"}
                  </Link>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {activities.map((activity) => {
        const isSoldOut = activity.stock === 0;
        return (
          <article
            key={activity.id}
            className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="relative aspect-square bg-gray-200">
              {activity.imageUrl ? (
                <NextImage
                  src={activity.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <LucideImage className="w-14 h-14 text-gray-400" strokeWidth={1.5} />
                </div>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <h3 className="mb-2 line-clamp-2 text-sm font-medium text-gray-800">{activity.title}</h3>
              <p className="mb-2 text-sm font-semibold text-amber-600 tabular-nums">
                NT$ {activity.price.toLocaleString()} 起
              </p>
              <Link
                href={activity.detailHref}
                prefetch
                className={`mt-auto block w-full rounded-lg py-2.5 text-center text-sm font-medium transition-colors ${
                  isSoldOut
                    ? "cursor-not-allowed bg-gray-200 text-gray-500 pointer-events-none"
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
