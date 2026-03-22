-- 總站預設主題（global_categories）；分站 UI 僅讀此欄，不在程式寫死清單。
-- 新環境可插入 tongqudao_main；既有列則更新 global_categories（不動其他欄位）。

insert into store_settings (merchant_id, global_categories, updated_at)
values (
  'tongqudao_main',
  '[
    "藝術花園",
    "科學秘境",
    "音樂湖畔",
    "烘焙小屋",
    "感知之森",
    "語言之丘",
    "體能草原",
    "世界之窗"
  ]'::jsonb,
  now()
)
on conflict (merchant_id) do update set
  global_categories = excluded.global_categories,
  updated_at = now();
