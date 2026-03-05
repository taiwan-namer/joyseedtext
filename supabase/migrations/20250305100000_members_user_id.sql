-- 為 members 新增 user_id，對應 auth.users.id，供 RLS 與身份對應使用
alter table members add column if not exists user_id uuid references auth.users(id) on delete set null;
comment on column members.user_id is '對應 Supabase Auth auth.users.id，用於 RLS 與身份對應';
