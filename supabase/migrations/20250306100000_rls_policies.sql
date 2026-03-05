-- Phase 2：啟用 RLS，讓 anon 僅能讀取公開表，authenticated（後台 requireAdmin）可寫入。
-- 目前「僅限本 merchant」仍由 app 以 getMerchantId() 過濾；Phase 3 可改為 JWT claim 或 session 變數在 policy 內限制。

-- store_settings：公開讀（anon SELECT）；後台寫（authenticated 全權限）
alter table store_settings enable row level security;

create policy "store_settings_anon_select"
  on store_settings for select
  to anon
  using (true);

create policy "store_settings_authenticated_all"
  on store_settings for all
  to authenticated
  using (true)
  with check (true);

-- course_intro_posts：同上
alter table course_intro_posts enable row level security;

create policy "course_intro_posts_anon_select"
  on course_intro_posts for select
  to anon
  using (true);

create policy "course_intro_posts_authenticated_all"
  on course_intro_posts for all
  to authenticated
  using (true)
  with check (true);

-- classes：公開讀；後台寫
alter table classes enable row level security;

create policy "classes_anon_select"
  on classes for select
  to anon
  using (true);

create policy "classes_authenticated_all"
  on classes for all
  to authenticated
  using (true)
  with check (true);

-- bookings：不給 anon；後台與會員用 authenticated
alter table bookings enable row level security;

create policy "bookings_authenticated_all"
  on bookings for all
  to authenticated
  using (true)
  with check (true);

-- members：不給 anon；authenticated 可讀寫（後台管理、登入同步）
alter table members enable row level security;

create policy "members_authenticated_all"
  on members for all
  to authenticated
  using (true)
  with check (true);
