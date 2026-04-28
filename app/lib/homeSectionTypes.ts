/** 首頁熱門課程卡片型別（與 productActions getCoursesForHomepage 對應） */
export type Activity = {
  id: string;
  title: string;
  price: number;
  /** 原價（有特價時保留顯示） */
  originalPrice?: number;
  /** 特價（小於原價時才有值） */
  salePrice?: number;
  stock: number;
  imageUrl?: string | null;
  detailHref: string;
  ageTags: string[];
  category?: string;
  description?: string;
  badgeNew?: boolean;
  badgeHot?: boolean;
  badgeFeatured?: boolean;
};
