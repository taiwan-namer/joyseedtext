-- 老師端課程可記錄「要綁定的總站列表課」；儲存時由應用程式更新總站該筆的 inventory_*

alter table public.classes
  add column if not exists hq_listing_merchant_id text,
  add column if not exists hq_listing_class_id uuid;

comment on column public.classes.hq_listing_merchant_id is '老師填寫：總站 NEXT_PUBLIC_CLIENT_ID（列表課所屬商家）';
comment on column public.classes.hq_listing_class_id is '老師填寫：總站列表課 classes.id；儲存後寫入該列 inventory_* 指向本課';
