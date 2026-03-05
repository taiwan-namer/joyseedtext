/**
 * Middleware 用 helper：從 process.env.ADMIN_EMAILS（逗號分隔）解析出小寫 email 集合。
 * 僅在 Edge middleware 使用，不依賴 next/headers。
 */
export function getAdminEmailsSet(): Set<string> {
  const raw = process.env.ADMIN_EMAILS;
  const str = typeof raw === "string" ? raw.trim() : "";
  if (!str) return new Set();
  return new Set(
    str
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}
