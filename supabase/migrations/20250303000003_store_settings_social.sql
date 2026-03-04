-- 社群連結：FB、IG、LINE 網址，供首頁下方顯示
alter table store_settings
  add column if not exists social_fb_url text,
  add column if not exists social_ig_url text,
  add column if not exists social_line_url text;

comment on column store_settings.social_fb_url is 'Facebook 粉絲頁/連結';
comment on column store_settings.social_ig_url is 'Instagram 連結';
comment on column store_settings.social_line_url is 'LINE 官方帳號/連結';
