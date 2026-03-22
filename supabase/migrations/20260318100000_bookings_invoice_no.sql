-- 綠界 B2C 發票號碼，供退款時呼叫作廢 API
alter table public.bookings add column if not exists invoice_no text default null;

comment on column public.bookings.invoice_no is '綠界電子發票 InvoiceNo（開立成功解密後寫入），供 B2CInvoice/Invalid 作廢';

comment on column public.bookings.invoice_status is '發票狀態：null=未觸發, issued=已開立, failed=開立失敗, voided=已作廢';
