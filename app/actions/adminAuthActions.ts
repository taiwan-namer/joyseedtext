"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { scryptSync, timingSafeEqual } from "crypto";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";

const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天
const HASH_KEYLEN = 64;
const HASH_SALT_PREFIX = "admin-pwd-v1:";

function getEnv(key: string): string {
  const v = process.env[key];
  return typeof v === "string" ? v.trim() : "";
}

function hashPassword(password: string): string {
  const salt = HASH_SALT_PREFIX + getEnv("ADMIN_SESSION_KEY");
  return scryptSync(password, salt, HASH_KEYLEN).toString("hex");
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const h = hashPassword(password);
    if (h.length !== storedHash.length) return false;
    return timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}

/**
 * 後台登入：驗證帳號密碼，通過則寫入 httpOnly cookie。
 * 密碼可為：(1) 萬能鑰匙 ADMIN_MASTER_KEY（env）、(2) 基本資料自訂密碼（DB hash）、(3) 環境變數 ADMIN_PASSWORD。
 * 帳號必須為 ADMIN_ACCOUNT。ADMIN_SESSION_KEY 僅用於簽 session，與密碼無關。
 */
export async function adminLogin(formData: FormData): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  const account = (formData.get("account") as string)?.trim() ?? "";
  const password = (formData.get("password") as string) ?? "";

  const envAccount = getEnv("ADMIN_ACCOUNT");
  const sessionKey = getEnv("ADMIN_SESSION_KEY");
  const masterKey = getEnv("ADMIN_MASTER_KEY");
  const envPassword = getEnv("ADMIN_PASSWORD");

  if (!envAccount || !sessionKey) {
    return { success: false, error: "後台尚未設定：請在環境變數設定 ADMIN_ACCOUNT、ADMIN_SESSION_KEY" };
  }

  if (account !== envAccount) {
    return { success: false, error: "帳號或密碼錯誤" };
  }

  let passwordOk = false;
  if (masterKey && password === masterKey) {
    passwordOk = true;
  } else {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("store_settings")
      .select("admin_password_hash")
      .eq("merchant_id", getEnv("NEXT_PUBLIC_CLIENT_ID"))
      .maybeSingle();
    const storedHash = (data as { admin_password_hash?: string | null } | null)?.admin_password_hash;
    if (storedHash && verifyPassword(password, storedHash)) {
      passwordOk = true;
    } else if (!storedHash && envPassword && password === envPassword) {
      passwordOk = true;
    }
  }

  if (!passwordOk) {
    return { success: false, error: "帳號或密碼錯誤" };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, sessionKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return { success: true };
}

/**
 * 後台登出：刪除 admin session cookie 並導向登入頁。
 */
export async function adminLogout(): Promise<never> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}

/**
 * 基本資料頁：更新後台登入密碼（需提供目前密碼以驗證身分）。
 * 目前密碼可為：萬能鑰匙、已設定的自訂密碼、或環境變數 ADMIN_PASSWORD（尚未設定自訂密碼時）。
 */
export async function updateAdminPassword(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  await verifyAdminSession();
  const merchantId = getEnv("NEXT_PUBLIC_CLIENT_ID");
  if (!merchantId) return { success: false, error: "未設定店家" };

  const newPwd = (newPassword ?? "").trim();
  const confirm = (confirmNewPassword ?? "").trim();
  if (newPwd.length < 4) return { success: false, error: "新密碼至少 4 個字元" };
  if (newPwd !== confirm) return { success: false, error: "兩次輸入的新密碼不一致" };

  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("store_settings")
    .select("admin_password_hash")
    .eq("merchant_id", merchantId)
    .maybeSingle();
  const storedHash = (data as { admin_password_hash?: string | null } | null)?.admin_password_hash;

  const masterKey = getEnv("ADMIN_MASTER_KEY");
  const envPassword = getEnv("ADMIN_PASSWORD");
  let currentOk = false;
  if (masterKey && (currentPassword ?? "") === masterKey) currentOk = true;
  else if (storedHash && verifyPassword(currentPassword ?? "", storedHash)) currentOk = true;
  else if (!storedHash && envPassword && (currentPassword ?? "") === envPassword) currentOk = true;

  if (!currentOk) return { success: false, error: "目前密碼錯誤（可填萬能鑰匙或現有後台密碼）" };

  const newHash = hashPassword(newPwd);
  const { error } = await supabase
    .from("store_settings")
    .upsert(
      { merchant_id: merchantId, admin_password_hash: newHash, updated_at: new Date().toISOString() },
      { onConflict: "merchant_id" }
    );
  if (error) return { success: false, error: error.message };
  return { success: true, message: "後台登入密碼已更新" };
}
