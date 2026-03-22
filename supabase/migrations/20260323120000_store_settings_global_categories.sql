-- 總站主題標籤：供課程 marketplace_category、/api/global-categories、後台下拉與列表篩選對齊。
-- 慣例：merchant_id = 'tongqudao_main' 的那一列為總站設定來源（見 getGlobalCategoriesFromMain）。
-- 儲存格式：jsonb，可為
--   - 字串陣列：["標籤一","標籤二",...]
--   - 或物件：{ "categories": [ 字串 | { "name": "...", "label": "..." }, ... ] }

alter table store_settings
  add column if not exists global_categories jsonb default null;

comment on column store_settings.global_categories is
  '總站／多店共用主題標籤（JSONB）。字串陣列，或 { categories: [...] }；元素可為字串或 { name, label }。getGlobalCategoriesFromMain 讀取 merchant_id=tongqudao_main。';
