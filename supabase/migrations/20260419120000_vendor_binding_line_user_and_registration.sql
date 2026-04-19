-- 分站後台「商品管理／新增課程」閘道：供應商綁定與審核狀態
-- 與總站後台 rejectVendorMapping、補件（supplement_required）所用表一致，供分站以 service role 讀取。

create table if not exists public.line_user_mappings (
  id uuid primary key default gen_random_uuid(),
  line_uid text not null,
  role_type text not null,
  vendor_approval_status text,
  branch_site_merchant_id text,
  updated_at timestamptz default now()
);

comment on table public.line_user_mappings is 'LINE 使用者與角色對應；分站供應商審核見 vendor_approval_status（pending/approved/rejected）';
comment on column public.line_user_mappings.vendor_approval_status is 'pending | approved | rejected';
comment on column public.line_user_mappings.branch_site_merchant_id is '可選：對應分站 NEXT_PUBLIC_CLIENT_ID，便於分站直接查詢';

create unique index if not exists line_user_mappings_line_uid_role_uidx
  on public.line_user_mappings (line_uid, role_type);

create index if not exists line_user_mappings_branch_vendor_idx
  on public.line_user_mappings (branch_site_merchant_id)
  where branch_site_merchant_id is not null and role_type = 'vendor';

alter table public.line_user_mappings
  add column if not exists branch_site_merchant_id text;

-- -----------------------------------------------------------------------------

create table if not exists public.vendor_registration_applications (
  id uuid primary key default gen_random_uuid(),
  branch_site_merchant_id text not null,
  line_uid text,
  status text,
  supplement_flags jsonb,
  admin_review_note text,
  created_at timestamptz default now()
);

comment on table public.vendor_registration_applications is '分站供應商註冊申請；補件時 status=supplement_required';
comment on column public.vendor_registration_applications.status is '例：pending、submitted、supplement_required、approved';

create index if not exists vendor_registration_applications_branch_created_idx
  on public.vendor_registration_applications (branch_site_merchant_id, created_at desc);

alter table public.vendor_registration_applications
  add column if not exists line_uid text;
alter table public.vendor_registration_applications
  add column if not exists supplement_flags jsonb;
alter table public.vendor_registration_applications
  add column if not exists admin_review_note text;
