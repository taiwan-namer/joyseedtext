-- 請在 Supabase Dashboard → SQL Editor 貼上並執行
alter table store_settings
  add column if not exists frontend_settings jsonb default null;

comment on column store_settings.frontend_settings is '首頁上方設定：{ heroImageUrl, heroTitle, carouselItems }';
