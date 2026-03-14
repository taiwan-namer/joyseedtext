-- 基本資料：後台登入密碼（使用者自訂），以 hash 儲存
alter table store_settings
  add column if not exists admin_password_hash text default null;

comment on column store_settings.admin_password_hash is '後台登入密碼的 hash（scrypt），null 時使用環境變數 ADMIN_PASSWORD';
