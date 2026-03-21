# 總站代銷：給總部的操作說明（老師端自動綁定）

總站自動產碼與後台一鍵綁定說明另見：**[HQ_LISTING_BIND_TOKEN.md](./HQ_LISTING_BIND_TOKEN.md)**。

## 方式 A：配對碼（建議，與 model 對齊）

1. 總站在列表課上設定 **`listing_bind_token`**（配對碼，與 model 流程相同）。  
2. 把**同一字串**給老師；老師在分站課程編輯 **「配對碼」** 欄（`hq_listing_bind_token`）貼上後儲存即可。  
3. 老師站會以 **Service Role** 更新總站列表課的 `inventory_*`，並寫回老師課的 `hq_listing_*`。  
4. 有填配對碼時，老師站**不會**把下方「商家 ID + UUID」兩格寫入資料庫；僅執行配對碼同步。

## 方式 B：給老師兩個值（無配對碼時，舊版手動）

1. **在總站後台**新增或編輯「列表課」（與平常建課相同）。  
2. 記下以下兩項，透過 LINE／Email／文件給該堂課的老師：
   - **總站商家 ID**  
     = 總站網站環境變數 **`NEXT_PUBLIC_CLIENT_ID`**（與 Supabase `classes` 裡總站課程的 `merchant_id` 相同）。
   - **總站列表課 UUID**  
     = 這門列表課在資料表 **`classes` 的 `id`**（UUID）。  
     - 可從編輯網址 `/admin/.../classes/edit/＜這裡＞` 取得，或到 Supabase Table Editor 查看。

3. **請老師**在他自己的分站後台，打開**對應的那門課**（老師真實開課、管名額的那筆），在右欄 **「總站列表對應（老師填）」** 填入上述兩個值後 **儲存**。  
4. 儲存成功後，總站該筆列表課會自動寫入庫存綁定（`inventory_*` 指向老師課），**總站不必再手動填黃色區「庫存綁定」**（除非老師沒填或綁定失敗要補救）。

## 老師會看到的成功訊息

- 成功：`課程已更新，且已將總站列表課綁定至本課庫存`（或新增時的對應文案）。  
- 失敗仍會存老師課程，但會提示：`總站列表綁定失敗：…`（請依錯誤檢查 UUID／總站商家 ID 是否打錯，或 migration 是否已套用）。

## 資料庫前提（技術／維運）

同一 Supabase 專案需已套用：

- `20250318100000_cross_merchant_inventory.sql`（庫存綁定與 RPC）  
- `20250318110000_classes_hq_listing_link.sql`（老師課程上的 `hq_listing_*` 欄位）  
- 列表課 **`listing_bind_token`**（見 `20250318120000_classes_listing_bind_token.sql` 或與 model 相同之 migration）

## 可給老師的一行版指令範本

> 請到貴站後台 → 課程編輯 → 右欄「總站列表對應（老師填）」：  
> **總站商家 ID** 填：`（貼上總站 NEXT_PUBLIC_CLIENT_ID）`  
> **總站列表課 UUID** 填：`（貼上總站該列表課的 classes.id）`  
> 按儲存。完成後總站賣這門列表課會扣您這邊名額、訂單也會出現在您後台。

## 安全備註

老師若填錯他人列表課 UUID，可能把別人的列表誤綁到自己課程（營運上請只發給合作老師正確 UUID，並視需要定期抽查 `classes` 的 `inventory_*`）。
