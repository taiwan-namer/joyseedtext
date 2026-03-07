/**
 * 藍新 NewebPay TradeInfo 加密與 TradeSha
 * 規範：AES-256-CBC（PKCS7）、TradeInfo 輸出 hex；TradeSha = SHA256( HashKey=&TradeInfoHex&HashIV= ) 大寫。
 */
import { createHash, createCipheriv } from "crypto";

export function newebpayEncryptTradeInfo(
  plainText: string,
  hashKey: string,
  hashIv: string
): string {
  const key = Buffer.from(hashKey, "utf8");
  const iv = Buffer.from(hashIv, "utf8");
  if (key.length !== 32 || iv.length !== 16) {
    throw new Error(
      `NewebPay AES: HashKey 須 32 bytes、HashIV 須 16 bytes，目前 key=${key.length} iv=${iv.length}`
    );
  }
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  cipher.setAutoPadding(true);
  const enc = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return enc.toString("hex").toLowerCase();
}

export function newebpayGetTradeSha(
  tradeInfoHex: string,
  hashKey: string,
  hashIv: string
): string {
  const str = `HashKey=${hashKey}&${tradeInfoHex}&HashIV=${hashIv}`;
  return createHash("sha256").update(str, "utf8").digest("hex").toUpperCase();
}
