/**
 * 分站課程表單常數。
 *
 * **總站 vs 分站（`store_settings`）**
 * - **總站 marketplace**：`merchant_id = "model"`（與 model 專案同一列），含 `global_categories`、可作為從總站複製來源的 `frontend_settings`（首頁大圖、輪播、`layout_blocks` 畫布等）。
 * - **本分站**：首頁畫布與前台設定讀寫 **`merchant_id = NEXT_PUBLIC_CLIENT_ID`**（每部署一站一列），**不是** `"model"`；誤用總站 id 會改到總站資料。
 *
 * 總站主題分類僅來自 `store_settings.global_categories`（固定 {@link GLOBAL_CATEGORIES_SOURCE_MERCHANT_ID}），
 * 經 `/api/global-categories`；此檔不寫死「主題標籤文字」清單。
 */

/** 總站 `store_settings` 列（與 model 專案約定之 merchant_id）：`global_categories`、`frontend_settings` 範本來源等 */
export const GLOBAL_CATEGORIES_SOURCE_MERCHANT_ID = "model";

/**
 * 與 model 總站文件中的 `MARKETPLACE_MERCHANT_ID` 同義（總站列 id）。
 * 複製畫布時：從此列的 `frontend_settings` 合入分站該 `merchant_id` 之列；僅複製 `layout_blocks` 時注意圖片 URL／R2 權限。
 */
export const MARKETPLACE_MERCHANT_ID = GLOBAL_CATEGORIES_SOURCE_MERCHANT_ID;

/** 首頁「熱門課程」區塊僅向 DB 索取筆數（排除 course_intro / gallery 等大欄位） */
export const HOMEPAGE_COURSES_FETCH_LIMIT = 12;

/** 課程列表頁每頁筆數（與 `getCoursesForListpage` 上限內一致） */
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
