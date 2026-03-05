-- bookings table and RPC for create_booking_and_decrement_capacity
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

-- If bookings already existed without these columns, add them
alter table bookings add column if not exists merchant_id text;
alter table bookings add column if not exists member_email text;
alter table bookings add column if not exists parent_name text;
alter table bookings add column if not exists parent_phone text;
update bookings set merchant_id = coalesce(merchant_id, '') where merchant_id is null;
update bookings set member_email = coalesce(member_email, '') where member_email is null;
alter table bookings alter column merchant_id set not null;
alter table bookings alter column member_email set not null;

create index if not exists idx_bookings_merchant_id on bookings(merchant_id);
create index if not exists idx_bookings_member_email on bookings(member_email);
create index if not exists idx_bookings_class_id on bookings(class_id);
create index if not exists idx_bookings_created_at on bookings(created_at desc);

-- RPC: create booking and decrement class capacity (with parent_name, parent_phone)
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
