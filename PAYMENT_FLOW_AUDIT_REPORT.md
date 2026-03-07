# 支付流程健康檢查 / 風險盤點 / 上線前審查報告

審查日期：依專案程式碼與 migration 狀態產出  
審查範圍：LINE Pay、綠界 ECPay、藍新 NewebPay 之路由、helper、訂單狀態、callback、結果頁、環境變數、對帳與安全性。

---

# 1. 支付流程總覽

## LINE Pay 目前成功流程摘要

1. **結帳頁**：使用者選 LINE Pay → `createBooking`（Server Action）→ 寫入 `pending_payments`（`gateway_key` 後設為 `pendingId`）→ 呼叫 LINE Pay Request API → 回傳 `paymentUrl`。
2. **瀏覽器**：導向 LINE Pay 授權頁，完成後 LINE 導回 **GET** `/api/linepay/confirm?transactionId=xxx&orderId=xxx`（orderId = pending 的 `id`）。
3. **Confirm route**：以 `orderId` 先查 `bookings`（unpaid + linepay）；若無則查 `pending_payments`（id = orderId, linepay）。呼叫 LINE Pay Confirm API（含 1172 已完成的處理與重試）。
4. **DB 更新**：若有 unpaid booking → `ensureCapacityAndMarkPaid`（RPC `confirm_booking_paid`）；若為 pending → RPC `create_booking_from_pending`，再更新 `line_pay_transaction_id`。
5. **導向**：成功 → `/booking/success?bookingId=xxx`；失敗 → `/course/{slug}/checkout?error=linepay_confirm&message=...`（註：slug 若無則為 `"course"`，可能 404）。

## ECPay 目前成功流程摘要

1. **結帳頁**：使用者選綠界 → `createBooking` → 寫入 `pending_payments`（gateway_key = EC 開頭 20 字）→ 回傳 `paymentUrl: /api/ecpay/checkout?pendingId=xxx`。
2. **Checkout**：GET 取得 pending，組綠界參數（ReturnURL=`/api/ecpay/callback`，OrderResultURL=`/api/ecpay/result`），回傳自動 POST 表單導向綠界。
3. **綠界**：付款完成後會 **POST 到 ReturnURL（callback）** 與 **POST 到 OrderResultURL（result）**。
4. **Callback**（`/api/ecpay/callback`）：以「綠界回傳的完整參數」`paramsRaw` 驗證 CheckMacValue → RtnCode=1 才處理 → 先查 `bookings`（ecpay_merchant_trade_no + unpaid），無則查 `pending_payments`（gateway_key=MerchantTradeNo）→ 有 booking 則 `ensureCapacityAndMarkPaid`，否則 `create_booking_from_pending` + 更新 ecpay 欄位 → 回傳 `1|OK`。
5. **Result route**（`/api/ecpay/result`）：僅接收 POST，解析 MerchantTradeNo 後 **302 導向** GET `/payment/ecpay/result?MerchantTradeNo=xxx`。
6. **結果頁**（`/payment/ecpay/result`）：依 MerchantTradeNo 查 `bookings` 或 `pending_payments`，僅顯示 paid / unpaid / not_found，**不寫入 DB**。

## NewebPay 目前成功流程摘要

1. **結帳頁**：選藍新 → `createBooking` → 寫入 `pending_payments`（gateway_key = NB+timestamp）→ 回傳 `paymentUrl: /api/newebpay/checkout?pendingId=xxx`。
2. **Checkout**：GET 取得 pending，組藍新參數（returnURL=`/api/newebpay/result`，notifyURL=`/api/newebpay/callback`），Set-Cookie `newebpay_order_no`，回傳自動 POST 表單。
3. **藍新**：付款完成後 **POST NotifyURL（callback）** 與 **POST ReturnURL（result）**。
4. **Callback**（`/api/newebpay/callback`）：驗證 TradeSha → 解密 TradeInfo → 判定成功（Status=SUCCESS / TradeStatus=1 / 或「解密為我們送出的請求」looksLikeOurRequest）→ 先查 unpaid booking（newebpay_merchant_order_no），無则查 pending（gateway_key）→ 有 booking 則 `ensureCapacityAndMarkPaid`，否則 `create_booking_from_pending` + 更新 newebpay 欄位 → 回傳 200 OK。
5. **Result route**（`/api/newebpay/result`）：POST 接收，嘗試從 plain 或解密取 MerchantOrderNo；解密失敗仍導向結果頁（orderNo 或 state=pending）。**302** → `/payment/newebpay/result?orderNo=xxx` 或 `?state=pending`。
6. **結果頁**：支援 orderNo、MerchantOrderNo、bookingId、state=pending；state=pending 時從 cookie 讀 `newebpay_order_no` 再查 DB。僅查詢與顯示，**不寫入 DB**。

---

# 2. 風險總表

## Critical

### C1. Callback 重送時已 paid 訂單回傳 500，可能觸發金流重試或營運困擾

- **位置**：`app/api/ecpay/callback/route.ts`（ensureCapacityAndMarkPaid 失敗時）、`app/api/newebpay/callback/route.ts`（ensureCapacityAndMarkPaid 失敗時）。
- **原因**：`confirm_booking_paid` 僅在 `status = 'unpaid'` 時更新；callback 第二次進來時訂單已 paid，RPC 回傳「訂單狀態不允許」，callback 回 500。
- **後果**：綠界/藍新可能重送 callback；log 與監控告警增加；若金流將 500 視為需重試，會重複打同一筆。
- **建議**：在 callback 內若「已找到該筆訂單且 status 為 paid」則直接回傳 200（1|OK / JSON OK），不呼叫 ensureCapacityAndMarkPaid；僅在「未付款且更新失敗」時回 500。

### C2. LINE Pay Confirm 重複進入（重新整理／返回再進）可能顯示「建立訂單失敗」

- **位置**：`app/api/linepay/confirm/route.ts`，pending 流程中 `create_booking_from_pending` 後若 RPC 回傳 `ok: false`（例如第二次進入時 pending 已被刪除）即 `redirectFail("建立訂單失敗")`。
- **原因**：RPC 已刪除該筆 pending 並建立過 booking，第二次進入時 pending 不存在，RPC 回 { ok: false, error: 'pending 不存在' }，前端被導向錯誤頁。
- **後果**：使用者已付款成功，卻看到錯誤頁，造成客訴與信心問題。
- **建議**：當 `create_booking_from_pending` 回傳 ok:false 且 error 為「pending 不存在」時，改為以 orderId（原 pending id）或 transactionId 查詢是否已有 booking（例如該 transactionId 或該 order 對應的 booking），若有則視為成功並導向 `/booking/success?bookingId=xxx`，僅在真的查不到且 RPC 失敗時才顯示建立訂單失敗。

## High

### H1. LINE Pay 失敗導向 slug 可能錯誤導致 404

- **位置**：`app/api/linepay/confirm/route.ts`，`redirectFail(..., undefined, classIdForFail ?? "course")`，以及 `redirectNoId()` 使用 `checkoutFailPath = "/course/course/checkout"`。
- **原因**：失敗時導向 `/course/{slug}/checkout`，但 slug 傳入為 classId 或固定 "course"，實際課程 URL 應為 `/course/{courseSlug}/checkout`，courseSlug 與 class_id 未必一致。
- **後果**：使用者被導到 `/course/course/checkout` 或錯誤 path，可能 404。
- **建議**：結帳時將 course slug 帶入 LINE Pay 的 cancelUrl/或存在 session；confirm 失敗時改導向該 slug 的 checkout，或統一導向 `/member` 並以 query 顯示錯誤訊息，避免依賴 classId 當 slug。

### H2. NewebPay ReturnURL 之 TradeInfo 為 768 hex 時解密失敗，無法從 result 帶出 orderNo

- **位置**：`app/api/newebpay/result/route.ts`（解密 768 hex 時 bad decrypt），導向 `?state=pending`，無 orderNo。
- **原因**：藍新 ReturnURL 回傳的 TradeInfo 可能為不同格式/長度（768），與送出時 672 不同，用同一組 key 解密失敗。
- **後果**：結果頁僅能依 cookie 取得 orderNo；若 cookie 遺失或跨裝置則無法對應訂單，僅能顯示「處理中」。
- **建議**：已用 cookie 補強；中長期可查藍新文件確認 ReturnURL 回傳格式，或改為僅依 NotifyURL 為真源、結果頁僅做「查詢 + 顯示」。

### H3. ECPay callback 驗簽使用「未 trim」的 paramsRaw，與文件註解「排除空值」不一致

- **位置**：`lib/ecpay/checkmac.ts` 之 `ecpayCheckMacValueFromReceived`，註解寫「排除 CheckMacValue 與空值」，實作僅排除 CheckMacValue，**未排除空值**（使用 `params[k] ?? ""`）。
- **原因**：若綠界回傳含空字串欄位，是否參與簽章依官方規格而定；若官方為「不納入空值」而目前納入，驗簽可能失敗。
- **後果**：在特定回傳內容下 callback 驗簽失敗，訂單無法更新。
- **建議**：對照綠界回傳規格；若官方為「排除空值」，則在 `ecpayCheckMacValueFromReceived` 中 filter 掉值為空或僅空白的 key 再排序計算。

### H4. 結帳按鈕僅依 submitLoading 防重複，極短時間連點仍可能送出兩次

- **位置**：`app/course/[slug]/checkout/page.tsx`，`handleSubmit` 內 `setSubmitLoading(true)` 後呼叫 `createBooking`，成功後 `window.location.href = bookRes.paymentUrl` 或設 success 狀態；按鈕 `disabled={loading}`。
- **原因**：React 狀態更新非同步，使用者若在第一次 request 發出前連點，可能觸發兩次 `createBooking`，產生兩筆 pending 或兩次 Request API。
- **後果**：兩筆待付款、或同一使用者被導向兩次金流，增加對帳與客訴複雜度。
- **建議**：在 `handleSubmit` 開頭用 ref 做「已送出」鎖（例如 `if (submittingRef.current) return; submittingRef.current = true`），並在 finally 或導向後才重置；或由 Server Action 依「同一課程+同一時段+同一 email+短時間」做簡易冪等（例如回傳既有 pendingId）。

## Medium

### M1. 僅 LINE Pay 寫入 payment_logs，ECPay/NewebPay 無 callback 日誌

- **位置**：`lib/paymentLogs.ts`、`app/api/linepay/confirm/route.ts` 有 `logPaymentApi`；`app/api/ecpay/callback/route.ts`、`app/api/newebpay/callback/route.ts` 無寫入 payment_logs。
- **原因**：payment_logs 表設計為 LINE Pay 用，綠界/藍新未接上。
- **後果**：對帳或爭議時無法從 DB 還原 ECPay/NewebPay 的 callback 內容與結果。
- **建議**：擴充 payment_logs（或新增 payment_callback_logs）存 provider、gateway_key、交易號、金額、回傳狀態、是否驗簽/解密成功、建立時間；callback 內在驗簽/解密通過後寫入一筆（payload 可遮罩敏感欄位）。

### M2. create_booking_from_pending 成功後 ECPay/NewebPay 再 update bookings 為兩段操作，非單一交易

- **位置**：`app/api/ecpay/callback/route.ts`、`app/api/newebpay/callback/route.ts`，先 RPC `create_booking_from_pending`，再 `supabase.from('bookings').update({ ecpay_merchant_trade_no, ecpay_trade_no })`。
- **原因**：RPC 內建單並刪除 pending，但交易編號與 gateway 訂單號在 RPC 外以第二段 update 寫入。
- **後果**：若 update 失敗（網路/DB 暫時問題），訂單已 paid 但缺少 ecpay_trade_no/newebpay_trade_no，對帳困難。
- **建議**：在 RPC 內新增可選參數（如 p_ecpay_trade_no, p_ecpay_merchant_trade_no），由 RPC 在 insert booking 後同一交易內 update 這些欄位；或保留現狀但至少 log update 失敗並有告警，以便補資料。

### M3. NewebPay「解密為我們送出的請求」即視為成功，理論上可被偽造

- **位置**：`app/api/newebpay/callback/route.ts`，`isSuccess` 含 `(looksLikeOurRequest && !hasDecryptedStatus)`，即解密內容含 MerchantOrderNo + (ReturnURL/NotifyURL 或 Amt) 且無 Status/TradeStatus。
- **原因**：TradeSha 已驗證，故 payload 必須用正確 HashKey/HashIV 產生；若攻擊者無法取得金鑰則無法偽造。但若金鑰外洩，攻擊者可能組出「像我們請求」的內容打 NotifyURL。
- **後果**：金鑰外洩時風險提高；否則風險受控。
- **建議**：維持現狀，但確保 HashKey/HashIV 僅在 server、不進 client、不寫 log 明文；若有藍新正式文件建議僅依 Status/TradeStatus 判定，可逐步收緊條件。

### M4. ECPay checkout 的 debug 與 CheckMacValue 前 8 字元 log 在 production 仍會輸出

- **位置**：`app/api/ecpay/checkout/route.ts`，`ecpayCheckMacValue(..., { debug: true })` 以及多行 `console.log`（含 CheckMacValue 前 8 字元）。
- **原因**：debug 強制 true，且 checkout 每次都會 log。
- **後果**：Production 日誌量與敏感度增加，CheckMacValue 雖非密鑰但屬簽章值，長期累積不理想。
- **建議**：debug 改為 `process.env.NODE_ENV !== 'production'` 或 `ECPAY_DEBUG_CHECKMAC === '1'`；production 僅 log 必要欄位（如 MerchantTradeNo、ReturnURL 路徑），不 log CheckMacValue。

## Low

### L1. 綠界 ReturnURL 與 OrderResultURL 皆指向同一站台，若綠界兩者都打且順序不同

- **位置**：綠界文件行為為 ReturnURL（背景）與 OrderResultURL（前台）；目前 ReturnURL=`/api/ecpay/callback`，OrderResultURL=`/api/ecpay/result`。
- **說明**：callback 為唯一寫入 DB 的來源，result 僅 302 到結果頁，順序不影響正確性；僅需注意兩邊都打時 callback 的冪等性（見 C1）。
- **建議**：同 C1，callback 對「已 paid」直接回 1|OK。

### L2. NewebPay 結果頁依 cookie 讀 orderNo，cookie 未設 HttpOnly

- **位置**：`app/api/newebpay/checkout/route.ts`，Set-Cookie 未設 HttpOnly。
- **原因**：結果頁為 server 讀 cookie，需同站請求帶上 cookie；HttpOnly 不影響 server 讀取，僅影響前端 JS 無法讀取，對安全有利。
- **後果**：若前端日後有 XSS，可讀取 newebpay_order_no；目前結果頁僅 server 讀，風險低。
- **建議**：可加 `HttpOnly`，Path=/; Max-Age=3600; SameSite=Lax`。

### L3. LINE Pay 金鑰可來自 DB（store_settings.frontend_settings.linePayApi）

- **位置**：`lib/linepay.ts` 之 `getLinePaySandboxCredentials`，若 env 未設則從 `linePayApiFromDb`（JSON 含 channelId、channelSecret）解析。
- **說明**：channelSecret 存於 DB，需確保後台存取與傳輸皆受保護；若僅後台寫入、僅 server 讀取，則為設計取捨。
- **建議**：確認後台「金流設定」頁僅管理員可存取、HTTPS、且 DB 備份與存取有權限控管。

---

# 3. 狀態流轉檢查

## 狀態機概觀

- **bookings.status**：`unpaid` → `paid` / `completed`；另有 `cancelled` 等。
- **pending_payments**：建立後僅在「付款成功」時由 RPC 刪除並產出 booking，無「失敗」狀態欄位。

## LINE Pay

| 階段           | 行為 |
|----------------|------|
| 建單           | 只寫 `pending_payments`（gateway_key 後設為 id），不寫 bookings。 |
| 前台導頁       | 使用者被導到 LINE Pay，完成後 GET `/api/linepay/confirm?transactionId=&orderId=`。 |
| Callback/確認  | 無獨立 webhook；**GET confirm** 即為「使用者完成授權」的入口，呼叫 LINE Pay Confirm API 後依結果寫 DB。 |
| DB 更新        | confirm 內：有 unpaid booking 則 `confirm_booking_paid`；否則 pending → `create_booking_from_pending` + update line_pay_transaction_id。 |
| 結果頁         | 導向 `/booking/success?bookingId=`，非專用「支付結果頁」。 |

**可能不一致處**：使用者重新整理 confirm URL 時，若 pending 已被刪除且未改為「已建立訂單即導向 success」，會顯示建立訂單失敗（見 C2）。

## ECPay

| 階段           | 行為 |
|----------------|------|
| 建單           | 只寫 `pending_payments`（gateway_key=MerchantTradeNo），不寫 bookings。 |
| 前台導頁       | checkout 表單 POST 到綠界，付款完成後綠界 POST OrderResultURL 與 ReturnURL。 |
| Callback       | **POST /api/ecpay/callback**：驗簽 → RtnCode=1 → 查 booking 或 pending → 更新或建單，回 1\|OK。 |
| Result route   | **POST /api/ecpay/result**：只 302 到結果頁，不寫 DB。 |
| DB 更新        | **僅在 callback**：booking 存在則 confirm_booking_paid；否則 create_booking_from_pending + update ecpay 欄位。 |
| 結果頁         | GET，依 MerchantTradeNo 查 booking/pending，只顯示狀態。 |

**可能不一致處**：若 callback 因「訂單已 paid」而 RPC 失敗並回 500，綠界可能重試；結果頁若先被使用者打開，會顯示「處理中」，等 callback 成功後再重整會變「付款成功」。若 callback 永遠 500（例如未做冪等），則訂單可能一直未更新（見 C1）。

## NewebPay

| 階段           | 行為 |
|----------------|------|
| 建單           | 只寫 `pending_payments`（gateway_key=MerchantOrderNo），不寫 bookings。 |
| 前台導頁       | checkout 表單 POST 到藍新，Set-Cookie newebpay_order_no。 |
| Callback       | **POST /api/newebpay/callback**（NotifyURL）：驗 TradeSha、解密、判成功 → 查 booking 或 pending → 更新或建單，回 200 OK。 |
| Result route   | **POST /api/newebpay/result**：302 到結果頁（帶 orderNo 或 state=pending），不寫 DB。 |
| DB 更新        | **僅在 callback**：同 ECPay，僅 callback 寫 DB。 |
| 結果頁         | GET，依 orderNo/cookie/bookingId/state 查詢，只顯示狀態。 |

**可能不一致處**：ReturnURL 若帶 768 hex 且解密失敗，結果頁無 orderNo，僅能靠 cookie；callback 已成功時結果頁仍可能短暫顯示「處理中」直到重整或帶上 cookie（見 H2）。同 C1，callback 對已 paid 回 500 會觸發重試。

---

# 4. 重複處理 / 重複扣款風險

## 使用者連點結帳按鈕

- **現狀**：按鈕有 `disabled={submitLoading}`，但 setState 非同步，極短時間連點可能送出兩次 `createBooking`。
- **後果**：可能產生兩筆 pending、兩次金流 Request（LINE Pay）或兩次 checkout 表單（ECPay/NewebPay）；不會「同一筆訂單扣兩次款」，但會多筆待付款與對帳困擾。
- **建議**：見 H4（ref 鎖或 Server 端冪等）。

## Callback 重送

- **ECPay**：同一筆 MerchantTradeNo 第二次進來時，若先查 booking 且已 paid，目前仍會呼叫 ensureCapacityAndMarkPaid，RPC 回「訂單狀態不允許」→ callback 回 500 → 可能被綠界重試。
- **NewebPay**：同上，已 paid 仍呼叫 ensureCapacityAndMarkPaid → 500。
- **建議**：見 C1；在 callback 內若「該筆訂單/該 gateway_key 對應之訂單已 paid」則直接回 200/1|OK，不再呼叫 RPC。

## create_booking_from_pending 重複呼叫

- **現狀**：RPC 內 `SELECT ... FOR UPDATE` + 建單 + `DELETE pending`，第二次呼叫時 pending 已不存在，回 { ok: false, error: 'pending 不存在' }。
- **ECPay/NewebPay**：callback 端未依此判斷為「已處理過」，會落到「無對應 pending」分支並回 200，故不會重複建單；但 ECPay/NewebPay 在「有 booking 且已 paid」時會走 ensureCapacityAndMarkPaid 並 500，需改為冪等回 200。
- **LINE Pay**：confirm 第二次進入時會拿到「pending 不存在」，目前直接當錯誤導向失敗頁（見 C2），應改為查詢已存在之 booking 並導向 success。

## Result 與 Callback 先後順序

- **設計**：結果頁與 result route **都不寫入訂單狀態**，僅 callback 寫入；故先到 result 再 callback，或先 callback 再 result，最終狀態皆以 callback 為準。
- **結論**：順序不影響正確性；僅有「結果頁先開時顯示處理中、callback 後需重整或依 cookie 再查」的 UX 差異。

## 同一訂單多次付款（同一 pending 多次導向金流）

- **現狀**：同一 pendingId 可多次 GET checkout（ECPay/NewebPay），每次都會導向金流；若使用者完成多筆付款，綠界/藍新會多次 callback 同一 MerchantTradeNo/MerchantOrderNo。
- **第一次**：create_booking_from_pending 成功，pending 刪除。
- **第二次**：pending 已無，ECPay/NewebPay 會「無對應 pending 仍回 200」；不會建第二筆 booking，但金流端可能已請款兩次，需與金流對帳退一筆。
- **建議**：可考慮在 pending 上加「已轉訂單」標記或唯一約束，或由金流端控制同一訂單編號不重複請款；目前為營運/對帳層級風險。

---

# 5. 金鑰與環境變數檢查

## Server 專用（不可暴露給 client）

- **ECPay**：`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`、`ECPAY_ENV` — 僅在 API route / Server Action 使用，未使用 NEXT_PUBLIC。
- **NewebPay**：`NEWEBPAY_MERCHANT_ID`、`NEWEBPAY_HASH_KEY`、`NEWEBPAY_HASH_IV`、`NEWEBPAY_ENV` — 僅在 `lib/newebpay/config.ts` 與 API 使用，未使用 NEXT_PUBLIC。
- **LINE Pay**：`LINE_PAY_CHANNEL_ID`、`LINE_PAY_CHANNEL_SECRET`、`LINE_PAY_ENV` — 若未設則從 DB `store_settings.frontend_settings.linePayApi` 讀取（JSON），僅 server 使用。

## 可能被 client 使用的

- **APP_URL / NEXT_PUBLIC_BASE_URL**：`getAppUrl()` 在 server 用於組 ReturnURL、confirmUrl、結果頁等；若僅在 server 呼叫則無洩漏；需確認無在 client component 或 getServerSideProps 以外傳給 client 的程式碼用於組「含密鑰」的 URL。
- **NEXT_PUBLIC_CLIENT_ID**：為 merchant_id，非金流密鑰，暴露屬預期。

## 混用／命名

- **單一來源**：ECPay 在 callback/checkout 各自 `getEcpayCreds()` 讀 env；NewebPay 統一由 `lib/newebpay/config.ts` 的 `getNewebpayConfig()`/`getNewebpayCreds()` 讀取，無混用。
- **LINE Pay**：credentials 來自 env 或 DB，confirm 與 createBooking 皆透過同一 `getLinePaySandboxCredentials` 邏輯，一致。

## Log 與敏感資訊

- **ECPay checkout**：`console.log` 含 CheckMacValue 前 8 字元、參數列表；production 建議關閉或改為非敏感欄位（見 M4）。
- **NewebPay**：callback/result 使用 `getNewebpayCredsForLog()` 僅輸出遮罩後 hashKey/hashIv，未輸出明文。
- **建議**：確認 production 不啟用 ECPAY_DEBUG_CHECKMAC 或 NODE_ENV=production 時關閉 debug。

---

# 6. 建議優先修復清單

## 1. 立刻要修

1. **C1**：ECPay / NewebPay callback 在「該筆訂單已 paid」時改為直接回 200（及 ECPay 的 1|OK），不呼叫 ensureCapacityAndMarkPaid，避免 500 與重試。
2. **C2**：LINE Pay confirm 在 create_booking_from_pending 回 ok:false 且為「pending 不存在」時，改為查詢是否已有該 transactionId 或 orderId 對應之 booking，若有則導向 success。

## 2. 上線前要修

3. **H1**：LINE Pay 失敗導向改為正確 course slug 或統一導向 `/member?error=...`，避免 `/course/course/checkout` 404。
4. **H3**：確認綠界回傳 CheckMacValue 規格是否排除空值，必要時調整 `ecpayCheckMacValueFromReceived`。
5. **H4**：結帳送出加 ref 鎖或 server 端冪等，防止連點雙重送出。
6. **M4**：ECPay checkout 的 debug 與 log 在 production 關閉或縮減，不固定 `debug: true`。

## 3. 可後續優化

7. **M1**：ECPay/NewebPay callback 寫入日誌表（擴充 payment_logs 或新表），便於對帳與爭議。
8. **M2**：ECPay/NewebPay 建單後寫入交易編號改為 RPC 內一筆完成，或補 log/告警。
9. **L2**：NewebPay cookie 加 HttpOnly。
10. **H2**：釐清藍新 ReturnURL 回傳格式，或明確以 NotifyURL 為唯一真源、結果頁僅查詢。

---

# 7. 需要手動驗證的測試清單

- [ ] **正常付款成功（三種金流）**：每種金流各走一次完整流程，確認 DB 為 paid、結果頁/成功頁正確、會員中心可見訂單。
- [ ] **Callback 重送**：同一筆付款之 callback 模擬重送（相同 MerchantTradeNo/MerchantOrderNo/transactionId），確認第二次回 200、DB 仍為一筆 paid、無重複建單。
- [ ] **Result route 失敗不影響狀態**：NewebPay result 解密失敗時導向 state=pending，確認僅結果頁顯示「處理中」或依 cookie 顯示正確；DB 仍僅由 callback 更新。
- [ ] **金流成功但 DB 暫時寫失敗**：若可模擬（例如暫時關 DB 或 RPC 錯誤），確認 callback 回 500、金流可能重試；修復 C1 後再測重送應回 200。
- [ ] **使用者重複點擊付款**：結帳頁快速連點兩次，確認是否出現兩筆 pending 或兩次導向；修復 H4 後再測應僅一筆。
- [ ] **未付款直接訪問 success / 結果頁**：直接開啟 `/payment/ecpay/result?MerchantTradeNo=某編號`、`/payment/newebpay/result?orderNo=某編號`、`/booking/success?bookingId=某編號`，確認僅顯示「處理中」「無法辨識」或對應狀態，不會把未付款訂單顯示為成功。
- [ ] **LINE Pay confirm 重複進入**：付款成功後對 confirm URL 再發一次 GET（模擬重新整理），修復前應會出現「建立訂單失敗」；修復 C2 後應導向 success 且不重複建單。
- [ ] **Sandbox / Production 切換**：切換 ECPAY_ENV、NEWEBPAY_ENV、LINE_PAY_ENV 後，確認 checkout 導向的 actionUrl 與 API 基底為對應環境，且金鑰為該環境專用。
- [ ] **ECPay 回傳空值欄位**：若綠界測試環境可產生含空值之 callback，確認驗簽仍通過；若有失敗再對照 H3 調整。
- [ ] **NewebPay 結果頁無 cookie**：清除 cookie 後以 state=pending 開啟結果頁，確認顯示「處理中」且不會誤顯示為成功。

---

*本報告依專案程式碼與 migrations 靜態審查產出；實際金流行為與官方文件若有差異，需以文件與實測為準。*
