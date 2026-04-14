import type { CourseForPublic } from "@/app/actions/productActions";
import { isSidebarAgeRangeToken } from "@/lib/sidebarAgeOptions";

/** 首頁熱門／新上架等區塊用的課程卡片資料（可由 Server 預先 map） */
export type HomePageActivity = {
  id: string;
  title: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
  detailHref: string;
  ageTags: string[];
  category?: string;
  description?: string;
  badgeNew?: boolean;
  badgeHot?: boolean;
  badgeFeatured?: boolean;
  /** 與 /courses?category= 相同欄位，供精選分館篩選 */
  marketplaceCategory?: string | null;
  /** DB `sidebar_option` 原始字串（可額外標記分館名稱等） */
  sidebarOptionValues?: string[];
};

/** 課程是否屬於該精選分館（主題分類或 sidebar 自訂標記） */
export function homeActivityMatchesFeaturedCategory(
  activity: HomePageActivity,
  categoryName: string
): boolean {
  const n = categoryName.trim();
  if (!n) return true;
  if ((activity.marketplaceCategory ?? "").trim() === n) return true;
  for (const v of activity.sidebarOptionValues ?? []) {
    const s = String(v).trim();
    if (!s || isSidebarAgeRangeToken(s)) continue;
    if (s === n) return true;
    if (s.length >= 2 && n.length >= 2 && (s.includes(n) || n.includes(s))) return true;
  }
  return false;
}

export function mapCourseToHomeActivity(c: CourseForPublic): HomePageActivity {
  const price =
    c.salePrice != null && c.price != null && c.salePrice < c.price ? c.salePrice : c.price ?? 0;
  return {
    id: c.id,
    title: c.title,
    price,
    stock: c.capacity ?? 0,
    imageUrl: c.imageUrl?.trim() ? c.imageUrl.trim() : null,
    detailHref: `/course/${c.slug ?? c.id}`,
    ageTags: c.sidebarOptionLabels ?? c.ageTags ?? [],
    category: "課程",
    description: c.courseIntro
      ? c.courseIntro.slice(0, 80) + (c.courseIntro.length > 80 ? "…" : "")
      : undefined,
    badgeNew: false,
    badgeHot: false,
    badgeFeatured: false,
    marketplaceCategory: c.marketplace_category ?? null,
    sidebarOptionValues: c.sidebarOptionLabels ?? [],
  };
}

/** 與首頁「新上架課程」相同：隨機抽樣最多 limit 筆（不修改傳入陣列本體） */
export function pickRandomSubset<T>(list: T[], limit: number): T[] {
  if (list.length <= limit) return [...list];
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next.slice(0, limit);
}
