-- LINE Pay / 金流 API 請求日誌，供除錯與稽核
create table if not exists payment_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_id text,
  order_id text,
  transaction_id text,
  api_type text not null check (api_type in ('request', 'confirm')),
  request_body text,
  response_body text,
  return_code text,
  return_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_logs_order_id on payment_logs(order_id);
create index if not exists idx_payment_logs_transaction_id on payment_logs(transaction_id);
create index if not exists idx_payment_logs_created_at on payment_logs(created_at desc);

comment on table payment_logs is 'LINE Pay API 請求/回應日誌，含 request_body 與 response_body';
