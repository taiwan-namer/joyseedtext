-- 修復線上金流無場次扣名額超賣：改為 Atomic Update（capacity > 0 RETURNING id），
-- 僅在扣到名額時才將訂單設為 paid / 建立 paid 訂單，否則回傳錯誤不寫入。

-- 1. confirm_booking_paid：無場次時先做 atomic update，成功才更新訂單為 paid
create or replace function public.confirm_booking_paid(
  p_booking_id uuid,
  p_merchant_id text,
  p_extra jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking record;
  v_class_capacity int;
  v_slot_capacity int;
  v_paid_count int;
  v_slots jsonb;
  v_slot jsonb;
  v_date_str text;
  v_time_str text;
  v_class_id uuid;
begin
  select b.id, b.class_id, b.merchant_id, b.status, b.slot_date, b.slot_time
  into v_booking
  from bookings b
  where b.id = p_booking_id and b.merchant_id = p_merchant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', '訂單不存在');
  end if;
  if v_booking.status != 'unpaid' then
    return jsonb_build_object('ok', false, 'error', '訂單狀態不允許');
  end if;

  select c.capacity, c.scheduled_slots
  into v_class_capacity, v_slots
  from classes c
  where c.id = v_booking.class_id and c.merchant_id = v_booking.merchant_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', '課程不存在');
  end if;

  if v_booking.slot_date is not null and v_booking.slot_time is not null then
    v_date_str := to_char(v_booking.slot_date, 'YYYY-MM-DD');
    v_time_str := rtrim(to_char(v_booking.slot_time, 'HH24:MI'));
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
    select count(*) into v_paid_count
    from bookings
    where class_id = v_booking.class_id and slot_date = v_booking.slot_date and slot_time = v_booking.slot_time
      and status in ('paid', 'completed');
    if v_slot_capacity is null or v_slot_capacity < 1 or v_paid_count >= v_slot_capacity then
      return jsonb_build_object('ok', false, 'error', '名額已滿');
    end if;
  end if;

  -- 無場次：先做 atomic 扣名額，只有扣成功（RETURNING 有列）才可更新訂單為 paid
  if v_booking.slot_date is null or v_booking.slot_time is null then
    update classes
    set capacity = capacity - 1
    where id = v_booking.class_id and merchant_id = v_booking.merchant_id and capacity > 0
    returning id into v_class_id;
    if v_class_id is null then
      return jsonb_build_object('ok', false, 'error', '名額已滿');
    end if;
  end if;

  update bookings
  set
    status = 'paid',
    line_pay_transaction_id = coalesce(p_extra->>'line_pay_transaction_id', line_pay_transaction_id),
    ecpay_trade_no = coalesce(p_extra->>'ecpay_trade_no', ecpay_trade_no),
    newebpay_trade_no = coalesce(p_extra->>'newebpay_trade_no', newebpay_trade_no)
  where id = p_booking_id and merchant_id = p_merchant_id and status = 'unpaid';

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.confirm_booking_paid is '付款成功時呼叫：鎖訂單與課程後檢查名額；無場次時以 atomic update (capacity > 0) 扣名額，僅扣成功才更新為 paid，避免超賣。';

-- 2. create_booking_from_pending：無場次時先 atomic 扣名額，成功才 insert paid 訂單並刪除 pending
create or replace function public.create_booking_from_pending(p_pending_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_booking_id uuid;
  v_class_id uuid;
begin
  select * into v from pending_payments where id = p_pending_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'pending 不存在');
  end if;

  -- 無場次：先 atomic 扣名額，只有扣成功才可建立 paid 訂單
  if v.slot_date is null or v.slot_time is null then
    update classes
    set capacity = capacity - 1
    where id = v.class_id and merchant_id = v.merchant_id and capacity > 0
    returning id into v_class_id;
    if v_class_id is null then
      return jsonb_build_object('ok', false, 'error', '名額已滿');
    end if;
  end if;

  insert into bookings (
    merchant_id, member_email, parent_name, parent_phone, phone,
    class_id, status, slot_date, slot_time, allergy_or_special_note,
    kid_name, kid_age, addon_indices, payment_method, order_amount
  ) values (
    v.merchant_id, v.member_email, v.parent_name, v.parent_phone, v.parent_phone,
    v.class_id, 'paid', v.slot_date, v.slot_time, v.allergy_or_special_note,
    v.kid_name, v.kid_age, v.addon_indices, v.payment_method, v.order_amount
  )
  returning id into v_booking_id;

  delete from pending_payments where id = p_pending_id;

  return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
end;
$$;

comment on function public.create_booking_from_pending is '從 pending_payments 建立 paid 訂單：無場次時先 atomic update (capacity > 0) 扣名額，僅扣成功才 insert 並刪除 pending，避免超賣。';
