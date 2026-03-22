/**
 * 綠界 B2C 發票作廢：作廢發票 API（JSON + AES Data），與開立相同外層架構。
 * 端點為 B2CInvoice/Invalid（見綠界 Invalidating E-invoice／作廢發票）；勿使用 /Void，易回傳 500 非 JSON。
 */
import { ecpayInvoiceEncryptData, ecpayInvoiceDecryptData } from "@/lib/invoice/invoice-encrypt";
import { getEcpayInvoiceCreds } from "@/lib/invoice/ecpay-issue";

const ECPAY_INVOICE_INVALID_STAGE = "https://einvoice-stage.ecpay.com.tw/B2CInvoice/Invalid";
const ECPAY_INVOICE_INVALID_PRODUCTION = "https://einvoice.ecpay.com.tw/B2CInvoice/Invalid";

function getEcpayInvoiceInvalidApiUrl(): string {
  const env = (process.env.ECPAY_INVOICE_ENV ?? process.env.ECPAY_ENV ?? "").trim().toLowerCase();
  return env === "production" ? ECPAY_INVOICE_INVALID_PRODUCTION : ECPAY_INVOICE_INVALID_STAGE;
}

/** 作廢 API 用發票日期：Asia/Taipei，格式 yyyy-MM-dd（依綠界作廢發票文件） */
function formatInvoiceDateTaipeiYmd(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

/**
 * 正規化為作廢 API 所需 yyyy-MM-dd（台北日曆日）。
 * 可傳 ISO 字串、yyyy/MM/dd、或 Date；無法解析時退回「今日台北」。
 */
export function normalizeInvoiceDateForInvalidApi(dateRaw?: string | Date | null): string {
  if (dateRaw == null || dateRaw === "") {
    return formatInvoiceDateTaipeiYmd(new Date());
  }
  if (dateRaw instanceof Date) {
    return formatInvoiceDateTaipeiYmd(dateRaw);
  }
  const s = String(dateRaw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, "-");
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return formatInvoiceDateTaipeiYmd(parsed);
  }
  return formatInvoiceDateTaipeiYmd(new Date());
}

function responseBodyOneLineSummary(raw: string, maxLen = 240): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export type VoidEcpayInvoiceResult = { ok: true } | { ok: false; error: string };

/**
 * 呼叫綠界 B2CInvoice/Invalid；成功條件為回傳 Data 解密後 RtnCode === 1。
 * @param invoiceDate 開立日（建議日後從 DB 帶入）；未傳則以今日台北 yyyy-MM-dd。
 */
export async function voidEcpayInvoice(
  invoiceNo: string,
  voidReason: string = "消費者退款取消訂單",
  invoiceDate?: string | Date | null
): Promise<VoidEcpayInvoiceResult> {
  const creds = getEcpayInvoiceCreds();
  if (!creds) {
    return { ok: false, error: "ECPAY_INVOICE_* 未設定" };
  }

  const inv = invoiceNo.trim();
  if (!inv) {
    return { ok: false, error: "發票號碼不可為空" };
  }

  const innerPayload = {
    MerchantID: creds.merchantId,
    InvoiceNo: inv,
    InvoiceDate: normalizeInvoiceDateForInvalidApi(invoiceDate),
    /** 文件上限 20 字元，依字元截斷 */
    Reason: [...voidReason].slice(0, 20).join(""),
  };

  let encryptedData: string;
  try {
    encryptedData = ecpayInvoiceEncryptData(JSON.stringify(innerPayload), creds.hashKey, creds.hashIv);
  } catch (e) {
    return { ok: false, error: String((e as Error).message) };
  }

  const requestBody = {
    MerchantID: creds.merchantId,
    RqHeader: { Timestamp: Math.floor(Date.now() / 1000) },
    Data: encryptedData,
  };

  let raw: string;
  try {
    const res = await fetch(getEcpayInvoiceInvalidApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    raw = await res.text();
  } catch (e) {
    return { ok: false, error: String((e as Error).message) };
  }

  let outer: { Data?: string; TransCode?: string; TransMsg?: string };
  try {
    outer = JSON.parse(raw) as typeof outer;
  } catch {
    return {
      ok: false,
      error: `回傳非 JSON: ${responseBodyOneLineSummary(raw)}`,
    };
  }

  if (!outer.Data || typeof outer.Data !== "string") {
    return {
      ok: false,
      error: String(outer.TransMsg ?? outer.TransCode ?? responseBodyOneLineSummary(raw)),
    };
  }

  try {
    const inner = ecpayInvoiceDecryptData(outer.Data, creds.hashKey, creds.hashIv) as Record<string, unknown>;
    const rc = inner.RtnCode;
    const ok = rc === 1 || rc === "1";
    if (!ok) {
      return { ok: false, error: String(inner.RtnMsg ?? inner.Message ?? "作廢失敗") };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error).message) };
  }
}
