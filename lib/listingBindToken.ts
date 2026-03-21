import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 辨識 DB 尚未有 `listing_bind_token` 欄位時的錯誤（Supabase／Postgres 常見字樣） */
export function isMissingListingBindTokenColumnError(message: string): boolean {
  const m = (message ?? "").toLowerCase();
  if (!m.includes("listing_bind_token")) return false;
  return (
    m.includes("does not exist") ||
    m.includes("unknown column") ||
    (m.includes("column") && m.includes("not found")) ||
    m.includes("could not find") ||
    m.includes("schema cache")
  );
}

/**
 * 產生全域唯一的 `listing_bind_token`（與 model 相同策略：迴圈隨機 + 查重）。
 */
export async function mintUniqueListingBindToken(supabase: SupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < 64; attempt++) {
    const token = randomBytes(12).toString("base64url");
    const { data, error } = await supabase
      .from("classes")
      .select("id")
      .eq("listing_bind_token", token)
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return token;
    }
  }
  throw new Error("無法產生唯一配對碼，請稍後再試");
}
