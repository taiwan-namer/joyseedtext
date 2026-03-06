-- 關於我們區塊背景色（首頁「關於我們」區塊底色，與頁面背景色分開）
alter table store_settings
  add column if not exists about_section_background_color text default '#ffffff';

comment on column store_settings.about_section_background_color is '首頁「關於我們」區塊背景色，與頁面背景色、主色系分開';
