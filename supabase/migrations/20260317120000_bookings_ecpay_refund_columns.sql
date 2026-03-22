-- 綠界退刷與付款方式：供後台自動退刷與報表判斷
alter table public.bookings add column if not exists refund_status text default null;
alter table public.bookings add column if not exists ecpay_payment_type text default null;

comment on column public.bookings.refund_status is '退款狀態：refunded 表示已透過綠界退刷成功';
comment on column public.bookings.ecpay_payment_type is '綠界 ReturnURL 的 PaymentType（例如 Credit_CreditCard），用於判斷是否可自動信用卡退刷';
