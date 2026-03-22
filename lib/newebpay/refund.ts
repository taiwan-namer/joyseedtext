/**
 * 藍新 NewebPay 退款：信用卡／一般請退款用 CreditCard/Close；
 * 電子錢包（LINE Pay、台灣 Pay 等經藍新）用 EWallet/Refund 備援。
 * 外層為 MerchantID_ + PostData_（AES-256-CBC hex），與官方範例一致。
 */
import { getNewebpayConfig } from "@/lib/newebpay/config";
import { newebpayEncryptTradeInfo } from "@/lib/newebpay/encrypt";

const CLOSE_STAGE = "https://ccore.newebpay.com/API/CreditCard/Close";
const CLOSE_PRODUCTION = "https://core.newebpay.com/API/CreditCard/Close";

const EWALLET_REFUND_STAGE = "https://ccore.newebpay.com/API/EWallet/Refund";
const EWALLET_REFUND_PRODUCTION = "https://core.newebpay.com/API/EWallet/Refund";

function getCloseUrl(isProduction: boolean): string {
  return isProduction ? CLOSE_PRODUCTION : CLOSE_STAGE;
}

function getEWalletRefundUrl(isProduction: boolean): string {
  return isProduction ? EWALLET_REFUND_PRODUCTION : EWALLET_REFUND_STAGE;
}

function parseJsonResponse(text: string): unknown {
  const t = text.trim();
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

function isNewebpayApiSuccess(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  const o = parsed as Record<string, unknown>;
  const status = o.Status ?? o.status;
  if (typeof status === "string" && status.trim().toUpperCase() === "SUCCESS") {
    return true;
  }
  // 部分回傳將細節放在 Result（JSON 字串）
  const result = o.Result ?? o.result;
  if (typeof result === "string") {
    const inner = parseJsonResponse(result);
    if (inner && typeof inner === "object") {
      const s = (inner as Record<string, unknown>).Status ?? (inner as Record<string, unknown>).status;
      if (typeof s === "string" && s.trim().toUpperCase() === "SUCCESS") return true;
    }
  }
  return false;
}

function errorMessageFromParsed(parsed: unknown, fallback: string): string {
  if (!parsed || typeof parsed !== "object") return fallback;
  const o = parsed as Record<string, unknown>;
  const msg = o.Message ?? o.message ?? o.Msg ?? o.msg;
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  const status = o.Status ?? o.status;
  if (typeof status === "string" && status.trim()) {
    return `${fallback}（Status=${status}）`;
  }
  return fallback;
}

async function postMerchantIdAndPostData(
  apiUrl: string,
  merchantId: string,
  hashKey: string,
  hashIv: string,
  innerKeyValues: Record<string, string>
): Promise<{ ok: boolean; text: string; parsed: unknown; encryptError?: string }> {
  const inner = new URLSearchParams(innerKeyValues).toString();
  let postData: string;
  try {
    postData = newebpayEncryptTradeInfo(inner, hashKey, hashIv);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, text: "", parsed: null, encryptError: msg };
  }

  const body = new URLSearchParams({
    MerchantID_: merchantId,
    PostData_: postData,
  }).toString();

  let res: Response;
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, text: msg, parsed: null };
  }

  const text = await res.text();
  const parsed = parseJsonResponse(text);
  return { ok: res.ok, text, parsed };
}

export type NewebpayRefundResult =
  | { ok: true; channel: "close" | "ewallet"; raw: unknown }
  | { ok: false; error: string; raw?: unknown };

/**
 * 藍新退款：先呼叫 CreditCard/Close（CloseType=2 退款）；
 * 失敗且存有 TradeNo 時再嘗試 EWallet/Refund（適用經藍新之路徑）。
 */
export async function executeNewebpayRefund(params: {
  merchantOrderNo: string;
  tradeNo: string | null | undefined;
  amount: number;
}): Promise<NewebpayRefundResult> {
  const cfg = getNewebpayConfig();
  if (!cfg) {
    return {
      ok: false,
      error: "藍新金流未設定（需 NEWEBPAY_MERCHANT_ID、NEWEBPAY_HASH_KEY、NEWEBPAY_HASH_IV）",
    };
  }

  const orderNo = params.merchantOrderNo.trim();
  if (!orderNo) {
    return { ok: false, error: "藍新商店訂單編號（MerchantOrderNo）不可為空" };
  }

  const amt = Math.round(Number(params.amount));
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, error: "退款金額無效" };
  }

  const ts = String(Math.floor(Date.now() / 1000));

  const closeInner: Record<string, string> = {
    RespondType: "JSON",
    Version: "1.1",
    Amt: String(amt),
    MerchantOrderNo: orderNo,
    TimeStamp: ts,
    IndexType: "1",
    CloseType: "2",
  };

  const closeUrl = getCloseUrl(cfg.isProduction);
  const closeRes = await postMerchantIdAndPostData(
    closeUrl,
    cfg.merchantId,
    cfg.hashKey,
    cfg.hashIv,
    closeInner
  );

  if (closeRes.encryptError) {
    return { ok: false, error: `藍新請求加密失敗：${closeRes.encryptError}` };
  }

  if (closeRes.parsed != null && isNewebpayApiSuccess(closeRes.parsed)) {
    return { ok: true, channel: "close", raw: closeRes.parsed };
  }

  const closeErr =
    closeRes.parsed != null
      ? errorMessageFromParsed(closeRes.parsed, "藍新 Close 退款未成功")
      : closeRes.text.trim()
        ? `藍新回應無法解析為 JSON：${closeRes.text.replace(/\s+/g, " ").trim().slice(0, 200)}`
        : "藍新 Close 退款請求失敗";

  const tn = (params.tradeNo ?? "").trim();
  if (!tn) {
    return { ok: false, error: closeErr, raw: closeRes.parsed ?? undefined };
  }

  const ewTs = String(Math.floor(Date.now() / 1000));
  const ewInner: Record<string, string> = {
    RespondType: "JSON",
    Version: "1.0",
    TimeStamp: ewTs,
    TradeNo: tn,
    MerchantOrderNo: orderNo,
    Amt: String(amt),
  };

  const ewUrl = getEWalletRefundUrl(cfg.isProduction);
  const ewRes = await postMerchantIdAndPostData(
    ewUrl,
    cfg.merchantId,
    cfg.hashKey,
    cfg.hashIv,
    ewInner
  );

  if (ewRes.encryptError) {
    return {
      ok: false,
      error: `${closeErr}；備援 EWallet 加密失敗：${ewRes.encryptError}`,
      raw: closeRes.parsed ?? undefined,
    };
  }

  if (ewRes.parsed != null && isNewebpayApiSuccess(ewRes.parsed)) {
    return { ok: true, channel: "ewallet", raw: ewRes.parsed };
  }

  const ewErr =
    ewRes.parsed != null
      ? errorMessageFromParsed(ewRes.parsed, "藍新電子錢包退款未成功")
      : ewRes.text.trim()
        ? `藍新 EWallet 回應無法解析：${ewRes.text.replace(/\s+/g, " ").trim().slice(0, 200)}`
        : "藍新電子錢包退款請求失敗";

  return {
    ok: false,
    error: `${closeErr}；備援 EWallet：${ewErr}`,
    raw: ewRes.parsed ?? closeRes.parsed ?? undefined,
  };
}
