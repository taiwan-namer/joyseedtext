-- 請在 Supabase Dashboard → SQL Editor 貼上並執行此段
-- 若 store_settings 表尚未建立，會先建表再加欄位；若已存在則只補加缺少的欄位

-- 1. 建立 store_settings 表（若不存在）
create table if not exists store_settings (
  merchant_id text primary key,
  site_name text not null default '童趣島',
  primary_color text not null default '#F59E0B',
  updated_at timestamptz default now()
);

comment on table store_settings is '店家基本資料：網站名稱、主色系、FAQ、社群連結，依 merchant_id 區分';

-- 2. 常見問題（FAQ）欄位
alter table store_settings
  add column if not exists faq_items jsonb default null;

comment on column store_settings.faq_items is '常見問題 [{ id, question, answer }]，null 時前台用預設';

-- 3. 社群連結欄位
alter table store_settings
  add column if not exists social_fb_url text,
  add column if not exists social_ig_url text,
  add column if not exists social_line_url text;

comment on column store_settings.social_fb_url is 'Facebook 粉絲頁/連結';
comment on column store_settings.social_ig_url is 'Instagram 連結';
comment on column store_settings.social_line_url is 'LINE 官方帳號/連結';

-- 4. 聯絡資訊欄位
alter table store_settings
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists contact_address text,
  add column if not exists address_google_url text;

comment on column store_settings.contact_email is '聯絡信箱';
comment on column store_settings.contact_phone is '聯絡電話';
comment on column store_settings.contact_address is '聯絡地址（文字）';
comment on column store_settings.address_google_url is 'Google 地圖連結（可為嵌入用 embed 網址或一般分享連結）';
