-- 在 Supabase Dashboard → SQL Editor 執行此段，為 bookings 加上 slot_date / slot_time
-- 報名進度查詢（點名簿）依日期／場次篩選時需要這兩個欄位

alter table bookings add column if not exists slot_date date;
alter table bookings add column if not exists slot_time time;
alter table bookings add column if not exists allergy_or_special_note text;
alter table bookings add column if not exists kid_name text;
alter table bookings add column if not exists kid_age text;

create index if not exists idx_bookings_slot on bookings(class_id, slot_date, slot_time);

comment on column bookings.slot_date is '報名場次日期 YYYY-MM-DD';
comment on column bookings.slot_time is '報名場次時間 HH:MM';
comment on column bookings.allergy_or_special_note is '有無過敏或特殊疾病（購買頁填寫）';
comment on column bookings.kid_name is '小孩暱稱（購買頁填寫）';
comment on column bookings.kid_age is '小孩年齡（購買頁填寫）';

-- 更新 RPC：下單時可寫入 slot_date / slot_time / allergy / kid_name / kid_age
create or replace function create_booking_and_decrement_capacity(
  p_merchant_id text,
  p_member_email text,
  p_class_id uuid,
  p_parent_name text default null,
  p_parent_phone text default null,
  p_slot_date date default null,
  p_slot_time time default null,
  p_allergy_note text default null,
  p_kid_name text default null,
  p_kid_age text default null
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

  insert into bookings (merchant_id, member_email, parent_name, parent_phone, phone, class_id, status, slot_date, slot_time, allergy_or_special_note, kid_name, kid_age)
  values (
    p_merchant_id,
    p_member_email,
    coalesce(nullif(trim(p_parent_name), ''), '—'),
    nullif(trim(p_parent_phone), ''),
    coalesce(nullif(trim(p_parent_phone), ''), ''),
    p_class_id,
    'upcoming',
    p_slot_date,
    p_slot_time,
    nullif(trim(p_allergy_note), ''),
    nullif(trim(p_kid_name), ''),
    nullif(trim(p_kid_age), '')
  )
  returning id into v_booking_id;

  update classes
  set capacity = capacity - 1
  where id = p_class_id and merchant_id = p_merchant_id;

  return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
end;
$$;
