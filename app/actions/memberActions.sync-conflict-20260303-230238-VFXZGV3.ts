"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * 將「目前登入者」同步到 members 表（與 OAuth 回呼邏輯一致）。
 * 供 E-mail 登入／註冊成功後呼叫，確保後台 B會員功能管理 能列出該會員。
 * 使用 upsert，重複呼叫僅更新同一筆紀錄，merchant_id 強制用 env。
 */
export async function syncAuthUserToMembers(): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定店家" };

    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
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
              // Server Action 可寫入
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user?.email) {
      return { success: false, error: "無法取得登入資訊" };
    }

    const email = user.email.trim();
    const name =
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      email.split("@")[0] ||
      "會員";

    const supabaseAdmin = createServerSupabase();
    const { error: upsertErr } = await supabaseAdmin.from("members").upsert(
      {
        merchant_id: merchantId,
        name: name.trim() || null,
        phone: null,
        email,
      },
      { onConflict: "merchant_id,email" }
    );
    if (upsertErr) return { success: false, error: upsertErr.message };
    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "同步失敗";
    return { success: false, error: message };
  }
}

/**
 * 結帳時無痛辦帳號：以 upsert 寫入 members，同一 email 僅一筆，重複提交會更新為最新資料。
 * 供 checkout 在 createBooking 前呼叫，確保客人有會員紀錄可於後台查詢。
 */
export async function ensureMemberForBooking(params: {
  name: string;
  phone: string;
  email: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定店家" };

    const name = (params.name ?? "").trim();
    const phone = (params.phone ?? "").trim();
    const email = (params.email ?? "").trim();
    if (!email) return { success: false, error: "請填寫電子信箱" };

    const supabase = createServerSupabase();
    const { error: upsertErr } = await supabase.from("members").upsert(
      {
        merchant_id: merchantId,
        name: name || null,
        phone: phone || null,
        email,
      },
      { onConflict: "merchant_id,email" }
    );
    if (upsertErr) return { success: false, error: upsertErr.message };
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "建立會員資料失敗";
    return { success: false, error: msg };
  }
}

/**
 * 前台註冊／加入會員：以 upsert 寫入 members 表，同一 email 僅一筆，重複註冊會更新為最新資料。
 * merchant_id 強制使用 process.env.NEXT_PUBLIC_CLIENT_ID，確保綁定當前店家。
 */
export async function registerMember(formData: {
  name: string;
  phone: string;
  email: string;
}): Promise<
  | { success: true; message?: string }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return { success: false, error: "系統未設定店家資訊，請稍後再試" };
    }

    const name = (formData.name ?? "").trim();
    const phone = (formData.phone ?? "").trim();
    const email = (formData.email ?? "").trim();

    if (!name) return { success: false, error: "請填寫姓名" };
    if (!phone) return { success: false, error: "請填寫手機號碼" };
    if (!email) return { success: false, error: "請填寫電子信箱" };

    const supabase = createServerSupabase();
    const { error } = await supabase.from("members").upsert(
      {
        merchant_id: merchantId,
        name,
        phone,
        email,
      },
      { onConflict: "merchant_id,email" }
    );

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, message: "註冊成功" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "註冊失敗，請稍後再試";
    return { success: false, error: message };
  }
}
