import { createHash } from "crypto";

/**
 * 綠界 ECPay 全方位金流 AIO CheckMacValue（EncryptType=1 使用 SHA256）
 * 依官方文件 https://developers.ecpay.com.tw/2902：
 * (1) 參數依 key A-Z 排序 (2) HashKey=...&query&HashIV=...
 * (3) 整串 URL encode (4) ECPay 替換表 (5) 轉小寫 (6) SHA256 → 大寫
 */

/** 參與簽章的欄位（與 form 送出必須完全一致），不含 CheckMacValue */
export const ECPAY_SIGN_KEYS = [
  "ChoosePayment",
  "ClientBackURL",
  "EncryptType",
  "ItemName",
  "MerchantID",
  "MerchantTradeDate",
  "MerchantTradeNo",
  "OrderResultURL",
  "PaymentType",
  "ReturnURL",
  "TotalAmount",
  "TradeDesc",
] as const;

const ECPAY_REPLACE: [string, string][] = [
  ["%20", "+"],
  ["%2d", "-"],
  ["%5f", "_"],
  ["%2e", "."],
  ["%21", "!"],
  ["%2a", "*"],
  ["%2A", "*"],
  ["%28", "("],
  ["%29", ")"],
];

function maskSecret(s: string, showHead = 2, showTail = 2): string {
  if (s.length <= showHead + showTail) return "***";
  return s.slice(0, showHead) + "***" + s.slice(-showTail);
}

export type EcpayCheckMacOptions = {
  /** 是否輸出完整 debug log（含 sortedParams, encodedString 等） */
  debug?: boolean;
};

function shouldDebug(options?: EcpayCheckMacOptions): boolean {
  return options?.debug ?? (process.env.NODE_ENV !== "production" || process.env.ECPAY_DEBUG_CHECKMAC === "1");
}

function buildCheckMacValueFromPairs(
  kvPairs: [string, string][],
  hashKey: string,
  hashIv: string,
  options?: EcpayCheckMacOptions
): string {
  const debug = shouldDebug(options);
  const queryStringBeforeWrap = kvPairs.map(([k, v]) => `${k}=${v}`).join("&");
  const stringBeforeEncode = `HashKey=${hashKey}&${queryStringBeforeWrap}&HashIV=${hashIv}`;

  const encoded = encodeURIComponent(stringBeforeEncode);
  let normalizedString = encoded;
  for (const [from, to] of ECPAY_REPLACE) {
    normalizedString = normalizedString.split(from).join(to);
  }
  normalizedString = normalizedString.toLowerCase();

  const hash = createHash("sha256").update(normalizedString, "utf8").digest("hex");
  const finalCheckMacValue = hash.toUpperCase();

  if (debug) {
    const sortedKeys = kvPairs.map(([k]) => k);
    console.log("[ECPay CheckMacValue] sortedParams:", kvPairs.map(([k, v]) => `${k}=${v}`));
    console.log("[ECPay CheckMacValue] queryStringBeforeWrap:", queryStringBeforeWrap);
    console.log(
      "[ECPay CheckMacValue] stringBeforeEncode (HashKey/HashIV 遮罩):",
      `HashKey=${maskSecret(hashKey)}&${queryStringBeforeWrap}&HashIV=${maskSecret(hashIv)}`
    );
    console.log("[ECPay CheckMacValue] encodedString 長度:", encoded.length, "前 80 字元:", encoded.slice(0, 80) + "...");
    console.log("[ECPay CheckMacValue] normalizedString 長度:", normalizedString.length);
    console.log("[ECPay CheckMacValue] finalCheckMacValue:", finalCheckMacValue);
    console.log("[ECPay CheckMacValue] keys used:", sortedKeys);
  }

  return finalCheckMacValue;
}

/**
 * 產生 CheckMacValue。僅使用 ECPAY_SIGN_KEYS 內且值非空的欄位，依 key 排序後與 HashKey/HashIV 組串、編碼、替換、小寫、SHA256、大寫。
 * 保證不納入 CheckMacValue 本身。
 */
export function ecpayCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string,
  options?: EcpayCheckMacOptions
): string {
  const sortedKeys = ECPAY_SIGN_KEYS.filter((k) => {
    const v = params[k];
    return v !== undefined && v !== null && String(v).trim() !== "";
  }).slice().sort(); // 只簽章明確定義的 key，並排序

  const kvPairs: [string, string][] = sortedKeys.map((k) => [k, params[k]]);
  return buildCheckMacValueFromPairs(kvPairs, hashKey, hashIv, options);
}

/**
 * 依綠界「回傳的完整參數」重新計算 CheckMacValue（用於 callback / result 驗簽）。
 * 使用「收到的所有欄位」排除 CheckMacValue 與空值，依 key A-Z 排序，其餘流程同 ecpayCheckMacValue。
 * 綠界回傳參數與下單參數不同，必須用收到的 payload 驗簽。
 */
export function ecpayCheckMacValueFromReceived(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string
): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "CheckMacValue")
    .sort();
  const kvPairs: [string, string][] = sortedKeys.map((k) => [k, params[k] ?? ""]);
  return buildCheckMacValueFromPairs(kvPairs, hashKey, hashIv);
}

/**
 * 通用版 CheckMacValue：給任意參數物件使用（例如電子發票 API）。
 * - 排除 key 為 CheckMacValue
 * - 排除值為空字串或僅空白
 * - 依 key A-Z 排序，其餘流程同 ecpayCheckMacValue
 */
export function ecpayCheckMacValueForParams(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string,
  options?: EcpayCheckMacOptions
): string {
  const kvPairs: [string, string][] = Object.keys(params)
    .filter((k) => k !== "CheckMacValue")
    .map((k) => [k, params[k]])
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return buildCheckMacValueFromPairs(kvPairs, hashKey, hashIv, options);
}
