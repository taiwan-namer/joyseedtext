-- 前台設定：首頁大圖、大圖文字、輪播圖（jsonb）
alter table store_settings
  add column if not exists frontend_settings jsonb default null;

comment on column store_settings.frontend_settings is '首頁上方設定：{ heroImageUrl, heroTitle, carouselItems: [{ id, title, subtitle, imageUrl }] }';
