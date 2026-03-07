import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ========== 綠界 ECPay ==========

/**
 * 綠界 CheckMacValue（SHA256）。依官方 Checksum 公式：
 * SHA256(URLEncode(HashKey + Data + HashIV)) → 轉小寫 → SHA256 → 轉大寫。
 * Data = 參數依 key A-Z 排序，key=value 用 & 串接（原始值，不先 encode）；不加 HashKey= / HashIV= 前綴。
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
  const beforeHash = hashKey + query + hashIv;
  const encoded = encodeURIComponent(beforeHash).replace(/%20/g, "+").toLowerCase();
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
 * 藍新 AES 加密（AES-256-CBC，PKCS7 padding）。
 * HashKey 為 32 字元、HashIV 為 16 字元；加密後轉 hex 或 base64，此處依官方慣例用 AES 加密後再以 hex 輸出。
 * 實際為：將 TradeInfo 字串（key=value&）加密，結果為二進位，再轉成 hex 字串。
 */
export function newebpayAesEncrypt(plainText: string, hashKey: string, hashIv: string): string {
  const key = Buffer.from(hashKey, "utf8");
  const iv = Buffer.from(hashIv, "utf8");
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
 * 藍新 TradeSha：SHA256(HashKey + TradeInfo + HashIV)，結果轉大寫 hex。
 */
export function newebpayTradeSha(tradeInfo: string, hashKey: string, hashIv: string): string {
  const str = hashKey + tradeInfo + hashIv;
  return createHash("sha256").update(str).digest("hex").toUpperCase();
}

/**
 * 將物件轉成 key=value& 字串（key 依 A-Z 排序），用於藍新 TradeInfo 明文。
 */
export function newebpayQueryString(obj: Record<string, string | number | undefined>): string {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && obj[k] !== "").sort();
  return keys.map((k) => `${k}=${obj[k]}`).join("&");
}
