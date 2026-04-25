export function mapSupabaseAuthErrorToZh(message: string): string {
  const m = (message ?? "").trim();
  const l = m.toLowerCase();
  if (!l) return "驗證失敗，請稍後再試。";
  if (l.includes("token") && (l.includes("expired") || l.includes("invalid") || l.includes("wrong"))) {
    return "驗證碼錯誤或已逾期，請重新取得驗證碼。";
  }
  if (l.includes("otp") && (l.includes("expired") || l.includes("invalid"))) {
    return "驗證碼錯誤或已逾期，請重新取得驗證碼。";
  }
  if (l.includes("network") || l.includes("fetch")) {
    return "網路連線異常，請稍後再試。";
  }
  if (l.includes("already") && l.includes("registered")) {
    return "此信箱已註冊，請直接登入。";
  }
  if (l.includes("rate limit") || l.includes("too many")) {
    return "操作太頻繁，請稍後再試。";
  }
  return m;
}
