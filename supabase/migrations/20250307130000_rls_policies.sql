-- RLS（Row Level Security）＋ Policy：僅允許後端 service_role 存取，anon 無法讀寫多租戶資料。
-- 後端使用 SUPABASE_SERVICE_ROLE_KEY 時會繞過 RLS，行為不變；此處防止誤用 anon key 或未來直接連線時洩漏他店資料。

-- store_settings
alter table public.store_settings enable row level security;

create policy "Backend service_role only"
  on public.store_settings
  for all
  using ((auth.jwt() ->> 'role') = 'service_role')
  with check ((auth.jwt() ->> 'role') = 'service_role');

-- course_intro_posts
alter table public.course_intro_posts enable row level security;

create policy "Backend service_role only"
  on public.course_intro_posts
  for all
  using ((auth.jwt() ->> 'role') = 'service_role')
  with check ((auth.jwt() ->> 'role') = 'service_role');

-- bookings
alter table public.bookings enable row level security;

create policy "Backend service_role only"
  on public.bookings
  for all
  using ((auth.jwt() ->> 'role') = 'service_role')
  with check ((auth.jwt() ->> 'role') = 'service_role');

-- classes（若表已存在）
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'classes') then
    execute 'alter table public.classes enable row level security';
    execute 'create policy "Backend service_role only" on public.classes for all using ((auth.jwt() ->> ''role'') = ''service_role'') with check ((auth.jwt() ->> ''role'') = ''service_role'')';
  end if;
end $$;

-- members（若表已存在）
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'members') then
    execute 'alter table public.members enable row level security';
    execute 'create policy "Backend service_role only" on public.members for all using ((auth.jwt() ->> ''role'') = ''service_role'') with check ((auth.jwt() ->> ''role'') = ''service_role'')';
  end if;
end $$;

comment on policy "Backend service_role only" on public.store_settings is '僅 service_role（後端）可存取，anon 無法讀寫';
comment on policy "Backend service_role only" on public.course_intro_posts is '僅 service_role（後端）可存取，anon 無法讀寫';
comment on policy "Backend service_role only" on public.bookings is '僅 service_role（後端）可存取，anon 無法讀寫';
