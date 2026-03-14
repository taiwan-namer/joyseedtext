"use server";

import { cookies } from "next/headers";

const CAPTCHA_COOKIE_NAME = "captcha_answer";

/**
 * 驗證使用者輸入的驗證碼是否與後端 cookie 內儲存的答案一致（不區分大小寫）。
 * 驗證後會刪除 cookie，每組驗證碼僅能使用一次。
 */
export async function verifyCaptcha(userInput: string): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(CAPTCHA_COOKIE_NAME)?.value;

  if (!stored) {
    return { success: false, error: "驗證碼已過期，請重新取得" };
  }

  const decoded = decodeURIComponent(stored);
  const normalizedInput = (userInput ?? "").trim();
  const normalizedStored = decoded.trim();

  cookieStore.delete(CAPTCHA_COOKIE_NAME);

  if (normalizedInput.toLowerCase() !== normalizedStored.toLowerCase()) {
    return { success: false, error: "驗證碼錯誤" };
  }

  return { success: true };
}
