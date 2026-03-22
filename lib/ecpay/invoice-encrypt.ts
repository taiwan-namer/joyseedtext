/**
 * 綠界電子發票 B2C Data 欄位加解密
 * 規格：先 URL Encode JSON 字串，再以 AES-128-CBC（PKCS7）加密，輸出 Base64。
 * 解密：Base64 解碼 → AES-128-CBC 解密 → UTF-8 字串（仍為 URL-encoded）→ decodeURIComponent → JSON。
 * 文件：https://developers.ecpay.com.tw/22040/
 */
import { createCipheriv, createDecipheriv } from "crypto";

export function ecpayInvoiceEncryptData(
  plainJsonString: string,
  hashKey: string,
  hashIv: string
): string {
  const { key, iv } = assertInvoiceAesKeyIv(hashKey, hashIv);
  const encoded = encodeURIComponent(plainJsonString);
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  cipher.setAutoPadding(true);
  const enc = Buffer.concat([cipher.update(encoded, "utf8"), cipher.final()]);
  return enc.toString("base64");
}

/** @internal 供 encrypt / decrypt 共用 */
function assertInvoiceAesKeyIv(hashKey: string, hashIv: string): { key: Buffer; iv: Buffer } {
  const key = Buffer.from(hashKey, "utf8");
  const iv = Buffer.from(hashIv, "utf8");
  if (key.length !== 16 || iv.length !== 16) {
    throw new Error(
      `ECPay 發票 AES: HashKey 與 HashIV 須各 16 字元（128 bit），目前 key=${key.length} iv=${iv.length}`
    );
  }
  return { key, iv };
}

/**
 * 解密綠界發票 API 回傳的 `Data`（Base64 密文）。
 * 若外層對 Data 再做過 URL 編碼，會先 decodeURIComponent 再 Base64 解碼。
 */
export function ecpayInvoiceDecryptData(encryptedData: string, hashKey: string, hashIv: string): unknown {
  const trimmed = encryptedData.trim();
  let b64 = trimmed;
  try {
    b64 = decodeURIComponent(trimmed);
  } catch {
    b64 = trimmed;
  }

  const { key, iv } = assertInvoiceAesKeyIv(hashKey, hashIv);
  const buf = Buffer.from(b64, "base64");
  const decipher = createDecipheriv("aes-128-cbc", key, iv);
  decipher.setAutoPadding(true);
  const decrypted = Buffer.concat([decipher.update(buf), decipher.final()]);
  const urlEncodedPlain = decrypted.toString("utf8");
  const jsonStr = decodeURIComponent(urlEncodedPlain);
  return JSON.parse(jsonStr) as unknown;
}
