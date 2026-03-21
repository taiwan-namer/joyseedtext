-- 總站「列表課」配對碼：老師站依此欄位解析列表課並寫入 inventory_* / hq_listing_*。
-- 若與 model 共用 DB 且已執行過相同變更，此檔可安全重跑（IF NOT EXISTS）。
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS listing_bind_token text;

COMMENT ON COLUMN public.classes.listing_bind_token IS '總站列表課專用：老師填入同一字串即可完成庫存綁定（與 joyseed syncListingInventoryFromBindToken 搭配）';
