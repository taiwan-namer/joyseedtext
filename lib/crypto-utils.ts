import { createHash, createCipheriv } from "crypto";

// ========== 綠界 ECPay CheckMacValue ==========
// 實作集中於 lib/ecpay/checkmac.ts，此處轉出以維持既有引用
export { ecpayCheckMacValue } from "@/lib/ecpay/checkmac";

// ========== 藍新 NewebPay MPG 2.0 ==========

/**
 * 藍新 NewebPay MPG 2.0 加密工具
 * 規範：AES-256-CBC（PKCS7）、TradeInfo 輸出 hex；TradeSha = SHA256 大寫。
 */

/** 必填欄位：MerchantID, RespondType=JSON, TimeStamp, Version=2.0, MerchantOrderNo, Amt, ItemDesc, LoginType=0 */
export type NewebPayTradeInfoParams = Record<string, string>;

/**
 * 組成 TradeInfo 加密前的 Query String（key=value&，依傳入 key 順序，不排序）。
 */
export function newebpayBuildTradeInfoString(obj: NewebPayTradeInfoParams): string {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && String(obj[k]).trim() !== "");
  return keys.map((k) => `${k}=${obj[k]}`).join("&");
}

/**
 * AES-256-CBC 加密 TradeInfo 明文。
 * HashKey / HashIV 以字串傳入，內部轉為 Buffer（UTF-8）；藍新要求 Key 32 bytes、IV 16 bytes。
 * 加密後以 .toString('hex') 輸出。
 */
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

/**
 * TradeSha（MPG 2.0）：HashKey=${HashKey}&${TradeInfoHex}&HashIV=${HashIV} → SHA256 → 大寫 hex。
 */
export function newebpayGetTradeSha(
  tradeInfoHex: string,
  hashKey: string,
  hashIv: string
): string {
  const str = `HashKey=${hashKey}&${tradeInfoHex}&HashIV=${hashIv}`;
  return createHash("sha256").update(str, "utf8").digest("hex").toUpperCase();
}

/**
 * ItemDesc 僅限中英文與數字，去除空格與特殊字元（藍新規範）。
 */
export function newebpaySanitizeItemDesc(value: string): string {
  return value.replace(/\s/g, "").replace(/[^\w\u4e00-\u9fa5]/gi, "") || "Booking";
}
