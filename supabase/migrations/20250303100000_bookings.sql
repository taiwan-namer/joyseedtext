-- 訂單表：多租戶，關聯 classes，狀態 upcoming / completed / cancelled
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  merchant_id text not null,
  member_email text not null,
  parent_name text,
  parent_phone text,
  class_id uuid not null references classes(id) on delete restrict,
  status text not null default 'upcoming' check (status in ('upcoming', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table bookings add column if not exists parent_name text;
alter table bookings add column if not exists parent_phone text;

create index if not exists idx_bookings_merchant_id on bookings(merchant_id);
create index if not exists idx_bookings_member_email on bookings(member_email);
create index if not exists idx_bookings_class_id on bookings(class_id);
create index if not exists idx_bookings_created_at on bookings(created_at desc);

comment on table bookings is '課程訂單，依 merchant_id 多租戶';
comment on column bookings.status is 'upcoming=即將上課/已購買, completed=歷史訂單, cancelled=已取消';

-- RPC：下單並扣庫存（含 parent_name, parent_phone）
create or replace function create_booking_and_decrement_capacity(
  p_merchant_id text,
  p_member_email text,
  p_class_id uuid,
  p_parent_name text default null,
  p_parent_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_booking_id uuid;
begin
  select c.capacity into v_capacity
  from classes c
  where c.id = p_class_id and c.merchant_id = p_merchant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', '課程不存在或非本店家');
  end if;

  if v_capacity is null or v_capacity < 1 then
    return jsonb_build_object('ok', false, 'error', '名額已滿');
  end if;

  insert into bookings (merchant_id, member_email, parent_name, parent_phone, phone, class_id, status)
  values (
    p_merchant_id,
    p_member_email,
    coalesce(nullif(trim(p_parent_name), ''), '—'),
    nullif(trim(p_parent_phone), ''),
    coalesce(nullif(trim(p_parent_phone), ''), ''),
    p_class_id,
    'upcoming'
  )
  returning id into v_booking_id;

  update classes
  set capacity = capacity - 1
  where id = p_class_id and merchant_id = p_merchant_id;

  return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
end;
$$;

comment on function create_booking_and_decrement_capacity is '下單並扣庫存，同一交易';
