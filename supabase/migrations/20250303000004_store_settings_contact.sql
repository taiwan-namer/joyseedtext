-- 聯絡資訊：信箱、電話、地址、地址 Google 地圖連結（首頁聯絡方式與地圖用）
alter table store_settings
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists contact_address text,
  add column if not exists address_google_url text;

comment on column store_settings.contact_email is '聯絡信箱';
comment on column store_settings.contact_phone is '聯絡電話';
comment on column store_settings.contact_address is '聯絡地址（文字）';
comment on column store_settings.address_google_url is 'Google 地圖連結（可為嵌入用 embed 網址或一般分享連結）';
