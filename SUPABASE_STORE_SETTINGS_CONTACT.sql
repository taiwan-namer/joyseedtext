-- 請在 Supabase Dashboard → SQL Editor 貼上並執行此段
-- 僅新增聯絡資訊欄位（信箱、電話、地址），解決 contact_address 等 schema cache 錯誤

alter table store_settings
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists contact_address text;

comment on column store_settings.contact_email is '聯絡信箱';
comment on column store_settings.contact_phone is '聯絡電話';
comment on column store_settings.contact_address is '聯絡地址（文字）';
