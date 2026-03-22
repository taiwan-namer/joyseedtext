import { createHash, createDecipheriv } from "crypto";

// ========== 綠界 ECPay ==========

import { ecpayCheckMacValue } from "@/lib/crypto-utils";

// ========== 藍新 NewebPay ==========

function newebpayNormTradeInfoHex(encryptedHex: string): string {
  let hex = encryptedHex.trim().replace(/^\ufeff/, "").replace(/[\u200B-\u200D\uFEFF]/g, "");
  hex = hex.replace(/\s+/g, "");
  if ((hex.startsWith('"') && hex.endsWith('"')) || (hex.startsWith("'") && hex.endsWith("'"))) {
    hex = hex.slice(1, -1).trim().replace(/\s+/g, "");
  }
  return hex;
}

/**
 * 藍新 AES 解密（callback 回傳的 TradeInfo 解密）。
 * TradeInfo 官方為 hex；若含空白／BOM／零寬字元會導致 ERR_OSSL_BAD_DECRYPT，先正規化。
 * 先試 PKCS7（setAutoPadding true）；失敗則試手動去 padding（相容部分舊版／SDK 行為）。
 */
export function newebpayAesDecrypt(encryptedHex: string, hashKey: string, hashIv: string): string {
  const hex = newebpayNormTradeInfoHex(encryptedHex);
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
  const buf = Buffer.from(hex, "hex");

  try {
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    decipher.setAutoPadding(true);
    return decipher.update(buf).toString("utf8") + decipher.final("utf8");
  } catch {
    const decipher2 = createDecipheriv("aes-256-cbc", key, iv);
    decipher2.setAutoPadding(false);
    let dec = Buffer.concat([decipher2.update(buf), decipher2.final()]);
    const n = dec[dec.length - 1] ?? 0;
    if (n >= 1 && n <= 16 && dec.length >= n) {
      const tail = dec.subarray(dec.length - n);
      if (tail.every((b) => b === n)) {
        dec = dec.subarray(0, dec.length - n);
        return dec.toString("utf8");
      }
    }
    throw new Error("NewebPay AES 解密失敗（padding）");
  }
}

/**
 * 藍新 TradeSha（MPG 2.0）：HashKey=${HashKey}&${TradeInfoHex}&HashIV=${HashIV} → SHA256 → 大寫 hex。
 */
export function newebpayTradeSha(tradeInfoEncryptedHex: string, hashKey: string, hashIv: string): string {
  const hex = newebpayNormTradeInfoHex(tradeInfoEncryptedHex);
  const str = `HashKey=${hashKey}&${hex}&HashIV=${hashIv}`;
  return createHash("sha256").update(str, "utf8").digest("hex").toUpperCase();
}

/**
 * 驗證藍新回傳的 TradeSha；少數環境／文件版本組字串略有差異，逐一比對。
 */
export function newebpayVerifyTradeSha(
  receivedTradeSha: string,
  tradeInfoEncryptedHex: string,
  hashKey: string,
  hashIv: string
): { ok: boolean; matchedVariant?: string } {
  const recv = receivedTradeSha.trim().replace(/\s+/g, "").toUpperCase();
  const hex = newebpayNormTradeInfoHex(tradeInfoEncryptedHex);
  const variants: { label: string; piece: string }[] = [
    { label: "HashKey&hex&HashIV", piece: `HashKey=${hashKey}&${hex}&HashIV=${hashIv}` },
    { label: "HashKey&TradeInfo=&HashIV", piece: `HashKey=${hashKey}&TradeInfo=${hex}&HashIV=${hashIv}` },
    { label: "HashKey&lower(hex)&HashIV", piece: `HashKey=${hashKey}&${hex.toLowerCase()}&HashIV=${hashIv}` },
    { label: "HashKey&upper(hex)&HashIV", piece: `HashKey=${hashKey}&${hex.toUpperCase()}&HashIV=${hashIv}` },
  ];
  for (const v of variants) {
    const expected = createHash("sha256").update(v.piece, "utf8").digest("hex").toUpperCase();
    if (recv === expected) return { ok: true, matchedVariant: v.label };
  }
  return { ok: false };
}
