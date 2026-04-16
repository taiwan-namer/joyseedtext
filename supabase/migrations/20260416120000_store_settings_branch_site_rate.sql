-- 總站於後台為各供應商設定之分站抽成比例（%）；與總站 marketplace 課程抽成 commission_rate_percent 分開。
-- 分站後台「對帳明細」中本站結帳訂單依供應商列之 branch_site_rate_percent 計算傭金。
alter table public.store_settings
  add column if not exists branch_site_rate_percent numeric(6, 2) not null default 0
  check (branch_site_rate_percent >= 0 and branch_site_rate_percent <= 100);

comment on column public.store_settings.branch_site_rate_percent is
  '總站設定的分站抽成比例（0–100）；本站結帳對帳依供應商 merchant_id 此欄計算，與 commission_rate_percent（總站購買）分開';
