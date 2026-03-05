-- 報名進度加購選項：訂單儲存所選加購的索引（對應 classes.addon_prices 陣列）
-- 請在 Supabase Dashboard → SQL Editor 執行

alter table bookings add column if not exists addon_indices integer[] default null;
comment on column bookings.addon_indices is '所選加購項目在 classes.addon_prices 的索引，例如 [0,1] 表示選了第 1、2 個加購';

-- 更新 RPC：下單時寫入 addon_indices
create or replace function public.create_booking_and_decrement_capacity(
  p_merchant_id text,
  p_member_email text,
  p_class_id uuid,
  p_parent_name text default null,
  p_parent_phone text default null,
  p_slot_date date default null,
  p_slot_time time default null,
  p_allergy_note text default null,
  p_kid_name text default null,
  p_kid_age text default null,
  p_addon_indices integer[] default null
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

  insert into bookings (merchant_id, member_email, parent_name, parent_phone, phone, class_id, status, slot_date, slot_time, allergy_or_special_note, kid_name, kid_age, addon_indices)
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
    nullif(trim(p_kid_age), ''),
    case when p_addon_indices is not null and array_length(p_addon_indices, 1) > 0 then p_addon_indices else null end
  )
  returning id into v_booking_id;

  update classes
  set capacity = capacity - 1
  where id = p_class_id and merchant_id = p_merchant_id;

  return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
end;
$$;
