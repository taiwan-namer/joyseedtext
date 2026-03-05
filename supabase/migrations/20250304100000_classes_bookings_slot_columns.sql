-- 點名簿用：classes 加 class_date / class_time（可為 null，既有資料不影響）
alter table classes add column if not exists class_date date;
alter table classes add column if not exists class_time time;

-- 訂單所報名場次：bookings 加 slot_date / slot_time（可為 null，舊訂單不影響）
alter table bookings add column if not exists slot_date date;
alter table bookings add column if not exists slot_time time;
alter table bookings add column if not exists allergy_or_special_note text;
alter table bookings add column if not exists child_nickname text;
alter table bookings add column if not exists child_age text;

create index if not exists idx_bookings_slot on bookings(class_id, slot_date, slot_time);
create index if not exists idx_classes_date on classes(merchant_id, class_date);

comment on column classes.class_date is '單一場次日期 YYYY-MM-DD（與 class_time 搭配；若為 null 則以 scheduled_slots 為準）';
comment on column classes.class_time is '單一場次時間 HH:MM';
comment on column bookings.slot_date is '報名場次日期 YYYY-MM-DD';
comment on column bookings.slot_time is '報名場次時間 HH:MM';
comment on column bookings.allergy_or_special_note is '有無過敏或特殊疾病（購買頁填寫）';
comment on column bookings.child_nickname is '小孩暱稱（購買頁填寫）';
comment on column bookings.child_age is '小孩年齡（購買頁填寫）';

-- RPC：下單並扣庫存，支援寫入 slot_date / slot_time / allergy / 小孩暱稱 / 小孩年齡
create or replace function create_booking_and_decrement_capacity(
  p_merchant_id text,
  p_member_email text,
  p_class_id uuid,
  p_parent_name text default null,
  p_parent_phone text default null,
  p_slot_date date default null,
  p_slot_time time default null,
  p_allergy_note text default null,
  p_child_nickname text default null,
  p_child_age text default null
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

  insert into bookings (merchant_id, member_email, parent_name, parent_phone, phone, class_id, status, slot_date, slot_time, allergy_or_special_note, child_nickname, child_age)
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
    nullif(trim(p_child_nickname), ''),
    nullif(trim(p_child_age), '')
  )
  returning id into v_booking_id;

  update classes
  set capacity = capacity - 1
  where id = p_class_id and merchant_id = p_merchant_id;

  return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
end;
$$;
