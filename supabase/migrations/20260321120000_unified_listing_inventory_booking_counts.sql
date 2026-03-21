-- ---------------------------------------------------------------------------
-- unified_listing_inventory_booking_counts（檔名與 model 對齊）
-- 與 model 共用 Supabase 時，請將 **model 專案同名檔案全文** 貼入此檔或先由 model
-- 執行 migration，再讓 joyseed repo 與之內容一致，避免 drift。
--
-- 典型內容會統一「列表課／庫存課」在 RPC 與名額統計上的 class_id 行為；若 DB 已套用
-- model 版，下列 DO 仍安全（僅 NOTICE）。
-- ---------------------------------------------------------------------------
DO $migration$
BEGIN
  RAISE NOTICE '20260321120000: 若尚未套用 model 之 unified_listing_inventory_booking_counts DDL，請自 model 複製 SQL 至本檔';
END
$migration$;
