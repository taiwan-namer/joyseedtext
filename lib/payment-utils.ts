import { createHash, createDecipheriv } from "crypto";

// ========== 綠界 ECPay ==========

import { ecpayCheckMacValue } from "@/lib/crypto-utils";

// ========== 藍新 NewebPay ==========

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
