/**
 * 總站（HQ）與分站後台串接之 API 基底。
 * 「分站供應商註冊連結 mint」與「綁定／審核狀態查詢」共用同一 origin。
 */
export const HQ_MINT_URL =
  "https://www.joyseedisland.com.tw/api/vendor/branch/mint-registration-link";

export const HQ_ADMIN_SESSION_KEY_ENV = "HQ_ADMIN_SESSION_KEY";

/** 選填：覆寫預設之「供應商綁定／審核狀態」查詢網址（須為絕對 URL）。 */
export const HQ_VENDOR_BINDING_STATUS_URL_ENV = "HQ_VENDOR_BINDING_STATUS_URL";

export function hqOriginFromMintUrl(): string {
  return new URL(HQ_MINT_URL).origin;
}

/** 預設與 mint 同網域；總站需實作 POST JSON `{ branch_site_merchant_id }` 並回傳綁定狀態。 */
export function defaultVendorBindingStatusUrl(): string {
  return `${hqOriginFromMintUrl()}/api/vendor/branch/vendor-binding-status`;
}
