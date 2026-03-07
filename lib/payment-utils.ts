import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ========== 綠界 ECPay ==========

/**
 * 綠界 AIO CheckMacValue（SHA256）。
 * 順序：參數 A-Z 排序 → 組合 HashKey=...&Amt=...&...&HashIV=... → encodeURIComponent → 小寫
 *       → 綠界官方字元取代（7 項）→ SHA256 → 結果轉大寫。
 */
export function ecpayCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string
): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== "CheckMacValue" && params[k] !== undefined && String(params[k]).trim() !== "")
    .sort();
  const query = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  const beforeEncode = `HashKey=${hashKey}&${query}&HashIV=${hashIv}`;

  const masked = `HashKey=***&${query}&HashIV=***`;
  console.log("[ECPay CheckMac] 排序並加上 Key/IV 後的原始字串（Key/IV 已遮罩）:", masked);

  let encoded = encodeURIComponent(beforeEncode).replace(/%20/g, "+").toLowerCase();
  // 綠界官方要求：encode 並小寫後，必須手動執行以下 7 項字元取代
  encoded = encoded
    .replace(/%2d/g, "-")
    .replace(/%5f/g, "_")
    .replace(/%2e/g, ".")
    .replace(/%21/g, "!")
    .replace(/%2a/g, "*")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")");
  const hash = createHash("sha256").update(encoded, "utf8").digest("hex");
  return hash.toUpperCase();
}

/**
 * 驗證綠界回傳的 CheckMacValue（回傳參數同樣用 HashKey/HashIV 計算後比對）。
 */
export function ecpayVerifyCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string
): boolean {
  const received = params.CheckMacValue ?? "";
  const expected = ecpayCheckMacValue(params, hashKey, hashIv);
  return received.toUpperCase() === expected;
}

// ========== 藍新 NewebPay ==========

/**
 * 藍新 TradeInfo AES 加密（AES-256-CBC，PKCS7 padding）。
 * 使用 crypto.createCipheriv('aes-256-cbc', HashKey, HashIV)；Node 預設 setAutoPadding(true) 即為 PKCS7。
 * HashKey 32 bytes、HashIV 16 bytes；加密後轉為 hex（十六進位）字串。
 */
export function newebpayAesEncrypt(plainText: string, hashKey: string, hashIv: string): string {
  const key = Buffer.from(hashKey, "utf8");
  const iv = Buffer.from(hashIv, "utf8");
  if (key.length !== 32 || iv.length !== 16) {
    throw new Error(`NewebPay AES: HashKey 須 32 bytes、HashIV 須 16 bytes，目前 key=${key.length} iv=${iv.length}`);
  }
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  cipher.setAutoPadding(true); // PKCS7（Node 預設，勿手動關閉）
  const enc = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return enc.toString("hex");
}

/**
 * 藍新 AES 解密（callback 回傳的 TradeInfo 解密）。
 */
export function newebpayAesDecrypt(encryptedHex: string, hashKey: string, hashIv: string): string {
  const key = Buffer.from(hashKey, "utf8");
  const iv = Buffer.from(hashIv, "utf8");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  decipher.setAutoPadding(true);
  const buf = Buffer.from(encryptedHex, "hex");
  return decipher.update(buf).toString("utf8") + decipher.final("utf8");
}

/**
 * 藍新 TradeSha（MPG 2.0）：HashKey=${HashKey}&${TradeInfoHex}&HashIV=${HashIV} → SHA256 → 大寫 hex。
 */
export function newebpayTradeSha(tradeInfoEncryptedHex: string, hashKey: string, hashIv: string): string {
  const str = `HashKey=${hashKey}&${tradeInfoEncryptedHex}&HashIV=${hashIv}`;
  return createHash("sha256").update(str, "utf8").digest("hex").toUpperCase();
}

/**
 * 藍新 TradeInfo 明文：key=value& 連接。藍新不需依字母排序（與綠界不同），可依傳入 key 順序。
 * 必填：MerchantID, RespondType, TimeStamp(10 位 Unix), Version, MerchantOrderNo, Amt(整數字串), ItemDesc。
 */
export function newebpayQueryString(
  obj: Record<string, string | number | undefined>,
  options?: { sort?: boolean }
): string {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && obj[k] !== "");
  if (options?.sort !== false) keys.sort();
  return keys.map((k) => `${k}=${obj[k]}`).join("&");
}
