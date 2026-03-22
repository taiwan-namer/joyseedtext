/**
 * 從 Notify／Return 解密結果擷取實際付款方式（PaymentType）。
 * 藍新文件：TradeInfo 解密後應有 PaymentType；若為送單內容或 JSON 巢狀需額外處理。
 */
export function extractNewebpayPaymentTypeFromDecrypted(
  decryptedObj: Record<string, string>,
  decryptedRaw: string
): string {
  const lowerGet = (key: string): string => {
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(decryptedObj)) {
      if (k.toLowerCase() === lower) return (v ?? "").trim();
    }
    return "";
  };

  const directKeys = [
    "PaymentType",
    "paymentType",
    "PAYMENTTYPE",
    "Payment_Method",
    "PaymentMethodType",
    "PayType",
    "payType",
    "SubPaymentType",
    "EPaymentType",
  ];
  for (const k of directKeys) {
    const v = lowerGet(k) || (decryptedObj[k] ?? "").trim();
    if (v) return v;
  }

  const resultStr = lowerGet("Result") || decryptedObj["Result"] || "";
  if (resultStr && (resultStr.trim().startsWith("{") || resultStr.includes("PaymentType"))) {
    try {
      const j = JSON.parse(resultStr) as Record<string, unknown>;
      const pt = j.PaymentType ?? j.paymentType;
      if (typeof pt === "string" && pt.trim()) return pt.trim();
    } catch {
      const m = resultStr.match(/"PaymentType"\s*:\s*"([^"]+)"/i);
      if (m?.[1]) return m[1].trim();
    }
  }

  for (const [k, v] of Object.entries(decryptedObj)) {
    if (/payment.*type|paytype|pay_type|paymethod/i.test(k) && String(v).trim()) {
      return String(v).trim();
    }
  }

  const rawM = decryptedRaw.match(/(?:^|&)PaymentType=([^&]+)/i);
  if (rawM?.[1]) return decodeURIComponent(rawM[1].trim());

  const jsonM = decryptedRaw.match(/"PaymentType"\s*:\s*"([^"]+)"/i);
  if (jsonM?.[1]) return jsonM[1].trim();

  return "";
}
