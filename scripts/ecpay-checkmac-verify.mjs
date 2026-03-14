/**
 * 綠界 CheckMacValue 驗算腳本（與 lib/ecpay/checkmac.ts 演算法一致）
 * 使用官方文件範例驗證：預期結果 6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840
 * 執行：node scripts/ecpay-checkmac-verify.mjs
 */
import crypto from "crypto";

const HASH_KEY = "pwFHCqoQZGmho4w6";
const HASH_IV = "EkRm7iFT261dpevs";

const params = {
  TradeDesc: "促銷方案",
  PaymentType: "aio",
  MerchantTradeDate: "2023/03/12 15:30:23",
  MerchantTradeNo: "ecpay20230312153023",
  MerchantID: "3002607",
  ReturnURL: "https://www.ecpay.com.tw/receive.php",
  ItemName: "Apple iphone 15",
  TotalAmount: "30000",
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

const sortedKeys = Object.keys(params).sort();
const query = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
const beforeEncode = `HashKey=${HASH_KEY}&${query}&HashIV=${HASH_IV}`;

const encoded = encodeURIComponent(beforeEncode);
let afterReplace = encoded;
for (const [from, to] of ECPAY_REPLACE) {
  afterReplace = afterReplace.split(from).join(to);
}
const toHash = afterReplace.toLowerCase();
const hash = crypto.createHash("sha256").update(toHash, "utf8").digest("hex");
const checkMacValue = hash.toUpperCase();

const expected =
  "6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840";

console.log("排序後參數:", sortedKeys.map((k) => `${k}=${params[k]}`).join(" & "));
console.log("產出 CheckMacValue:", checkMacValue);
console.log("官方範例預期:    ", expected);
console.log("驗證結果:", checkMacValue === expected ? "通過" : "失敗");
process.exit(checkMacValue === expected ? 0 : 1);
