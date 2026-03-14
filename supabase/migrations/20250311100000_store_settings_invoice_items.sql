-- 發票品項：後台可設定的預設品名、單位、固定金額（選填）。格式 [{ "name": "課程預約", "word": "堂" }, { "name": "服務費", "word": "式", "amount": 50 }]
alter table store_settings
  add column if not exists invoice_items jsonb default null;

comment on column store_settings.invoice_items is '發票品項設定：[{ name, word, amount? }]，amount 為選填固定金額（其餘金額歸第一筆或唯一一筆）';
