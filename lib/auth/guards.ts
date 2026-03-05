import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/** 從環境變數讀取 ADMIN_EMAILS（逗號分隔），回傳小寫且去空白的 email 集合 */
function getAdminEmailsSet(): Set<string> {
  const raw = envTrim("ADMIN_EMAILS");
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * 使用 @supabase/ssr 的 createServerClient（anon key）從 cookie 取得當前使用者。
 * 無 session 時回傳 null。
 */
export async function getUserOrNull(): Promise<User | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Action / Route Handler 可寫入
          }
        },
      },
    }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * 要求已登入；未登入則 throw 401。
 */
export async function requireSignedIn(): Promise<User> {
  const user = await getUserOrNull();
  if (!user) {
    const err = new Error("Unauthorized") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return user;
}

/**
 * 先要求已登入，再檢查 user.email 是否在 ADMIN_EMAILS 白名單內；
 * 不在則 throw 403。
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireSignedIn();
  const adminEmails = getAdminEmailsSet();
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email || !adminEmails.has(email)) {
    const err = new Error("Forbidden") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return user;
}

/**
 * 統一取得 merchant_id（env NEXT_PUBLIC_CLIENT_ID），避免散落多處。
 */
export function getMerchantId(): string {
  return envTrim("NEXT_PUBLIC_CLIENT_ID");
}
