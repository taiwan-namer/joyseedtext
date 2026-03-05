import { createBrowserClient } from "@supabase/ssr";

/**
 * 瀏覽器端 Supabase 客戶端，用於登入頁等 Client Component。
 * 使用 Anon Key，配合 Supabase Auth (OAuth) 使用。
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createBrowserClient(url, anonKey);
}
