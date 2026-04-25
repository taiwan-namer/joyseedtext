"use server";

import { createServerSupabase } from "@/lib/supabase/server";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * 分站首次啟用：建立最小 store_settings（僅站點名稱）。
 * 僅允許建立當前 NEXT_PUBLIC_CLIENT_ID 的資料，不接受任意 merchant_id。
 */
export async function ensureBranchStoreProfile(siteName: string): Promise<
  | { success: true; message: string }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID，無法建立分站資料。" };
    }

    const name = (siteName ?? "").trim();
    if (!name) {
      return { success: false, error: "請先填寫網站名稱。" };
    }
    if (name.length > 80) {
      return { success: false, error: "網站名稱過長，請控制在 80 字內。" };
    }

    const supabase = createServerSupabase();
    const { data: existing, error: fetchErr } = await supabase
      .from("store_settings")
      .select("merchant_id, site_name")
      .eq("merchant_id", merchantId)
      .maybeSingle();
    if (fetchErr) return { success: false, error: fetchErr.message };

    if (existing?.merchant_id) {
      return { success: true, message: "已存在分站基本資料，請進行下一步 LINE 綁定。" };
    }

    const { error: insertErr } = await supabase.from("store_settings").insert({
      merchant_id: merchantId,
      site_name: name,
      updated_at: new Date().toISOString(),
    });
    if (insertErr) return { success: false, error: insertErr.message };

    return { success: true, message: "已建立分站基本資料，請進行 LINE 綁定。" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "建立分站資料失敗";
    return { success: false, error: message };
  }
}
