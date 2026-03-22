/**
 * 藍新 NewebPay 退款：信用卡／一般請退款用 CreditCard/Close；
 * 電子錢包（LINE Pay、台灣 Pay 等經藍新）用 EWallet/Refund 備援。
 * 外層為 MerchantID_ + PostData_（AES-256-CBC hex），與官方範例一致。
 */
import { getNewebpayConfig } from "@/lib/newebpay/config";
import { newebpayEncryptTradeInfo } from "@/lib/newebpay/encrypt";
import { queryNewebpayPaymentType, queryNewebpayTradeDetails } from "@/lib/newebpay/queryTradeInfo";

const CLOSE_STAGE = "https://ccore.newebpay.com/API/CreditCard/Close";
const CLOSE_PRODUCTION = "https://core.newebpay.com/API/CreditCard/Close";

const CANCEL_STAGE = "https://ccore.newebpay.com/API/CreditCard/Cancel";
const CANCEL_PRODUCTION = "https://core.newebpay.com/API/CreditCard/Cancel";

const EWALLET_REFUND_STAGE = "https://ccore.newebpay.com/API/EWallet/Refund";
const EWALLET_REFUND_PRODUCTION = "https://core.newebpay.com/API/EWallet/Refund";

function getCloseUrl(isProduction: boolean): string {
  return isProduction ? CLOSE_PRODUCTION : CLOSE_STAGE;
}

function getCancelUrl(isProduction: boolean): string {
  return isProduction ? CANCEL_PRODUCTION : CANCEL_STAGE;
}

function getEWalletRefundUrl(isProduction: boolean): string {
  return isProduction ? EWALLET_REFUND_PRODUCTION : EWALLET_REFUND_STAGE;
}

/** 藍新常見訊息：請款尚未完成，API 刷退會失敗（參考 1shop / 實務說明） */
const MSG_CLOSE_PENDING_CAPTURE =
  "藍新端尚在「請款」處理中（CloseStatus=等待／處理中），此時無法用 API 刷退。請隔日請款完成後再試，或至藍新後台「銷售中心 → 銷售紀錄查詢 → 信用卡交易」手動退款。";

function appendCloseStateHint(err: string): string {
  if (/非授權成功|已請款完成|請款完成狀態/i.test(err)) {
    return `${err} 常見原因：信用卡交易尚在銀行請款流程中，請隔日再試刷退，或至藍新後台手動操作。`;
  }
  return err;
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
  | { ok: true; channel: "close" | "cancel" | "ewallet"; raw: unknown }
  | { ok: false; error: string; raw?: unknown };

/**
 * 是否可用 CreditCard/Close 退刷。VACC／WEBATM／超商 等非信用卡，藍新會回諸如「商店信用卡資格停用」。
 * 未記錄付款方式時回 true（仍嘗試 Close，與舊訂單相容）。
 */
export function isNewebpayCloseRefundApplicable(paymentType: string | null | undefined): boolean {
  const p = (paymentType ?? "").trim().toUpperCase();
  if (!p) return true;
  const nonCredit = ["VACC", "WEBATM", "CVS", "BARCODE"];
  return !nonCredit.some((k) => p.includes(k));
}

/**
 * 藍新退款／沖帳：
 * 1) QueryTradeInfo 看 BackStatus／CloseStatus（已退款、請款中等先擋下並給明確提示）
 * 2) CloseStatus=0 時改走 CreditCard/Cancel 取消授權
 * 3) 否則 CreditCard/Close CloseType=2 刷退（一律帶 TradeNo）
 * 4) 失敗時再嘗試 EWallet/Refund（錢包類）
 */
export async function executeNewebpayRefund(params: {
  merchantOrderNo: string;
  tradeNo: string | null | undefined;
  amount: number;
  /** 來自 Notify／DB；空則會呼叫 QueryTradeInfo 補 PaymentType */
  newebpayPaymentType?: string | null;
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

  let effectivePaymentType = (params.newebpayPaymentType ?? "").trim();
  if (!effectivePaymentType) {
    const q = await queryNewebpayPaymentType({ merchantOrderNo: orderNo, amt });
    if (q) {
      effectivePaymentType = q;
    }
  }

  if (!isNewebpayCloseRefundApplicable(effectivePaymentType)) {
    return {
      ok: false,
      error:
        "此筆藍新交易付款方式為「非信用卡」（例如 VACC／WEBATM），無法使用 CreditCard/Close 自動退款。請至藍新管理中心對該筆交易辦理沖帳／退款。",
    };
  }

  const details = await queryNewebpayTradeDetails({ merchantOrderNo: orderNo, amt });
  let tn = (params.tradeNo ?? "").trim();
  if (!tn && details?.tradeNo) {
    tn = details.tradeNo;
  }

  if (details) {
    if (details.backStatus === "3") {
      return {
        ok: false,
        error: "藍新查詢顯示此筆已「退款完成」（BackStatus=3），無法重複退款。若站內訂單狀態未更新，請手動核對後台。",
        raw: details.raw,
      };
    }
    if (details.closeStatus === "1" || details.closeStatus === "2") {
      return { ok: false, error: MSG_CLOSE_PENDING_CAPTURE, raw: details.raw };
    }
    /**
     * 未請款（0）：僅授權、尚未請款時應走「取消授權」而非 Close 刷退。
     */
    if (details.closeStatus === "0" && tn) {
      const cancelTs = String(Math.floor(Date.now() / 1000));
      const cancelUrl = getCancelUrl(cfg.isProduction);
      const cancelByTrade: Record<string, string> = {
        RespondType: "JSON",
        Version: "1.0",
        Amt: String(amt),
        TradeNo: tn,
        TimeStamp: cancelTs,
        IndexType: "2",
      };
      const cancelRes = await postMerchantIdAndPostData(
        cancelUrl,
        cfg.merchantId,
        cfg.hashKey,
        cfg.hashIv,
        cancelByTrade
      );
      if (!cancelRes.encryptError && cancelRes.parsed != null && isNewebpayApiSuccess(cancelRes.parsed)) {
        return { ok: true, channel: "cancel", raw: cancelRes.parsed };
      }
      const cancelByOrder: Record<string, string> = {
        RespondType: "JSON",
        Version: "1.0",
        Amt: String(amt),
        MerchantOrderNo: orderNo,
        TimeStamp: cancelTs,
        IndexType: "1",
      };
      const cancel2 = await postMerchantIdAndPostData(
        cancelUrl,
        cfg.merchantId,
        cfg.hashKey,
        cfg.hashIv,
        cancelByOrder
      );
      if (!cancel2.encryptError && cancel2.parsed != null && isNewebpayApiSuccess(cancel2.parsed)) {
        return { ok: true, channel: "cancel", raw: cancel2.parsed };
      }
      const e1 = cancelRes.encryptError
        ? cancelRes.encryptError
        : cancelRes.parsed != null
          ? errorMessageFromParsed(cancelRes.parsed, "取消授權失敗")
          : cancelRes.text.trim().slice(0, 200);
      const e2 = cancel2.encryptError
        ? cancel2.encryptError
        : cancel2.parsed != null
          ? errorMessageFromParsed(cancel2.parsed, "取消授權失敗")
          : cancel2.text.trim().slice(0, 200);
      return {
        ok: false,
        error: `此筆藍新查詢為「未請款」（CloseStatus=0），應先取消授權；API 嘗試未成功：${e1}／${e2}。請至藍新後台「信用卡交易」操作取消授權或洽客服。`,
        raw: cancel2.parsed ?? cancelRes.parsed ?? undefined,
      };
    }
  }

  const ts = String(Math.floor(Date.now() / 1000));

  /** 官方 Close PostData 須含 TradeNo；無 TradeNo 時 Close 常失敗或回狀態錯誤 */
  if (!tn) {
    return {
      ok: false,
      error:
        "缺少藍新交易序號（TradeNo），無法呼叫請退款 API。請確認 Notify 已寫入 newebpay_trade_no，或至藍新後台查詢該筆「藍新交易序號」後再試／於後台手動退款。",
      raw: details?.raw,
    };
  }

  const closeInner: Record<string, string> = {
    RespondType: "JSON",
    Version: "1.1",
    Amt: String(amt),
    MerchantOrderNo: orderNo,
    TimeStamp: ts,
    IndexType: "1",
    CloseType: "2",
    TradeNo: tn,
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

  // IndexType=2：以藍新交易序號為索引再試（部分商店／交易類型需要）
  if (tn) {
    const closeInnerByTrade: Record<string, string> = {
      ...closeInner,
      IndexType: "2",
      TradeNo: tn,
      MerchantOrderNo: orderNo,
    };
    const close2 = await postMerchantIdAndPostData(
      closeUrl,
      cfg.merchantId,
      cfg.hashKey,
      cfg.hashIv,
      closeInnerByTrade
    );
    if (!close2.encryptError && close2.parsed != null && isNewebpayApiSuccess(close2.parsed)) {
      return { ok: true, channel: "close", raw: close2.parsed };
    }
  }

  let closeErr =
    closeRes.parsed != null
      ? errorMessageFromParsed(closeRes.parsed, "藍新 Close 退款未成功")
      : closeRes.text.trim()
        ? `藍新回應無法解析為 JSON：${closeRes.text.replace(/\s+/g, " ").trim().slice(0, 200)}`
        : "藍新 Close 退款請求失敗";

  closeErr = appendCloseStateHint(closeErr);

  if (/信用卡|資格|CREDIT|close|未開放/i.test(closeErr)) {
    closeErr +=
      " 請至藍新後台確認：是否已開通「信用卡」收單；若僅開 ATM／VACC，請在後台對該筆交易操作退款。若 DB 無 newebpay_payment_type，系統已嘗試 QueryTradeInfo 判斷付款方式。";
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
