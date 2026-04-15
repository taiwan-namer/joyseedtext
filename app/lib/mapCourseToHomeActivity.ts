import type { CourseForPublic } from "@/app/actions/productActions";
import type { Activity } from "@/app/lib/homeSectionTypes";

/** 將首頁課程 API 列轉成首頁卡片用 Activity（與熱門課程橫列一致） */
export function mapCourseToHomeActivity(c: CourseForPublic): Activity {
  const price =
    c.salePrice != null && c.price != null && c.salePrice < c.price ? c.salePrice : c.price ?? 0;
  return {
    id: c.id,
    title: c.title,
    price,
    stock: c.capacity ?? 0,
    imageUrl: c.imageUrl ?? null,
    detailHref: `/course/${c.slug || c.id}`,
    ageTags: c.sidebarOptionLabels ?? c.ageTags ?? [],
    category: c.marketplace_category?.trim() ? c.marketplace_category.trim() : "課程",
  };
}
