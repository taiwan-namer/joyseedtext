/**
 * 分站課程表單常數（與總站資料庫對齊，選項寫死、不從 API 撈取）
 */

/** 首頁「熱門課程」區塊僅向 DB 索取筆數（排除 course_intro / gallery 等大欄位） */
export const HOMEPAGE_COURSES_FETCH_LIMIT = 12;

/** 課程列表頁每頁筆數（與 RPC list_classes_for_merchant_page 上限內一致） */
export const COURSES_LIST_PAGE_SIZE = 12;

/**
 * 總站主題分類（八大主題）
 * 與課程列表篩選、classes.marketplace_category、後台新增課程下拉選單對齊。
 * 若總站 store_settings.global_categories 另有增補，UI 會在八大之後附加（見 mergeMarketplaceCategoryOptions）。
 */
export const MARKETPLACE_CATEGORIES = [
  "藝術創作",
  "體能運動",
  "音樂律動",
  "烘培小屋",
  "科學邏輯",
  "語言表達",
  "戲劇表演",
  "自然探索",
] as const;

/** 合併：固定八大主題優先，再接上 API／DB 多出來的分類（去重） */
export function mergeMarketplaceCategoryOptions(extraFromRemote: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of MARKETPLACE_CATEGORIES) {
    const t = c.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  for (const c of extraFromRemote) {
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
