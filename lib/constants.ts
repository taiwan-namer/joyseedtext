/**
 * 分站課程表單常數。
 * 總站主題分類僅來自 `store_settings.global_categories`（固定 {@link GLOBAL_CATEGORIES_SOURCE_MERCHANT_ID}，與 model 總站一致），
 * 經 `/api/global-categories`；此檔不寫死「主題標籤文字」清單。
 */

/** 總站 `store_settings` 帶有 global_categories 的列（與 model 專案約定之 merchant_id） */
export const GLOBAL_CATEGORIES_SOURCE_MERCHANT_ID = "model";

/** 首頁「熱門課程」區塊僅向 DB 索取筆數（排除 course_intro / gallery 等大欄位） */
export const HOMEPAGE_COURSES_FETCH_LIMIT = 12;

/** 課程列表頁每頁筆數（與 RPC list_classes_for_merchant_page 上限內一致） */
export const COURSES_LIST_PAGE_SIZE = 12;

/** 總站主題 API 回傳：去空白、去重，保留首次出現順序 */
export function dedupeCategoryList(categories: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of categories) {
    const t = (c ?? "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** 上課地區選項 */
export const CITY_REGIONS = [
  "台北市",
  "新北市",
  "桃園市",
  "台中市",
  "台南市",
  "高雄市",
  "基隆市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "台東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
] as const;
