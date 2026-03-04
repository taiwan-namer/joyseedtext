-- 店家基本資料（網站名字、主色系），每 merchant 一筆，供前台與後台讀取
create table if not exists store_settings (
  merchant_id text primary key,
  site_name text not null default '童趣島',
  primary_color text not null default '#F59E0B',
  updated_at timestamptz default now()
);

comment on table store_settings is '店家基本資料：網站名稱、主色系，依 merchant_id 區分';
