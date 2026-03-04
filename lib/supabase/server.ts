import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Server 端 Supabase 客戶端（僅在 Server Actions / API Routes 使用）
 * 使用 Service Role Key 以繞過 RLS，寫入時請自行以 merchant_id 等欄位控管所屬店家。
 */
export function createServerSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}
