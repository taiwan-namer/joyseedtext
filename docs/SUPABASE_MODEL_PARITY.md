# Supabase 與 model 對齊（joyseed／老師站）

## 必備 migration（共用 DB 時）

- 含 `inventory_*`、`sold_via_merchant_id`、下單 RPC 庫存解析者：`20250318100000_cross_merchant_inventory.sql` 等（見 `supabase/migrations/`）。
- **`20260321120000_unified_listing_inventory_booking_counts.sql`**：檔名與 model 一致；**實際 DDL 請以 model 專案為準**。joyseed 內建版本若僅含 NOTICE，代表佔位—正式環境請替換為 model 全文或確認已由 model 先 `db push`。

## 老師站結帳與 `class_id`

- 前台結帳／`createBooking` 傳入的 **`classId` 應為老師課 `classes.id`（UUID）**，與 model 老師站一致。
- DB RPC（`create_booking_and_decrement_capacity`、`create_booking_from_pending` 等）會依該課列解析 `inventory_*`；**寫入 `bookings.class_id` 者為庫存課 UUID**（無庫存綁定時即等於傳入之老師課 id）。

## 應用層已對齊 model 之移除項目

- 不引用 **`generateListingBindTokenForCourse`**、**`bindHqListingToTeacherClassFromAdmin`**（總站產碼／一鍵綁定由 model 處理）。

## 課程編輯自救綁定

- 後台 **`updateCourseFull`** 仍處理 **`hq_listing_bind_token`**（配對碼優先）與 **`hq_listing_merchant_id` / `hq_listing_class_id`**（手動兩格），表單欄位見 `CourseEditForm.tsx`。
