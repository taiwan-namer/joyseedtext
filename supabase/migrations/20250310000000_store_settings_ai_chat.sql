-- AI 客服：前台是否顯示 Widget、自訂歡迎訊息
alter table store_settings
  add column if not exists ai_chat_enabled boolean not null default true;

alter table store_settings
  add column if not exists ai_chat_welcome_message text default null;

comment on column store_settings.ai_chat_enabled is '是否在前台顯示 AI 客服浮動按鈕';
comment on column store_settings.ai_chat_welcome_message is 'AI 客服歡迎訊息（null 時用預設）';
