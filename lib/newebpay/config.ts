/**
 * 藍新 NewebPay 金流設定
 * 測試：ccore.newebpay.com/MPG/mpg_gateway
 * 正式：core.newebpay.com/MPG/mpg_gateway
 */

export const NEWEBPAY_STAGE_URL = "https://ccore.newebpay.com/MPG/mpg_gateway";
export const NEWEBPAY_PRODUCTION_URL = "https://core.newebpay.com/MPG/mpg_gateway";

export const NEWEBPAY_VERSION = "2.0";

export function getNewebpayActionUrl(): string {
  return (process.env.NEWEBPAY_ENV ?? "").trim().toLowerCase() === "production"
    ? NEWEBPAY_PRODUCTION_URL
    : NEWEBPAY_STAGE_URL;
}

export function getNewebpayCreds(): { merchantId: string; hashKey: string; hashIv: string } | null {
  const id = process.env.NEWEBPAY_MERCHANT_ID?.trim();
  const key = process.env.NEWEBPAY_HASH_KEY?.trim();
  const iv = process.env.NEWEBPAY_HASH_IV?.trim();
  if (!id || !key || !iv) return null;
  return { merchantId: id, hashKey: key, hashIv: iv };
}
