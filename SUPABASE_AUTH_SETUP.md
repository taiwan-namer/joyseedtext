# Supabase 登入設定（Google + 傳統信箱）

## 1. 環境變數（必填）

在 `.env.local` 中：

- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**：必須填 **Dashboard → Settings → API → anon public** 的 key。  
  **不可**填 `service_role` key，否則傳統信箱註冊會出現：  
  `Forbidden use of secret API key in browser`。
- **`SUPABASE_SERVICE_ROLE_KEY`**：僅後端使用，不要給前端或 `NEXT_PUBLIC_*` 使用。

## 2. Google 登入（OAuth）

1. 開啟 **Supabase Dashboard** → **Authentication** → **Providers** → **Google**，設為 Enabled。
2. 若尚未設定，到 [Google Cloud Console](https://console.cloud.google.com/) 建立 OAuth 2.0 用戶端 ID（應用程式類型：網頁），並取得 **Client ID**、**Client Secret**。
3. 在 Google 的「已授權的重新導向 URI」中加入：
   - Supabase 提供的：`https://<你的專案>.supabase.co/auth/v1/callback`
4. 回到 Supabase → Google  provider，貼上 Client ID、Client Secret 並儲存。
5. **Authentication** → **URL Configuration**：
   - **Site URL**：例如 `http://localhost:3000` 或正式網域。
   - **Redirect URLs** 加入：
     - `http://localhost:3000/auth/callback`
     - 正式網域時：`https://你的網域/auth/callback`

完成後，首頁或登入頁點「以 Google 帳號繼續」應可正常跳轉並回到站內。

## 3. 傳統信箱註冊／登入

- 使用 **Email** provider（預設為啟用）。
- 確認 `.env.local` 裡前端只使用 **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**（anon public），沒有誤用 service_role key。
- 若需「信箱驗證後才能登入」：Authentication → Providers → Email → 可勾選 **Confirm email**；未勾選則註冊後即可登入。
