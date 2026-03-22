-- 藍新 Notify 解密內之付款方式（如 CREDIT、VACC），供退款路由判斷；非信用卡勿呼叫 CreditCard/Close。
alter table public.bookings add column if not exists newebpay_payment_type text default null;

comment on column public.bookings.newebpay_payment_type is '藍新 MPG 付款方式（PaymentType 等），供自動退款判斷；VACC/ATM 與信用卡 API 不同';
