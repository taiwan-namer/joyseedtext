-- 發票開立狀態：付款成功後觸發開立，失敗時標記以便後續補開
alter table bookings
  add column if not exists invoice_status text default null;

comment on column bookings.invoice_status is '發票狀態：null=未觸發, issued=已開立, failed=開立失敗待補開';
