-- 線上金流（LINE Pay／綠界／藍新）未付款不寫入 bookings，改存此表；付款成功後由此表建立 paid 訂單。
create table if not exists pending_payments (
  id uuid primary key default gen_random_uuid(),
  merchant_id text not null,
  member_email text not null,
  parent_name text,
  parent_phone text,
  class_id uuid not null references classes(id) on delete restrict,
  slot_date date,
  slot_time time,
  allergy_or_special_note text,
  kid_name text,
  kid_age text,
  addon_indices integer[],
  order_amount integer,
  payment_method text not null check (payment_method in ('linepay', 'ecpay', 'newebpay')),
  gateway_key text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pending_payments_gateway on pending_payments(payment_method, gateway_key);
create index if not exists idx_pending_payments_created on pending_payments(created_at desc);

comment on table pending_payments is '線上金流待付款：僅在付款成功後才從此表建立 bookings 並刪除此筆。gateway_key 為送給金流的訂單編號（綠界 20 字、藍新 30 字）；LINE Pay 以 id 當 orderId，gateway_key 可為空。';

-- 從 pending 建立 paid 訂單並依情況扣名額（無場次時扣 classes.capacity）。僅供 callback 使用。
create or replace function public.create_booking_from_pending(p_pending_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  v_booking_id uuid;
begin
  select * into v from pending_payments where id = p_pending_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'pending 不存在');
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

  if v.slot_date is null or v.slot_time is null then
    update classes set capacity = greatest(0, capacity - 1)
    where id = v.class_id and merchant_id = v.merchant_id;
  end if;

  delete from pending_payments where id = p_pending_id;

  return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
end;
$$;

comment on function public.create_booking_from_pending is '從 pending_payments 建立一筆 paid 訂單並刪除該 pending；無場次時扣 classes.capacity。僅由金流 callback 呼叫。';
