-- 常見問題列表（JSON 陣列），對應首頁下方 FAQ；無則前台使用預設
alter table store_settings
  add column if not exists faq_items jsonb default null;

comment on column store_settings.faq_items is '常見問題 [{ id, question, answer }]，null 時前台用預設';
