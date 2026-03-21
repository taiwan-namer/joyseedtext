-- 訂單標記「開立該堂課程之商家」(classes.merchant_id，對應 bookings.class_id 所指課程列)
-- 供後台以 BOOKINGS_ORDER_ADMIN_CLASS_CREATOR_MERCHANT_ID 僅篩選特定創業商家訂單，避免撈到整個 MODEL 下所有 merchant 的訂單

alter table public.bookings
  add column if not exists class_creator_merchant_id text;

comment on column public.bookings.class_creator_merchant_id is
  '開立此堂課程之商家 merchant_id（與 classes 表中該 class_id 列的 merchant_id 一致，寫入時快照）';

create index if not exists idx_bookings_class_creator_merchant_id
  on public.bookings (class_creator_merchant_id);

-- 既有訂單回填
update public.bookings b
set class_creator_merchant_id = c.merchant_id
from public.classes c
where b.class_id = c.id
  and (b.class_creator_merchant_id is null or btrim(b.class_creator_merchant_id) = '');

-- ---------------------------------------------------------------------------
-- create_booking_and_decrement_capacity：寫入 class_creator_merchant_id = 庫存課列之商家
-- ---------------------------------------------------------------------------
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
  p_payment_method text default 'atm',
  p_order_amount integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_inv_merchant text;
  v_inv_class uuid;
  v_sold_via text;
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
  if v_pm not in ('atm', 'card', 'linepay', 'ecpay', 'newebpay') then
    v_pm := 'atm';
  end if;

  select * into v_listing
  from classes c
  where c.id = p_class_id and c.merchant_id = p_merchant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', '課程不存在或非本店家');
  end if;

  if v_listing.inventory_merchant_id is not null
     and btrim(v_listing.inventory_merchant_id) <> ''
     and v_listing.inventory_class_id is not null then
    v_inv_merchant := btrim(v_listing.inventory_merchant_id);
    v_inv_class := v_listing.inventory_class_id;
    v_sold_via := p_merchant_id;
  else
    v_inv_merchant := p_merchant_id;
    v_inv_class := p_class_id;
    v_sold_via := null;
  end if;

  select c.capacity, c.scheduled_slots
  into v_class_capacity, v_slots
  from classes c
  where c.id = v_inv_class and c.merchant_id = v_inv_merchant
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', '庫存課程不存在：請檢查 inventory 設定');
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
    where class_id = v_inv_class and slot_date = p_slot_date and slot_time = p_slot_time
      and status in ('paid', 'completed');
    if v_slot_capacity is null or v_slot_capacity < 1 then
      return jsonb_build_object('ok', false, 'error', '名額已滿');
    end if;
    if v_booked_count >= v_slot_capacity then
      return jsonb_build_object('ok', false, 'error', '名額已滿');
    end if;
    insert into bookings (
      merchant_id, member_email, parent_name, parent_phone, phone, class_id, status,
      slot_date, slot_time, allergy_or_special_note, kid_name, kid_age, addon_indices,
      payment_method, order_amount, sold_via_merchant_id, class_creator_merchant_id
    )
    values (
      v_inv_merchant,
      p_member_email,
      coalesce(nullif(trim(p_parent_name), ''), '—'),
      nullif(trim(p_parent_phone), ''),
      coalesce(nullif(trim(p_parent_phone), ''), ''),
      v_inv_class,
      v_status,
      p_slot_date,
      p_slot_time,
      nullif(trim(p_allergy_note), ''),
      nullif(trim(p_kid_name), ''),
      nullif(trim(p_kid_age), ''),
      case when p_addon_indices is not null and array_length(p_addon_indices, 1) > 0 then p_addon_indices else null end,
      v_pm,
      case when p_order_amount is not null and p_order_amount >= 0 then p_order_amount else null end,
      v_sold_via,
      v_inv_merchant
    )
    returning id into v_booking_id;
    return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
  end if;

  if v_class_capacity is null or v_class_capacity < 1 then
    return jsonb_build_object('ok', false, 'error', '名額已滿');
  end if;
  insert into bookings (
    merchant_id, member_email, parent_name, parent_phone, phone, class_id, status,
    slot_date, slot_time, allergy_or_special_note, kid_name, kid_age, addon_indices,
    payment_method, order_amount, sold_via_merchant_id, class_creator_merchant_id
  )
  values (
    v_inv_merchant,
    p_member_email,
    coalesce(nullif(trim(p_parent_name), ''), '—'),
    nullif(trim(p_parent_phone), ''),
    coalesce(nullif(trim(p_parent_phone), ''), ''),
    v_inv_class,
    v_status,
    p_slot_date,
    p_slot_time,
    nullif(trim(p_allergy_note), ''),
    nullif(trim(p_kid_name), ''),
    nullif(trim(p_kid_age), ''),
    case when p_addon_indices is not null and array_length(p_addon_indices, 1) > 0 then p_addon_indices else null end,
    v_pm,
    case when p_order_amount is not null and p_order_amount >= 0 then p_order_amount else null end,
    v_sold_via,
    v_inv_merchant
  )
  returning id into v_booking_id;
  if v_pm not in ('linepay', 'ecpay', 'newebpay') then
    update classes
    set capacity = capacity - 1
    where id = v_inv_class and merchant_id = v_inv_merchant;
  end if;
  return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
end;
$$;

comment on function public.create_booking_and_decrement_capacity is
  '下單：支援列表課程 inventory_*；class_creator_merchant_id 為庫存課 classes.merchant_id 快照。';

-- ---------------------------------------------------------------------------
-- create_booking_from_pending
-- ---------------------------------------------------------------------------
create or replace function public.create_booking_from_pending(p_pending_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_listing record;
  v_inv_merchant text;
  v_inv_class uuid;
  v_sold_via text;
  v_booking_id uuid;
  v_class_id uuid;
begin
  select * into v from pending_payments where id = p_pending_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'pending 不存在');
  end if;

  select * into v_listing
  from classes c
  where c.id = v.class_id and c.merchant_id = v.merchant_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', '課程不存在');
  end if;

  if v_listing.inventory_merchant_id is not null
     and btrim(v_listing.inventory_merchant_id) <> ''
     and v_listing.inventory_class_id is not null then
    v_inv_merchant := btrim(v_listing.inventory_merchant_id);
    v_inv_class := v_listing.inventory_class_id;
    v_sold_via := v.merchant_id;
  else
    v_inv_merchant := v.merchant_id;
    v_inv_class := v.class_id;
    v_sold_via := null;
  end if;

  if v.slot_date is null or v.slot_time is null then
    update classes
    set capacity = capacity - 1
    where id = v_inv_class and merchant_id = v_inv_merchant and capacity > 0
    returning id into v_class_id;
    if v_class_id is null then
      return jsonb_build_object('ok', false, 'error', '名額已滿');
    end if;
  end if;

  insert into bookings (
    merchant_id, member_email, parent_name, parent_phone, phone,
    class_id, status, slot_date, slot_time, allergy_or_special_note,
    kid_name, kid_age, addon_indices, payment_method, order_amount,
    sold_via_merchant_id, class_creator_merchant_id
  ) values (
    v_inv_merchant, v.member_email, v.parent_name, v.parent_phone, v.parent_phone,
    v_inv_class, 'paid', v.slot_date, v.slot_time, v.allergy_or_special_note,
    v.kid_name, v.kid_age, v.addon_indices, v.payment_method, v.order_amount,
    v_sold_via,
    v_inv_merchant
  )
  returning id into v_booking_id;

  delete from pending_payments where id = p_pending_id;

  return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
end;
$$;

comment on function public.create_booking_from_pending is
  '從 pending 建立 paid 訂單；class_creator_merchant_id 為庫存課 classes.merchant_id 快照。';
