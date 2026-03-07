import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ========== 綠界 ECPay ==========

/**
 * 綠界 AIO CheckMacValue（SHA256）。依官方附錄 Checksum：
 * 參數 A-Z 排序 → 組合 HashKey=值&key=value&...&HashIV=值 → URLEncode → 小寫 → 綠界特殊字元還原 → SHA256 → 大寫。
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
  encoded = encoded
    .replace(/%29/g, ")")
    .replace(/%28/g, "(")
    .replace(/%2a/g, "*")
    .replace(/%21/g, "!")
    .replace(/%2e/g, ".")
    .replace(/%5f/g, "_")
    .replace(/%2d/g, "-");
  return createHash("sha256").update(encoded, "utf8").digest("hex").toUpperCase();
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
 * HashKey 32 字元、HashIV 16 字元；明文 key=value& 加密後以 bin2hex（十六進位）輸出。
 */
export function newebpayAesEncrypt(plainText: string, hashKey: string, hashIv: string): string {
  const key = Buffer.from(hashKey, "utf8");
  const iv = Buffer.from(hashIv, "utf8");
  if (key.length !== 32 || iv.length !== 16) {
    throw new Error(`NewebPay AES: HashKey 須 32 bytes、HashIV 須 16 bytes，目前 key=${key.length} iv=${iv.length}`);
  }
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  cipher.setAutoPadding(true);
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
 * 藍新 TradeSha（MPG 2.0）：SHA256("HashKey=" + HashKey + "&" + TradeInfo密文 + "&HashIV=" + HashIV)，結果轉大寫 hex。
 */
export function newebpayTradeSha(tradeInfoEncryptedHex: string, hashKey: string, hashIv: string): string {
  const str = `HashKey=${hashKey}&${tradeInfoEncryptedHex}&HashIV=${hashIv}`;
  return createHash("sha256").update(str, "utf8").digest("hex").toUpperCase();
}

/**
 * 藍新 TradeInfo 明文：key=value&，key 依 A-Z 排序。必填：MerchantID, RespondType, TimeStamp, Version, MerchantOrderNo, Amt, ItemDesc。
 */
export function newebpayQueryString(obj: Record<string, string | number | undefined>): string {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && obj[k] !== "").sort();
  return keys.map((k) => `${k}=${obj[k]}`).join("&");
}
