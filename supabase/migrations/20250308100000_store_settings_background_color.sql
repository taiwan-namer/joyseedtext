-- 背景色：前台整體頁面底色，與主色系分開
alter table store_settings
  add column if not exists background_color text default '#fafaf9';

comment on column store_settings.background_color is '前台頁面背景色（淺色柔和為宜），與主色系 primary_color 不同';
