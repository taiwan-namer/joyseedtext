import { cookies } from "next/headers";

const ADMIN_SESSION_COOKIE = "admin_session";

/**
 * 後台寫入 Server Actions 二次驗證：讀取 admin_session cookie 並比對 ADMIN_SESSION_KEY，
 * 不符合則 throw，呼叫端須在 try/catch 處理或讓上層回傳 403。
 */
export async function getAdminSessionOrThrow(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const sessionKey = process.env.ADMIN_SESSION_KEY?.trim();
  if (!sessionKey || token !== sessionKey) {
    throw new Error("403: admin only");
  }
}
