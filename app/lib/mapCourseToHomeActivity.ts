import type { CourseForPublic } from "@/app/actions/productActions";
import type { Activity } from "@/app/lib/homeSectionTypes";
import { marketplaceCategoryDisplayLabel } from "@/lib/constants";

/** 將首頁課程 API 列轉成首頁卡片用 Activity（與熱門課程橫列一致） */
export function mapCourseToHomeActivity(c: CourseForPublic): Activity {
  const hasSale = c.salePrice != null && c.price != null && c.salePrice < c.price;
  const rawPrice = hasSale ? c.salePrice : c.price;
  const price = typeof rawPrice === "number" && Number.isFinite(rawPrice) ? rawPrice : 0;
  return {
    id: c.id,
    title: c.title,
    price,
    originalPrice: hasSale ? c.price ?? undefined : undefined,
    salePrice: hasSale ? c.salePrice ?? undefined : undefined,
    stock: c.capacity ?? 0,
    imageUrl: c.imageUrl ?? null,
    detailHref: `/course/${c.slug || c.id}`,
    ageTags: c.sidebarOptionLabels ?? c.ageTags ?? [],
    category: c.marketplace_category?.trim()
      ? marketplaceCategoryDisplayLabel(c.marketplace_category)
      : "課程",
  };
}
