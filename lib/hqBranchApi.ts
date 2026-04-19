/**
 * 總站（HQ）與分站後台串接：分站供應商註冊連結 mint。
 * 綁定／審核狀態改由 Supabase 表 line_user_mappings、vendor_registration_applications 讀取（見 lib/vendorBindingStatus.ts）。
 */
export const HQ_MINT_URL =
  "https://www.joyseedisland.com.tw/api/vendor/branch/mint-registration-link";

export const HQ_ADMIN_SESSION_KEY_ENV = "HQ_ADMIN_SESSION_KEY";

export function hqOriginFromMintUrl(): string {
  return new URL(HQ_MINT_URL).origin;
}
