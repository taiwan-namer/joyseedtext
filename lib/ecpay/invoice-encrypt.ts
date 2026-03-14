/**
 * 綠界電子發票 B2C Data 欄位加密
 * 規格：先 URL Encode JSON 字串，再以 AES-128-CBC（PKCS7）加密，輸出 Base64。
 * 文件：https://developers.ecpay.com.tw/22040/（Message payload of Data: urlencode first, then AES encryption）
 */
import { createCipheriv } from "crypto";

export function ecpayInvoiceEncryptData(
  plainJsonString: string,
  hashKey: string,
  hashIv: string
): string {
  const key = Buffer.from(hashKey, "utf8");
  const iv = Buffer.from(hashIv, "utf8");
  if (key.length !== 16 || iv.length !== 16) {
    throw new Error(
      `ECPay 發票 AES: HashKey 與 HashIV 須各 16 字元（128 bit），目前 key=${key.length} iv=${iv.length}`
    );
  }
  const encoded = encodeURIComponent(plainJsonString);
  const cipher = createCipheriv("aes-128-cbc", key, iv);
  cipher.setAutoPadding(true);
  const enc = Buffer.concat([cipher.update(encoded, "utf8"), cipher.final()]);
  return enc.toString("base64");
}
