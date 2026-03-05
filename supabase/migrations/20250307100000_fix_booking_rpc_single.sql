-- 解決 create_booking_and_decrement_capacity 有兩個 overload 導致「Could not choose the best candidate」。
-- 動態刪除「所有」同名重載（不論參數幾種），再建立唯一版本。

do $$
declare
  r record;
  sql text;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_booking_and_decrement_capacity'
  loop
    sql := format('drop function %I.%I(%s)', r.nspname, r.proname, r.args);
    execute sql;
  end loop;
end $$;

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
  v_capacity int;
  v_booking_id uuid;
  v_status text := 'unpaid';
  v_pm text := coalesce(nullif(trim(lower(p_payment_method)), ''), 'atm');
begin
  if v_pm not in ('atm', 'card', 'linepay') then
    v_pm := 'atm';
  end if;

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

  update classes
  set capacity = capacity - 1
  where id = p_class_id and merchant_id = p_merchant_id;

  return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
end;
$$;

comment on function public.create_booking_and_decrement_capacity is '下單並扣庫存，單一版本：p_slot_time=time, p_addon_indices=integer[]';
