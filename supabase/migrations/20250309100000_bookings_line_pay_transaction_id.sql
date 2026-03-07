-- 記錄 LINE Pay Confirm 成功後的交易 ID，供對帳與查詢
alter table bookings add column if not exists line_pay_transaction_id text default null;
comment on column bookings.line_pay_transaction_id is 'LINE Pay 交易 ID（Confirm 成功後寫入）';
