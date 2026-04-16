"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { Image as LucideImage } from "lucide-react";
import { getCoursesForHomepage } from "@/app/actions/productActions";
import type { HomePageActivity } from "@/lib/homePageActivity";
import { mapCourseToHomeActivity } from "@/lib/homePageActivity";
import { CourseCoverBadgesCompact } from "@/app/components/CourseCoverBadges";

type Props = {
  blockStyle?: React.CSSProperties;
  /** 父層（BranchSiteHomeView）已載入時傳入，避免與熱門課程重複請求與載入後高度突變 */
  prefetchedActivities?: HomePageActivity[] | null;
  prefetchedLoading?: boolean;
};

const TOTAL_SLOTS = 7;

function pickPrimaryAgeTag(tags: string[] | undefined): string | null {
  const t = (tags ?? []).map((x) => String(x).trim()).filter(Boolean);
  return t[0] ?? null;
}

export default function HomeFeaturedCoursesOnePlusSix({
  blockStyle,
  prefetchedActivities,
  prefetchedLoading,
}: Props) {
  const useParentData = prefetchedActivities !== undefined;
  const [activities, setActivities] = useState<HomePageActivity[]>([]);
  const [loading, setLoading] = useState(!useParentData);

  useEffect(() => {
    if (useParentData) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getCoursesForHomepage();
        if (!cancelled && res.success) {
          setActivities(res.data.map(mapCourseToHomeActivity));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [useParentData]);

  const resolvedActivities = useParentData ? (prefetchedActivities ?? []) : activities;
  const resolvedLoading = useParentData ? (prefetchedLoading ?? false) : loading;

  const slots = useMemo<(HomePageActivity | null)[]>(() => {
    const out: (HomePageActivity | null)[] = resolvedActivities.slice(0, TOTAL_SLOTS);
    while (out.length < TOTAL_SLOTS) out.push(null);
    return out;
  }, [resolvedActivities]);

  const main = slots[0];
  const secondary = slots.slice(1);

  const renderCard = (activity: HomePageActivity | null, size: "main" | "small", idx: number) => {
    const wClass = size === "main" ? "w-full md:w-[420px] lg:w-[520px]" : "w-full";
    const card = (
      <div className={`group rounded-2xl overflow-hidden bg-white/85 shadow-sm ${wClass}`}>
        <div className="relative aspect-square bg-gray-100 overflow-hidden">
          {activity?.imageUrl ? (
            <NextImage src={activity.imageUrl} alt={activity.title} fill sizes="(max-width:1024px) 280px, 520px" className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <LucideImage className="h-10 w-10" strokeWidth={1.5} />
            </div>
          )}
          {activity ? (
            <CourseCoverBadgesCompact
              isFull={activity.stock === 0}
              badgeNew={!!activity.badgeNew}
              badgeHot={!!activity.badgeHot}
              badgeFeatured={!!activity.badgeFeatured}
              primaryAgeTag={pickPrimaryAgeTag(activity.ageTags)}
            />
          ) : null}
        </div>
      </div>
    );

    if (!activity) return <div key={`placeholder-${idx}`}>{card}</div>;
    return (
      <Link key={activity.id} href={activity.detailHref} prefetch className="block">
        {card}
      </Link>
    );
  };

  return (
    <section className="w-full py-6" style={blockStyle}>
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">精選課程</h2>
      </div>
      <div className="max-w-7xl mx-auto px-4">
        {resolvedLoading ? (
          <div className="text-sm text-gray-500 min-h-[320px] flex items-start pt-2">載入中…</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[minmax(0,520px)_minmax(0,1fr)] md:gap-5 items-start">
            <div>{renderCard(main, "main", 0)}</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {secondary.map((activity, i) => renderCard(activity, "small", i + 1))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
