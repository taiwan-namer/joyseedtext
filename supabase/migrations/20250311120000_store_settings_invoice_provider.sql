-- 發票開立廠商：ecpay=綠界, ezpay=藍新 ezPay（未來可擴充）
alter table store_settings
  add column if not exists invoice_provider text default 'ecpay';

comment on column store_settings.invoice_provider is '發票開立廠商：ecpay（綠界）, ezpay（藍新 ezPay，尚未串接時選了會略過開立）';
