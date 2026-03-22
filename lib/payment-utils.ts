import { createHash, createDecipheriv } from "crypto";

// ========== 綠界 ECPay ==========

import { ecpayCheckMacValue } from "@/lib/crypto-utils";

// ========== 藍新 NewebPay ==========

/**
 * 藍新 AES 解密（callback 回傳的 TradeInfo 解密）。
 * TradeInfo 官方為 hex；若含空白／BOM／零寬字元會導致 ERR_OSSL_BAD_DECRYPT，先正規化。
 */
export function newebpayAesDecrypt(encryptedHex: string, hashKey: string, hashIv: string): string {
  let hex = encryptedHex.trim().replace(/^\ufeff/, "").replace(/[\u200B-\u200D\uFEFF]/g, "");
  hex = hex.replace(/\s+/g, "");
  if ((hex.startsWith('"') && hex.endsWith('"')) || (hex.startsWith("'") && hex.endsWith("'"))) {
    hex = hex.slice(1, -1).trim().replace(/\s+/g, "");
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("NewebPay TradeInfo 非有效 hex 字串");
  }
  if (hex.length % 2 !== 0) {
    throw new Error("NewebPay TradeInfo hex 長度須為偶數");
  }
  const key = Buffer.from(hashKey, "utf8");
  const iv = Buffer.from(hashIv, "utf8");
  if (key.length !== 32 || iv.length !== 16) {
    throw new Error(
      `NewebPay AES: HashKey 須 32 bytes、HashIV 須 16 bytes，目前 key=${key.length} iv=${iv.length}`
    );
  }
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  decipher.setAutoPadding(true);
  const buf = Buffer.from(hex, "hex");
  return decipher.update(buf).toString("utf8") + decipher.final("utf8");
}

/**
 * 藍新 TradeSha（MPG 2.0）：HashKey=${HashKey}&${TradeInfoHex}&HashIV=${HashIV} → SHA256 → 大寫 hex。
 * TradeInfoHex 與解密前使用相同正規化，避免空白／BOM 導致驗證與解密不一致。
 */
export function newebpayTradeSha(tradeInfoEncryptedHex: string, hashKey: string, hashIv: string): string {
  let hex = tradeInfoEncryptedHex.trim().replace(/^\ufeff/, "").replace(/[\u200B-\u200D\uFEFF]/g, "");
  hex = hex.replace(/\s+/g, "");
  if ((hex.startsWith('"') && hex.endsWith('"')) || (hex.startsWith("'") && hex.endsWith("'"))) {
    hex = hex.slice(1, -1).trim().replace(/\s+/g, "");
  }
  const str = `HashKey=${hashKey}&${hex}&HashIV=${hashIv}`;
  return createHash("sha256").update(str, "utf8").digest("hex").toUpperCase();
}
