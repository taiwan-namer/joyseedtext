/**
 * 綠界 CheckMacValue 本地驗算
 * 使用與 lib/ecpay/checkmac.ts 相同流程，印出 sortedParams / encodedString / finalCheckMacValue
 * 使用方式：
 *   ECPAY_HASH_KEY=你的HashKey ECPAY_HASH_IV=你的HashIV node scripts/debug-ecpay-checkmac.mjs
 * 或 sandbox 測試：HashKey=ejCk326UnaZWKisg HashIV=q9jcZX8Ib9LM8wYk
 */
import crypto from "crypto";

const HASH_KEY = process.env.ECPAY_HASH_KEY?.trim() || "ejCk326UnaZWKisg";
const HASH_IV = process.env.ECPAY_HASH_IV?.trim() || "q9jcZX8Ib9LM8wYk";
const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID?.trim() || "2000132";

const ECPAY_SIGN_KEYS = [
  "ChoosePayment",
  "ClientBackURL",
  "EncryptType",
  "ItemName",
  "MerchantID",
  "MerchantTradeDate",
  "MerchantTradeNo",
  "OrderResultURL",
  "PaymentType",
  "ReturnURL",
  "TotalAmount",
  "TradeDesc",
];

const params = {
  MerchantID: MERCHANT_ID,
  MerchantTradeNo: "EC78069389NPF8",
  MerchantTradeDate: "2026/03/07 18:07:50",
  PaymentType: "aio",
  TotalAmount: "850",
  TradeDesc: "Course_Booking",
  ItemName: "課程預約",
  ReturnURL: "https://model-5lqo.vercel.app/api/ecpay/callback",
  OrderResultURL: "https://model-5lqo.vercel.app/payment/ecpay/result",
  ClientBackURL: "https://model-5lqo.vercel.app/member",
  ChoosePayment: "ALL",
  EncryptType: "1",
};

const ECPAY_REPLACE = [
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

const sortedKeys = ECPAY_SIGN_KEYS.filter((k) => params[k] != null && String(params[k]).trim() !== "").slice().sort();
const queryStringBeforeWrap = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
const stringBeforeEncode = `HashKey=${HASH_KEY}&${queryStringBeforeWrap}&HashIV=${HASH_IV}`;

const encoded = encodeURIComponent(stringBeforeEncode);
let normalizedString = encoded;
for (const [from, to] of ECPAY_REPLACE) {
  normalizedString = normalizedString.split(from).join(to);
}
normalizedString = normalizedString.toLowerCase();

const hash = crypto.createHash("sha256").update(normalizedString, "utf8").digest("hex");
const finalCheckMacValue = hash.toUpperCase();

console.log("=== ECPay CheckMacValue debug ===");
console.log("sortedParams:", sortedKeys.map((k) => `${k}=${params[k]}`));
console.log("queryStringBeforeWrap:", queryStringBeforeWrap);
console.log("stringBeforeEncode (HashKey/HashIV 遮罩):", `HashKey=***&...&HashIV=***`);
console.log("encodedString 長度:", encoded.length, "前 80 字元:", encoded.slice(0, 80) + (encoded.length > 80 ? "..." : ""));
console.log("normalizedString 長度:", normalizedString.length);
console.log("finalCheckMacValue:", finalCheckMacValue);
console.log("=== 請將此 CheckMacValue 與綠界錯誤時送出的值比對 ===");
