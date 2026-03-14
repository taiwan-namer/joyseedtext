/** 首頁熱門課程卡片型別（與 productActions getCoursesForHomepage 對應） */
export type Activity = {
  id: string;
  title: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
  detailHref: string;
  ageTags: string[];
  category?: string;
  description?: string;
};
