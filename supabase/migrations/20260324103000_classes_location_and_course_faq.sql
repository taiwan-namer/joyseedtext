alter table classes
  add column if not exists activity_address text,
  add column if not exists map_embed_html text,
  add column if not exists nearby_transport text,
  add column if not exists course_faq_items jsonb default null;

comment on column classes.activity_address is '課程活動詳細地址（全文頁顯示）';
comment on column classes.map_embed_html is '課程地圖嵌入 HTML（Google Maps iframe）';
comment on column classes.nearby_transport is '課程附近大眾運輸資訊（多行文字）';
comment on column classes.course_faq_items is '該課程常見問題 [{question, answer}]';
