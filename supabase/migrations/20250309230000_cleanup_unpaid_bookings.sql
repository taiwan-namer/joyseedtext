-- 一次性清理：刪除所有「未付款」訂單（status = 'unpaid'）。
-- 注意：無場次且付款方式為 ATM/card 的訂單，在建立時已扣過 classes.capacity，刪除前需先回補名額。
-- 執行後無法還原，請確認無需保留未付款訂單再套用。

-- 1. 回補名額：無場次 + ATM/card 的未付款訂單在建立時已扣過 capacity，刪除前依 class 加回
update classes c
set capacity = c.capacity + sub.cnt
from (
  select b.class_id, b.merchant_id, count(*)::int as cnt
  from bookings b
  where b.status = 'unpaid'
    and b.slot_date is null and b.slot_time is null
    and b.payment_method in ('atm', 'card')
  group by b.class_id, b.merchant_id
) sub
where c.id = sub.class_id and c.merchant_id = sub.merchant_id;

-- 2. 刪除所有未付款訂單（含 LINE Pay/綠界/藍新 未完成、以及 ATM/card 未繳費）
delete from bookings
where status = 'unpaid';
