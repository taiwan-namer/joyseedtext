/**
 * 總站（HQ）與分站後台串接：分站供應商註冊連結 mint。
 * 綁定／審核狀態改由 Supabase 表 line_user_mappings、vendor_registration_applications 讀取（見 lib/vendorBindingStatus.ts）。
 */
export const HQ_MINT_URL =
  "https://www.joyseedisland.com.tw/api/vendor/branch/mint-registration-link";

export const HQ_ADMIN_SESSION_KEY_ENV = "HQ_ADMIN_SESSION_KEY";
export const BRANCH_VENDOR_REGISTRATION_MINT_SECRET_ENV = "BRANCH_VENDOR_REGISTRATION_MINT_SECRET";
export const HQ_VENDOR_LINE_LOGIN_PATH = "/vendor/login";
export const HQ_CONSUME_LINE_HANDOFF_PATH = "/api/vendor/branch/consume-line-handoff";

export function hqOriginFromMintUrl(): string {
  return new URL(HQ_MINT_URL).origin;
}

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * 可覆寫：總站 LINE 入口（預設 {HQ_ORIGIN}/vendor/login）。
 */
export function getHqVendorLineLoginUrl(): string {
  const custom = envTrim("HQ_VENDOR_LINE_LOGIN_URL");
  if (custom) return custom;
  return new URL(HQ_VENDOR_LINE_LOGIN_PATH, hqOriginFromMintUrl()).toString();
}

/**
 * 可覆寫：總站 handoff consume 端點（預設 {HQ_ORIGIN}/api/vendor/branch/consume-line-handoff）。
 */
export function getHqConsumeLineHandoffUrl(): string {
  const custom = envTrim("HQ_CONSUME_LINE_HANDOFF_URL");
  if (custom) return custom;
  return new URL(HQ_CONSUME_LINE_HANDOFF_PATH, hqOriginFromMintUrl()).toString();
}
