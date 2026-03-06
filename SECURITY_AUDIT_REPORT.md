# 專案安全盤點與風險評分報告

**專案背景：** Next.js App Router、Server Actions、Supabase、admin 後台、cookie admin_session、middleware + (protected)/layout、verifyAdminSession() guard。

---

## 1️⃣ Admin 安全

### /admin route 結構

| 路徑 | 是否在 (protected) 下 | 說明 |
|------|------------------------|------|
| app/admin/login/page.tsx | 否 | 登入頁，不需保護 |
| app/admin/logout | 否 | 登出 route |
| app/admin/(protected)/page.tsx | 是 | 後台首頁 |
| app/admin/(protected)/about, bookings, members, settings, frontend-settings, payment-settings, seo, faq, intro/courses, classes/new, classes/edit/[id], enrollment | 是 | 皆在 (protected) 下 |

**結論：** 除 `/admin/login`、`/admin/logout` 外，其餘 admin 頁面皆在 `app/admin/(protected)/` 下。

### middleware.ts

- **Matcher：** `["/admin", "/admin/(.*)"]`，僅套用於 admin 路徑。
- **行為：** 非 /admin 直接 next()；/admin/logout 放行；/admin/login 若已有有效 cookie 則 redirect /admin；其餘 /admin 只加 `x-pathname` header 後 next()，**不在此阻擋未登入**。
- **結論：** Middleware 僅做路由與 pathname 傳遞，未在 middleware 內做「未登入 → redirect login」。

### app/admin/(protected)/layout.tsx

- 讀取 `cookies()` 的 `admin_session`，與 `process.env.ADMIN_SESSION_KEY` 比對。
- 不符則 `redirect(/admin/login?next=...)`。
- **結論：** 實際阻擋未登入 admin 的是此 layout，不是 middleware。

### Server Actions 的 verifyAdminSession()

- 後台「寫入」類 action 已於開頭呼叫 `await verifyAdminSession()`（見下方清單）。
- 部分後台「唯讀」action（如 getAdminBookings、getClassesForAdmin、getCourseIntroPostsForAdmin、getEnrollmentByCourse、getRollcallDates 等）**未**呼叫 verifyAdminSession()，若被直接呼叫可取得後台資料。

**Admin protection 狀態：**

- 路徑保護：✅ 除 login/logout 外皆在 (protected) 下，由 layout 驗證 cookie。
- 寫入類 action：✅ 皆有 verifyAdminSession()。
- 唯讀類後台 action：⚠️ 多數未加 verifyAdminSession()，依賴「只有進得了後台的人會觸發」。

---

## 2️⃣ Server Actions 安全

### 有 verifyAdminSession() 的 actions（Admin only，寫入或敏感）

| 檔案 | Function |
|------|----------|
| app/actions/productActions.ts | createClass, updateCourseCapacity, deleteClasses, createCourseFull, updateCourseFull |
| app/actions/courseIntroActions.ts | backupCourseToIntro, createCourseIntroPostManual, backfillCourseIntroFromClasses, deleteCourseIntroPosts |
| app/actions/frontendSettingsActions.ts | updateFrontendSettings, updateAboutPage, updateSeoSettings, updatePaymentSettings |
| app/actions/storeSettingsActions.ts | updateFaqItems, updateStoreSettings |
| app/actions/bookingActions.ts | markBookingAsPaid, completeBooking, deleteBooking |
| app/actions/memberActions.ts | deleteMember |
| app/actions/adminAuthActions.ts | updateAdminPassword |

### 未加 verifyAdminSession() 的後台專用 actions（唯讀，理論上僅後台呼叫）

| 檔案 | Function | 說明 |
|------|----------|------|
| app/actions/productActions.ts | getClassesForAdmin, getCourseForEdit | 後台列表/編輯用 |
| app/actions/productActions.ts | uploadOneToR2 | 上傳 R2，多由已保護的 create/update 呼叫 |
| app/actions/courseIntroActions.ts | getCourseIntroPostsForAdmin | 後台課程介紹列表 |
| app/actions/bookingActions.ts | getAdminBookings, getEnrollmentByCourse, getRollcallDates, getRollcallDatesWithCounts, getRollcallSessionsByDate, getBookingsForSession | 後台訂單/點名簿 |

### Public actions（刻意不加 guard）

| 檔案 | Function |
|------|----------|
| app/actions/bookingActions.ts | createBooking, getCurrentMemberEmail, getCurrentMemberName, getMyBookings |
| app/actions/memberActions.ts | syncAuthUserToMembers, ensureMemberForBooking, registerMember |
| app/actions/storeSettingsActions.ts | getStoreSettings, getFaqItems |
| app/actions/frontendSettingsActions.ts | getFrontendSettings, getAboutPageData, getSeoSettings, getPaymentSettings |
| app/actions/productActions.ts | getCourseById, getCoursesForHomepage, uploadOneToR2（間接） |
| app/actions/courseIntroActions.ts | getCourseIntroPostsForPublic, getCourseIntroPostById |
| app/actions/adminAuthActions.ts | adminLogin, adminLogout |
| app/actions/captchaActions.ts | verifyCaptcha |

---

## 3️⃣ Supabase 使用

### SUPABASE_SERVICE_ROLE_KEY

- **定義處：** `lib/supabase/server.ts`（`createServerSupabase()`）。
- **僅在 server 使用：** 是，該檔為 server 端模組，僅被 Server Actions、Route Handlers、Layout 等引用。

### createServerSupabase() 使用位置

| 檔案 | 用途 |
|------|------|
| lib/supabase/server.ts | 定義（使用 SERVICE_ROLE_KEY） |
| app/auth/callback/route.ts | OAuth 後 members upsert |
| app/actions/productActions.ts | 課程 CRUD、R2 上傳後寫入 |
| app/actions/courseIntroActions.ts | 課程介紹 CRUD、備份 |
| app/actions/frontendSettingsActions.ts | store_settings 讀寫 |
| app/actions/storeSettingsActions.ts | store_settings、faq 讀寫 |
| app/actions/bookingActions.ts | createBooking RPC、訂單狀態、後台訂單/點名簿查詢、getCurrentMemberName 等 |
| app/actions/memberActions.ts | members 同步、ensure、register、delete |
| app/actions/adminAuthActions.ts | 後台登入驗證、密碼 hash 讀寫 |
| app/admin/(protected)/members/page.tsx | 後台會員列表查詢 |

**結論：** Service role 僅在 server 端使用，未暴露給 client。寫入/敏感操作多數有 verifyAdminSession 或業務邏輯（merchant_id）控管；createBooking、ensureMemberForBooking、syncAuthUserToMembers、registerMember 為刻意開放給前台，以 merchant_id / 參數控管。

---

## 4️⃣ API / Server Action 暴露風險

### 未保護且可能被未登入或任意使用者呼叫的 API（Server Actions）

- **createBooking**：未登入也可呼叫（會以傳入 email 寫入訂單）。結帳頁流程為「未登入先彈登入窗」，但若有人直接呼叫 action 仍可下單。
- **ensureMemberForBooking**：未驗證登入，僅驗證 merchant_id + 參數，可被任意呼叫寫入 members。
- **syncAuthUserToMembers**：需有 Supabase Auth session（登入後才會被呼叫），風險較低。
- **registerMember**：已改為「須登入」，並以登入者 email 寫入，防濫用已加強。
- **getMyBookings**：需有 Supabase Auth session（getCurrentMemberEmail），未登入會回傳「請先登入」，合理。
- **getStoreSettings, getFaqItems, getFrontendSettings, getAboutPageData, getSeoSettings, getPaymentSettings**：唯讀、公開設定，刻意對外。
- **getCourseById, getCoursesForHomepage, getCourseIntroPostsForPublic, getCourseIntroPostById**：唯讀、公開，刻意對外。
- **getAdminBookings, getClassesForAdmin, getCourseForEdit, getCourseIntroPostsForAdmin, getEnrollmentByCourse, getRollcallDates, getRollcallDatesWithCounts, getRollcallSessionsByDate, getBookingsForSession**：後台唯讀，未加 verifyAdminSession，若有人取得 action 引用可撈後台資料（Server Actions 無公開 URL，風險為「知道介面的人」）。
- **uploadOneToR2**：無 guard，若被直接呼叫可上傳檔案至 R2 bucket，屬中高風險。

### 總結：可能被未登入/任意使用者呼叫的 API

- 寫入：**createBooking**、**ensureMemberForBooking**（設計上開放，以 merchant_id 控管）；**uploadOneToR2**（未加 guard，建議僅由已保護的 action 呼叫或加 admin guard）。
- 後台唯讀：**getAdminBookings**、**getClassesForAdmin**、**getCourseForEdit**、**getCourseIntroPostsForAdmin**、**getEnrollmentByCourse**、**getRollcallDates**、**getRollcallDatesWithCounts**、**getRollcallSessionsByDate**、**getBookingsForSession**（無 verifyAdminSession，依賴 UI 僅在後台使用）。

---

## 5️⃣ 環境變數安全

### NEXT_PUBLIC_ 使用

| 變數 | 使用處 | 風險 |
|------|--------|------|
| NEXT_PUBLIC_SUPABASE_URL | client.ts、server.ts、auth/callback、memberActions | 公開 URL，可接受 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | client.ts、bookingActions（getCurrentMemberEmail）、memberActions、auth/callback | Anon key 設計為可暴露，需配合 RLS/業務邏輯 |
| NEXT_PUBLIC_CLIENT_ID | 多個 actions、layout、admin | 店家識別，非密鑰，可接受 |
| NEXT_PUBLIC_R2_PUBLIC_URL | productActions（上傳後回傳公開網址） | 僅為 CDN/公開網址前綴，可接受 |

**結論：** 無以 NEXT_PUBLIC_ 暴露 SUPABASE_SERVICE_ROLE_KEY 或 ADMIN_SESSION_KEY。

### SUPABASE_SERVICE_ROLE_KEY

- 僅在 `lib/supabase/server.ts` 讀取，該模組僅在 server 端被引用。✅ 僅在 server 使用。

### ADMIN_SESSION_KEY

- 使用處：middleware.ts、app/admin/(protected)/layout.tsx、lib/auth/verifyAdminSession.ts、lib/auth/requireAdminSession.ts、lib/auth/adminSession.ts、adminAuthActions.ts（登入後寫 cookie、密碼 hash salt）。
- 皆為 server 端或 server-only 模組。✅ 僅在 server 使用。

---

## 6️⃣ CAPTCHA / Rate limit

### /api/captcha

- **Method：** GET（產生驗證碼 SVG，答案存於 httpOnly cookie）。
- **POST：** 無；驗證由 server action verifyCaptcha 讀取 cookie 完成。
- **結論：** 僅 GET，無 POST；CAPTCHA 流程存在。

### login / register / booking 的 rate limit

- 搜尋結果：專案內**無** rate limit / throttle 相關實作。
- **結論：** login（含 adminLogin）、register、booking（createBooking）**皆無** rate limit，存在暴力嘗試或濫用風險。

---

## 7️⃣ Middleware

- **Matcher：** `["/admin", "/admin/(.*)"]`，僅匹配 admin，不匹配 /api 或其他路徑。
- **API 暴露：** 未對 /api/* 做任何阻擋或驗證；/api/captcha 僅 GET，無 middleware 保護。
- **結論：** Middleware 僅作用於 admin，不會誤擋 API；API 是否暴露取決於各 route/action 設計。

---

## 8️⃣ 安全評分與建議

### Security Score: **6.5 / 10**

| 項目 | 分數 | 說明 |
|------|------|------|
| Admin Security | 7/10 | 路徑與寫入 action 有保護；後台唯讀 action 未加 guard |
| Server Actions Security | 6/10 | 寫入類有 verifyAdminSession；唯讀後台與 uploadOneToR2 未保護 |
| API Exposure | 6/10 | createBooking/ensureMember 刻意開放；後台唯讀與 R2 上傳有暴露面 |
| Environment Variables | 8/10 | Service role、ADMIN_SESSION_KEY 僅 server；NEXT_PUBLIC_ 無敏感 key |
| Supabase Usage | 7/10 | Service role 僅 server；RLS 與業務邏輯並存，多租戶以 merchant_id 控管 |
| Bot Protection | 4/10 | 有 CAPTCHA；無 rate limit，登入/註冊/下單可被暴力或濫用 |

---

### High Risk

- **無 rate limit：** 登入、註冊、createBooking 可被暴力嘗試或大量請求，建議在 login / register / createBooking 路徑或 action 加上 rate limit（依 IP 或 identifier）。
- **uploadOneToR2 未保護：** 任何能呼叫此 action 的端點都可上傳檔案至 R2，建議僅由已加 verifyAdminSession 的 action 呼叫，或對 uploadOneToR2 做來源/權限檢查。
- **後台唯讀 actions 未驗證：** getAdminBookings、getClassesForAdmin、getCourseIntroPostsForAdmin、getEnrollmentByCourse、getRollcallDates 等若被取得引用可撈後台資料，建議加上 `await verifyAdminSession()`。

---

### Medium Risk

- **ensureMemberForBooking 無登入要求：** 可被任意呼叫寫入 members，依賴 merchant_id 與業務邏輯；若需更嚴格可考慮改為「須登入且 email 與登入者一致」。
- **createBooking 未強制登入：** 目前由前端流程引導登入，action 本身未強制 session；若希望僅登入者可下單，可在 createBooking 開頭檢查 Supabase session。
- **Middleware 不阻擋未登入 admin：** 實際阻擋在 layout，若 middleware 能讀取 env 且一致驗證 cookie，可考慮在 middleware 做一層阻擋以減少進入 (protected) 的請求。

---

### Low Risk

- **NEXT_PUBLIC_CLIENT_ID 等為識別用：** 非密鑰，暴露可接受。
- **重複的 guard 實作：** adminSession.ts、requireAdminSession.ts、verifyAdminSession.ts 功能重疊，可整併為單一 verifyAdminSession 以利維護。

---

### Recommendations

1. **Rate limit：** 對 admin 登入、前台登入/註冊、createBooking 加上依 IP 或 identifier 的 rate limit（例如 Upstash、Vercel KV 或自建）。
2. **後台唯讀 actions：** 為 getAdminBookings、getClassesForAdmin、getCourseForEdit、getCourseIntroPostsForAdmin、getEnrollmentByCourse、getRollcallDates、getRollcallDatesWithCounts、getRollcallSessionsByDate、getBookingsForSession 加上 `await verifyAdminSession()`。
3. **uploadOneToR2：** 改為僅由已受 verifyAdminSession 保護的 action 呼叫，或在其內加入相同 admin 驗證。
4. **Guard 整併：** 統一使用 verifyAdminSession，移除或棄用 requireAdminSession / getAdminSessionOrThrow，減少重複與混淆。
5. **可選：** createBooking、ensureMemberForBooking 改為強制 Supabase 登入後才可呼叫，以符合「僅會員可下單」政策。
