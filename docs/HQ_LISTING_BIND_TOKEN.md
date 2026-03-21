# 總站列表課配對碼（`listing_bind_token`）

- **新增（joyseed）**：在總站後台新增課程時，若所屬商家為本站的 `NEXT_PUBLIC_CLIENT_ID`，可勾選「代銷列表課：建立時自動產生配對碼」（未填庫存綁定、未手填老師配對碼時才會寫入欄位）。若 DB 尚未有該欄位，會自動略過寫入並重試，不會回傳假陽性。
- **列表課與老師課的綁定**：joyseed 課程表單**不**提供一鍵綁定 UI；請在 **model（總站）後台**完成綁定，或由老師端填配對碼／手動兩格。

詳細手動／老師填碼流程見 `HQ_MARKETPLACE_TEACHER_BINDING.md`。

共用 Supabase migration 清單與老師站 `class_id` 約定見 **`SUPABASE_MODEL_PARITY.md`**。
