-- 綠界、藍新交易編號，供對帳與查詢
alter table bookings add column if not exists ecpay_merchant_trade_no text default null;
alter table bookings add column if not exists ecpay_trade_no text default null;
alter table bookings add column if not exists newebpay_merchant_order_no text default null;
alter table bookings add column if not exists newebpay_trade_no text default null;
comment on column bookings.ecpay_merchant_trade_no is '綠界 MerchantTradeNo（我們送出的 20 字元訂單編號，callback 依此查詢）';
comment on column bookings.ecpay_trade_no is '綠界 ECPay 交易編號（付款成功通知後寫入）';
comment on column bookings.newebpay_merchant_order_no is '藍新 MerchantOrderNo（我們送出的訂單編號，最多 30 字元，callback 依此查詢）';
comment on column bookings.newebpay_trade_no is '藍新 NewebPay 交易編號（NotifyURL 成功後寫入）';
