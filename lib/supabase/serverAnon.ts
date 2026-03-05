import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server 端使用 Anon Key + Cookie Session 的 Supabase 客戶端。
 * 用於「後台寫入」（需 requireAdmin 後呼叫）與「需要 session 的查詢」。
 * 會受 RLS 限制；請搭配 RLS policy 僅限本 merchant。
 */
export async function createServerAnonSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
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
}
