"use client";

/** 課程主圖／詳情側欄：年齡區間（藍底白字圓角，與參考圖一致） */
export function CourseAgeRangePill({
  children,
  compact,
  size = "md",
}: {
  children: string;
  compact?: boolean;
  /** md：列表主圖；lg：課程詳情側欄 */
  size?: "md" | "lg";
}) {
  const box =
    compact ? "px-2 py-0.5 text-[10px]" : size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-[11px]";
  return <span className={`rounded-full bg-blue-500 font-bold text-white shadow-sm ${box}`}>{children}</span>;
}

/** 課程主圖左上角標籤（與 /courses 圖 2 風格一致） */
export function CourseCoverBadges({
  isFull,
  badgeNew,
  badgeHot,
  badgeFeatured,
  primaryAgeTag,
}: {
  isFull: boolean;
  badgeNew: boolean;
  badgeHot: boolean;
  badgeFeatured: boolean;
  primaryAgeTag: string | null;
}) {
  return (
    <div className="absolute left-0 top-0 z-10 flex max-w-[calc(100%-3rem)] flex-wrap gap-1 p-2">
      {isFull ? (
        <>
          <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">已額滿</span>
          {primaryAgeTag ? <CourseAgeRangePill>{primaryAgeTag}</CourseAgeRangePill> : null}
        </>
      ) : (
        <>
          {badgeNew ? (
            <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">新上架</span>
          ) : null}
          {badgeFeatured ? (
            <span className="rounded-md bg-amber-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">精選</span>
          ) : null}
          {badgeHot ? (
            <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">熱門</span>
          ) : null}
          {primaryAgeTag ? <CourseAgeRangePill>{primaryAgeTag}</CourseAgeRangePill> : null}
        </>
      )}
    </div>
  );
}

/** 首頁卡片用（略小區塊、同色系） */
export function CourseCoverBadgesCompact({
  isFull,
  badgeNew,
  badgeHot,
  badgeFeatured,
  primaryAgeTag,
}: {
  isFull: boolean;
  badgeNew: boolean;
  badgeHot: boolean;
  badgeFeatured: boolean;
  /** 與後台 age_min～age_max 一致，如 2-10歲 */
  primaryAgeTag?: string | null;
}) {
  if (isFull) {
    return (
      <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-4rem)] flex-wrap gap-1">
        <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">已額滿</span>
        {primaryAgeTag ? <CourseAgeRangePill compact>{primaryAgeTag}</CourseAgeRangePill> : null}
      </div>
    );
  }
  return (
    <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-4rem)] flex-wrap gap-1">
      {badgeNew ? (
        <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">新上架</span>
      ) : null}
      {badgeFeatured ? (
        <span className="rounded-md bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">精選</span>
      ) : null}
      {badgeHot ? (
        <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">熱門</span>
      ) : null}
      {primaryAgeTag ? <CourseAgeRangePill compact>{primaryAgeTag}</CourseAgeRangePill> : null}
    </div>
  );
}
