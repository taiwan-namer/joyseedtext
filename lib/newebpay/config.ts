/**
 * 藍新 NewebPay 金流設定（單一來源）
 * 測試：ccore.newebpay.com/MPG/mpg_gateway + 測試商店代號/HashKey/HashIV
 * 正式：core.newebpay.com/MPG/mpg_gateway + 正式商店代號/HashKey/HashIV
 * 不可混用：測試 URL 必須配測試商店代號，否則會出現 MPG03007 查無此商店代號。
 */

const NEWEBPAY_STAGE_URL = "https://ccore.newebpay.com/MPG/mpg_gateway";
const NEWEBPAY_PRODUCTION_URL = "https://core.newebpay.com/MPG/mpg_gateway";

export const NEWEBPAY_VERSION = "2.0";
export const NEWEBPAY_RESPOND_TYPE = "JSON";

function trimEnv(key: string): string {
  const v = process.env[key];
  return typeof v === "string" ? v.trim() : "";
}

function maskKey(s: string, head = 2, tail = 2): string {
  if (s.length <= head + tail) return "***";
  return s.slice(0, head) + "***" + s.slice(-tail);
}

export type NewebPayConfig = {
  isProduction: boolean;
  actionUrl: string;
  merchantId: string;
  hashKey: string;
  hashIv: string;
  version: string;
  respondType: string;
};

/**
 * 取得藍新設定。僅此處讀取 NEWEBPAY_* 環境變數，禁止在其他檔案重複讀取。
 * 若任一必填為空則回傳 null，並在 console 印出缺少項目。
 */
export function getNewebpayConfig(): NewebPayConfig | null {
  const merchantId = trimEnv("NEWEBPAY_MERCHANT_ID");
  const hashKey = trimEnv("NEWEBPAY_HASH_KEY");
  const hashIv = trimEnv("NEWEBPAY_HASH_IV");
  const isProduction = trimEnv("NEWEBPAY_ENV").toLowerCase() === "production";

  if (!merchantId || !hashKey || !hashIv) {
    const missing = [];
    if (!merchantId) missing.push("NEWEBPAY_MERCHANT_ID");
    if (!hashKey) missing.push("NEWEBPAY_HASH_KEY");
    if (!hashIv) missing.push("NEWEBPAY_HASH_IV");
    console.error("[NewebPay config] 缺少必填環境變數:", missing.join(", "));
    return null;
  }

  const actionUrl = isProduction ? NEWEBPAY_PRODUCTION_URL : NEWEBPAY_STAGE_URL;

  return {
    isProduction,
    actionUrl,
    merchantId,
    hashKey,
    hashIv,
    version: NEWEBPAY_VERSION,
    respondType: NEWEBPAY_RESPOND_TYPE,
  };
}

/** 取得 actionUrl（與 getNewebpayConfig 同邏輯，供僅需 URL 時使用） */
export function getNewebpayActionUrl(): string {
  const cfg = getNewebpayConfig();
  if (cfg) return cfg.actionUrl;
  return trimEnv("NEWEBPAY_ENV").toLowerCase() === "production"
    ? NEWEBPAY_PRODUCTION_URL
    : NEWEBPAY_STAGE_URL;
}

/** 取得商店金鑰（callback/result 用）。與 getNewebpayConfig 同一來源。 */
export function getNewebpayCreds(): { merchantId: string; hashKey: string; hashIv: string } | null {
  const cfg = getNewebpayConfig();
  if (!cfg) return null;
  return { merchantId: cfg.merchantId, hashKey: cfg.hashKey, hashIv: cfg.hashIv };
}

/** 供 log 用的遮罩金鑰（與 checkout 同一 config）。 */
export function getNewebpayCredsForLog(): { merchantId: string; hashKeyMask: string; hashIvMask: string } | null {
  const cfg = getNewebpayConfig();
  if (!cfg) return null;
  return {
    merchantId: cfg.merchantId,
    hashKeyMask: maskKey(cfg.hashKey),
    hashIvMask: maskKey(cfg.hashIv),
  };
}
