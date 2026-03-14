-- 下單改為「依場次名額」：從 scheduled_slots 取得該場次的 capacity，以該場次已報名人數判斷是否可報名，不再扣 classes.capacity。

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
  p_addon_indices integer[] default null,
  p_payment_method text default 'atm'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_capacity int;
  v_slot_capacity int;
  v_booked_count int;
  v_booking_id uuid;
  v_status text := 'unpaid';
  v_pm text := coalesce(nullif(trim(lower(p_payment_method)), ''), 'atm');
  v_slots jsonb;
  v_slot jsonb;
  v_date_str text;
  v_time_str text;
begin
  if v_pm not in ('atm', 'card', 'linepay') then
    v_pm := 'atm';
  end if;

  select c.capacity, c.scheduled_slots
  into v_class_capacity, v_slots
  from classes c
  where c.id = p_class_id and c.merchant_id = p_merchant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', '課程不存在或非本店家');
  end if;

  if p_slot_date is not null and p_slot_time is not null then
    v_date_str := to_char(p_slot_date, 'YYYY-MM-DD');
    v_time_str := rtrim(to_char(p_slot_time, 'HH24:MI'));
    v_slot_capacity := v_class_capacity;
    if v_slots is not null and jsonb_typeof(v_slots) = 'array' then
      for v_slot in select * from jsonb_array_elements(v_slots)
      loop
        if (v_slot->>'date') = v_date_str and rtrim(coalesce(v_slot->>'time', '')) = v_time_str then
          if (v_slot->>'capacity') is not null and (v_slot->>'capacity') ~ '^\d+$' then
            v_slot_capacity := (v_slot->>'capacity')::int;
          end if;
          exit;
        end if;
      end loop;
    end if;
    select count(*) into v_booked_count
    from bookings
    where class_id = p_class_id and slot_date = p_slot_date and slot_time = p_slot_time;
    if v_slot_capacity is null or v_slot_capacity < 1 then
      return jsonb_build_object('ok', false, 'error', '名額已滿');
    end if;
    if v_booked_count >= v_slot_capacity then
      return jsonb_build_object('ok', false, 'error', '名額已滿');
    end if;
    insert into bookings (merchant_id, member_email, parent_name, parent_phone, phone, class_id, status, slot_date, slot_time, allergy_or_special_note, kid_name, kid_age, addon_indices, payment_method)
    values (
      p_merchant_id,
      p_member_email,
      coalesce(nullif(trim(p_parent_name), ''), '—'),
      nullif(trim(p_parent_phone), ''),
      coalesce(nullif(trim(p_parent_phone), ''), ''),
      p_class_id,
      v_status,
      p_slot_date,
      p_slot_time,
      nullif(trim(p_allergy_note), ''),
      nullif(trim(p_kid_name), ''),
      nullif(trim(p_kid_age), ''),
      case when p_addon_indices is not null and array_length(p_addon_indices, 1) > 0 then p_addon_indices else null end,
      v_pm
    )
    returning id into v_booking_id;
    return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
  end if;

  -- 未傳場次時沿用舊邏輯：用課程總名額並扣 classes.capacity
  if v_class_capacity is null or v_class_capacity < 1 then
    return jsonb_build_object('ok', false, 'error', '名額已滿');
  end if;
  insert into bookings (merchant_id, member_email, parent_name, parent_phone, phone, class_id, status, slot_date, slot_time, allergy_or_special_note, kid_name, kid_age, addon_indices, payment_method)
  values (
    p_merchant_id,
    p_member_email,
    coalesce(nullif(trim(p_parent_name), ''), '—'),
    nullif(trim(p_parent_phone), ''),
    coalesce(nullif(trim(p_parent_phone), ''), ''),
    p_class_id,
    v_status,
    p_slot_date,
    p_slot_time,
    nullif(trim(p_allergy_note), ''),
    nullif(trim(p_kid_name), ''),
    nullif(trim(p_kid_age), ''),
    case when p_addon_indices is not null and array_length(p_addon_indices, 1) > 0 then p_addon_indices else null end,
    v_pm
  )
  returning id into v_booking_id;
  update classes set capacity = capacity - 1 where id = p_class_id and merchant_id = p_merchant_id;
  return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
end;
$$;

comment on function public.create_booking_and_decrement_capacity is '下單：有 slot 時依場次名額（scheduled_slots[].capacity），無 slot 時扣 classes.capacity';
