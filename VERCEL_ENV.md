# Vercel 環境變數清單

部署至 Vercel 前，請在 **Settings → Environment Variables** 填入以下變數（Production / Preview / Development 依需求勾選）。

## 必填（核心與 LINE Pay）

| 變數名稱 | 說明 | 範例（測試） |
|----------|------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key（勿填 service_role） | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key（僅後端） | `eyJ...` |
| `NEXT_PUBLIC_CLIENT_ID` | 店家 merchant_id（多租戶） | 你的 merchant_id |
| `NEXT_PUBLIC_BASE_URL` | 站點基底網址（LINE Pay confirmUrl/cancelUrl、auth 導回） | 測試：`https://your-app.vercel.app` |
| `LINE_PAY_CHANNEL_ID` | LINE Pay Channel ID（Sandbox 或正式） | 從 LINE Pay 後台取得 |
| `LINE_PAY_CHANNEL_SECRET` | LINE Pay Channel Secret | 從 LINE Pay 後台取得 |
| `LINE_PAY_ENV` | `sandbox` 或 `production` | `sandbox` |

## 必填（後台登入）

| 變數名稱 | 說明 |
|----------|------|
| `ADMIN_ACCOUNT` | 後台登入帳號 |
| `ADMIN_PASSWORD` | 後台預設密碼（未設自訂密碼時使用） |
| `ADMIN_MASTER_KEY` | 萬能鑰匙（可略過自訂密碼） |
| `ADMIN_SESSION_KEY` | Session 簽名用，建議 `openssl rand -hex 32` 產生 |

## 選填（依功能）

| 變數名稱 | 說明 |
|----------|------|
| `R2_ACCOUNT_ID` | Cloudflare R2 Account ID（有上傳圖片才需） |
| `R2_ACCESS_KEY_ID` | R2 Access Key |
| `R2_SECRET_ACCESS_KEY` | R2 Secret Key |
| `R2_BUCKET_NAME` | R2 桶名稱 |
| `R2_ENDPOINT` | R2 S3 相容 endpoint（如 `https://<account_id>.r2.cloudflarestorage.com`） |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | R2 公開讀取網址（結尾勿加 `/`） |

---

**重要**：`NEXT_PUBLIC_BASE_URL` 在 Vercel 上請設為你的正式網址（例如 `https://your-project.vercel.app`），勿使用 localhost。
