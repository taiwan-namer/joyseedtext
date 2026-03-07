-- 單一交易內「檢查名額 + 更新為已付款」，避免兩筆付款同時通過造成超賣。
-- 使用 FOR UPDATE 鎖住訂單與課程列，再檢查該場次已付款數，通過才更新並（無場次時）扣 classes.capacity。

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

  update bookings
  set
    status = 'paid',
    line_pay_transaction_id = coalesce(p_extra->>'line_pay_transaction_id', line_pay_transaction_id),
    ecpay_trade_no = coalesce(p_extra->>'ecpay_trade_no', ecpay_trade_no),
    newebpay_trade_no = coalesce(p_extra->>'newebpay_trade_no', newebpay_trade_no)
  where id = p_booking_id and merchant_id = p_merchant_id and status = 'unpaid';

  if v_booking.slot_date is null or v_booking.slot_time is null then
    update classes set capacity = greatest(0, capacity - 1)
    where id = v_booking.class_id and merchant_id = v_booking.merchant_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.confirm_booking_paid is '付款成功時呼叫：鎖訂單與課程後檢查名額，通過才更新為 paid 並寫入交易編號；無場次時扣 classes.capacity。同一交易內完成，避免超賣。';
