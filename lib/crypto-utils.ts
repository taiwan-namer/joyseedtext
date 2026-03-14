// ========== 綠界 ECPay CheckMacValue ==========
// 實作集中於 lib/ecpay/checkmac.ts，此處轉出以維持既有引用
export {
  ecpayCheckMacValue,
  ecpayCheckMacValueForParams,
} from "@/lib/ecpay/checkmac";

// 兼容先前指令中提到的 generateECPayMacValue 命名（實際使用為通用版參數簽章）
export { ecpayCheckMacValueForParams as generateECPayMacValue } from "@/lib/ecpay/checkmac";
