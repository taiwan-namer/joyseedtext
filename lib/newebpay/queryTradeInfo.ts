/**
 * 藍新單筆交易查詢 QueryTradeInfo：取得實際 PaymentType（CREDIT／VACC 等）。
 * Notify 解密有時不含 PaymentType（或為送單內容），退款前可呼叫此 API 補齊。
 */
import { createHash } from "crypto";
import { getNewebpayConfig } from "@/lib/newebpay/config";

const QUERY_STAGE = "https://ccore.newebpay.com/API/QueryTradeInfo";
const QUERY_PRODUCTION = "https://core.newebpay.com/API/QueryTradeInfo";

function getQueryUrl(isProduction: boolean): string {
  return isProduction ? QUERY_PRODUCTION : QUERY_STAGE;
}

/** Amt、MerchantID、MerchantOrderNo 鍵名排序後包在 HashIV…HashKey 間（與藍新 QueryTradeInfo 文件） */
function buildQueryCheckValueHashStyle(
  amt: string,
  merchantId: string,
  merchantOrderNo: string,
  hashKey: string,
  hashIv: string
): string {
  const paramStr = `Amt=${amt}&MerchantID=${merchantId}&MerchantOrderNo=${merchantOrderNo}`;
  const raw = `HashIV=${hashIv}&${paramStr}&HashKey=${hashKey}`;
  return createHash("sha256").update(raw, "utf8").digest("hex").toUpperCase();
}

/** 部分文件寫 IV=…&Key=…，若上式驗證失敗可再試 */
function buildQueryCheckValueIvKeyStyle(
  amt: string,
  merchantId: string,
  merchantOrderNo: string,
  hashKey: string,
  hashIv: string
): string {
  const paramStr = `Amt=${amt}&MerchantID=${merchantId}&MerchantOrderNo=${merchantOrderNo}`;
  const raw = `IV=${hashIv}&${paramStr}&Key=${hashKey}`;
  return createHash("sha256").update(raw, "utf8").digest("hex").toUpperCase();
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** 取出 Result 物件（JSON 或巢狀字串） */
function extractResultObject(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (String(o.Status ?? "").toUpperCase() !== "SUCCESS") return null;

  let result = o.Result ?? o.result;
  if (typeof result === "string") {
    const inner = parseJson(result.trim());
    result = inner;
  }
  if (!result || typeof result !== "object") return null;
  return result as Record<string, unknown>;
}

/** 從 QueryTradeInfo 回傳物件中取出 Result 內的 PaymentType */
function extractPaymentTypeFromQueryResponse(parsed: unknown): string {
  const r = extractResultObject(parsed);
  if (!r) return "";
  const pt = r.PaymentType ?? r.paymentType ?? r.Payment_Method;
  return typeof pt === "string" ? pt.trim() : "";
}

export type NewebpayTradeDetails = {
  tradeNo: string;
  merchantOrderNo: string;
  amt: number;
  tradeStatus: string;
  paymentType: string;
  /** 請款狀態 0=未請款 1=等待 2=處理中 3=完成（見藍新文件） */
  closeStatus: string;
  /** 退款狀態 0=未退款 1=等待 2=處理中 3=完成 */
  backStatus: string;
  closeAmt: string;
  raw: unknown;
};

/**
 * 單筆交易查詢完整欄位（退款前判斷請款／退款狀態）。
 */
export async function queryNewebpayTradeDetails(params: {
  merchantOrderNo: string;
  amt: number;
}): Promise<NewebpayTradeDetails | null> {
  const cfg = getNewebpayConfig();
  if (!cfg) return null;

  const orderNo = params.merchantOrderNo.trim();
  if (!orderNo) return null;

  const amt = Math.round(Number(params.amt));
  if (!Number.isFinite(amt) || amt <= 0) return null;

  const amtStr = String(amt);

  try {
    const cv1 = buildQueryCheckValueHashStyle(amtStr, cfg.merchantId, orderNo, cfg.hashKey, cfg.hashIv);
    let parsed = await postQueryTrade(cfg, orderNo, amtStr, cv1);
    let r = extractResultObject(parsed);
    if (!r) {
      const cv2 = buildQueryCheckValueIvKeyStyle(amtStr, cfg.merchantId, orderNo, cfg.hashKey, cfg.hashIv);
      parsed = await postQueryTrade(cfg, orderNo, amtStr, cv2);
      r = extractResultObject(parsed);
    }
    if (!r) return null;

    return {
      tradeNo: String(r.TradeNo ?? r.tradeNo ?? "").trim(),
      merchantOrderNo: String(r.MerchantOrderNo ?? r.merchantOrderNo ?? "").trim(),
      amt: Math.round(Number(r.Amt ?? r.amt ?? amt)),
      tradeStatus: String(r.TradeStatus ?? r.tradeStatus ?? "").trim(),
      paymentType: String(r.PaymentType ?? r.paymentType ?? "").trim(),
      closeStatus: String(r.CloseStatus ?? r.closeStatus ?? "").trim(),
      backStatus: String(r.BackStatus ?? r.backStatus ?? "").trim(),
      closeAmt: String(r.CloseAmt ?? r.closeAmt ?? "").trim(),
      raw: parsed,
    };
  } catch {
    return null;
  }
}

/**
 * 查詢單筆交易，回傳 PaymentType（例如 CREDIT、VACC）；失敗回空字串。
 */
async function postQueryTrade(
  cfg: NonNullable<ReturnType<typeof getNewebpayConfig>>,
  orderNo: string,
  amtStr: string,
  checkValue: string
): Promise<unknown> {
  const ts = String(Math.floor(Date.now() / 1000));
  const body = new URLSearchParams({
    MerchantID: cfg.merchantId,
    Version: "1.3",
    RespondType: "JSON",
    CheckValue: checkValue,
    TimeStamp: ts,
    MerchantOrderNo: orderNo,
    Amt: amtStr,
  }).toString();

  const res = await fetch(getQueryUrl(cfg.isProduction), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
  });
  const text = await res.text();
  return parseJson(text);
}

export async function queryNewebpayPaymentType(params: {
  merchantOrderNo: string;
  amt: number;
}): Promise<string> {
  const cfg = getNewebpayConfig();
  if (!cfg) return "";

  const orderNo = params.merchantOrderNo.trim();
  if (!orderNo) return "";

  const amt = Math.round(Number(params.amt));
  if (!Number.isFinite(amt) || amt <= 0) return "";

  const amtStr = String(amt);

  try {
    const cv1 = buildQueryCheckValueHashStyle(amtStr, cfg.merchantId, orderNo, cfg.hashKey, cfg.hashIv);
    let parsed = await postQueryTrade(cfg, orderNo, amtStr, cv1);
    let pt = extractPaymentTypeFromQueryResponse(parsed);
    if (pt) return pt;

    const cv2 = buildQueryCheckValueIvKeyStyle(amtStr, cfg.merchantId, orderNo, cfg.hashKey, cfg.hashIv);
    parsed = await postQueryTrade(cfg, orderNo, amtStr, cv2);
    pt = extractPaymentTypeFromQueryResponse(parsed);
    return pt;
  } catch {
    return "";
  }
}
