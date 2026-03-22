/**
 * 綠界電子發票 B2C `Data` 欄位 AES-128-CBC 加解密（演算法實作於 lib/ecpay/invoice-encrypt.ts）。
 */
import {
  ecpayInvoiceEncryptData as encryptCore,
  ecpayInvoiceDecryptData as decryptCore,
} from "@/lib/ecpay/invoice-encrypt";

export const ecpayInvoiceEncryptData = encryptCore;

/**
 * 解密綠界發票 API 回傳的 `Data`：先對密文字串 URL Decode（若需要），再 Base64 → AES-128-CBC 解密（PKCS7 由 decipher 自動移除），最後將明文（URL-encoded JSON）decode 後 `JSON.parse`。
 */
export function ecpayInvoiceDecryptData(encryptedData: string, hashKey: string, hashIv: string): any {
  return decryptCore(encryptedData, hashKey, hashIv);
}
