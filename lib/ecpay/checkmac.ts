import { createHash } from "crypto";

/**
 * 綠界 ECPay 全方位金流 AIO CheckMacValue（EncryptType=1 使用 SHA256）
 * 依官方文件 https://developers.ecpay.com.tw/2902 實作：
 * (1) 參數依 key 英文字母 A-Z 排序
 * (2) 前加 HashKey=、後加 &HashIV=
 * (3) 整串 URL encode
 * (4) 依 ECPay 轉換表替換字元（%20→+ 及 7 個符號）
 * (5) 轉小寫
 * (6) SHA256 → 轉大寫
 * 不參與簽章：CheckMacValue 本身、空值參數。
 */

const ECPAY_REPLACE: [string, string][] = [
  ["%20", "+"],
  ["%2d", "-"],
  ["%5f", "_"],
  ["%2e", "."],
  ["%21", "!"],
  ["%2a", "*"],
  ["%2A", "*"],
  ["%28", "("],
  ["%29", ")"],
];

function maskSecret(s: string, showHead = 2, showTail = 2): string {
  if (s.length <= showHead + showTail) return "***";
  return s.slice(0, showHead) + "***" + s.slice(-showTail);
}

/**
 * 產生 CheckMacValue。params 為要送出的所有參數（含 CheckMacValue 以外的欄位），
 * 會自動排除 CheckMacValue 與空值，依 key 排序後與 HashKey/HashIV 組串、編碼、替換、小寫、SHA256、大寫。
 */
export function ecpayCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string
): string {
  const filtered = Object.keys(params)
    .filter((k) => k !== "CheckMacValue")
    .filter((k) => {
      const v = params[k];
      return v !== undefined && v !== null && String(v).trim() !== "";
    })
    .sort(); // A-Z 依 key 字母排序

  const query = filtered.map((k) => `${k}=${params[k]}`).join("&");
  const beforeEncode = `HashKey=${hashKey}&${query}&HashIV=${hashIv}`;

  const encoded = encodeURIComponent(beforeEncode);
  let afterReplace = encoded;
  for (const [from, to] of ECPAY_REPLACE) {
    afterReplace = afterReplace.split(from).join(to);
  }
  const toHash = afterReplace.toLowerCase();

  const hash = createHash("sha256").update(toHash, "utf8").digest("hex");
  const checkMacValue = hash.toUpperCase();

  if (process.env.NODE_ENV !== "production" || process.env.ECPAY_DEBUG_CHECKMAC === "1") {
    const sortedLog = filtered.map((k) => `${k}=${params[k]}`).join(" & ");
    console.log("[ECPay CheckMacValue] 參與簽章參數（排序後）:", sortedLog);
    console.log(
      "[ECPay CheckMacValue] 簽章前字串（HashKey/HashIV 已遮罩）:",
      `HashKey=${maskSecret(hashKey)}&...&HashIV=${maskSecret(hashIv)}`
    );
    console.log("[ECPay CheckMacValue] encode+replace+lower 後長度:", toHash.length);
    console.log("[ECPay CheckMacValue] 結果（前 8 字元）:", checkMacValue.slice(0, 8) + "...");
  }

  return checkMacValue;
}
