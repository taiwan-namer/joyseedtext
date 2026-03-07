import { createHmac, randomUUID } from "crypto";

const LINE_PAY_BASE_SANDBOX = "https://sandbox-api-pay.line.me";
const LINE_PAY_BASE_PRODUCTION = "https://api-pay.line.me";

/** 依 LINE_PAY_ENV 取得 API 基底網址；未設定或 sandbox 時使用 Sandbox，路徑均為 V3 */
export function getLinePayBaseUrl(): string {
  const env = typeof process.env.LINE_PAY_ENV === "string" ? process.env.LINE_PAY_ENV.trim().toLowerCase() : "";
  return env === "production" ? LINE_PAY_BASE_PRODUCTION : LINE_PAY_BASE_SANDBOX;
}

/** LINE Pay V3 簽章：原始字串為 ChannelSecret + URI + Body + Nonce，以 Channel Secret 為 key 做 HMAC-SHA256 後 Base64 */
export function generateSignature(
  channelSecret: string,
  uri: string,
  body: string,
  nonce: string
): string {
  const message = channelSecret + uri + body + nonce;
  const signature = createHmac("sha256", channelSecret).update(message, "utf8").digest("base64");
  return signature;
}

/** LINE Pay API 請求逾時（15 秒） */
const LINE_PAY_REQUEST_TIMEOUT_MS = 15000;

/** 從 store_settings.frontend_settings.linePayApi 解析出的 Line Pay 金鑰（可存成 JSON 字串） */
export type LinePayCredentials = {
  channelId: string;
  channelSecret: string;
};

/**
 * 檢查 LINE Pay 金鑰格式。
 * Channel Secret 通常為 32 字元，允許 28–36 字元。
 * 若長度不符則回傳錯誤，呼叫方應直接攔截，避免跳轉至 LINE 頁面。
 */
export function validateLinePayCredentials(creds: LinePayCredentials): { ok: true } | { ok: false; error: string } {
  const len = creds.channelSecret?.length ?? 0;
  if (len < 28 || len > 36) {
    return { ok: false, error: `LINE_PAY_CHANNEL_SECRET 長度異常 (${len})，請確認設定正確（預期 32 字元）` };
  }
  return { ok: true };
}

/**
 * 從前台設定的 linePayApi 欄位解析 Line Pay Channel ID 與 Secret。
 * 預期格式為 JSON 字串：{"channelId":"...","channelSecret":"..."}
 */
export function parseLinePayCredentials(linePayApi: string | null): LinePayCredentials | null {
  if (!linePayApi || typeof linePayApi !== "string") return null;
  const trimmed = linePayApi.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const channelId = typeof parsed.channelId === "string" ? parsed.channelId.trim() : "";
    const channelSecret = typeof parsed.channelSecret === "string" ? parsed.channelSecret.trim() : "";
    if (channelId && channelSecret) return { channelId, channelSecret };
  } catch {
    // 非 JSON 或格式錯誤
  }
  return null;
}

/**
 * 取得 LINE Pay 金鑰（Sandbox 測試或正式環境）。
 * 優先讀取 .env 的 LINE_PAY_CHANNEL_ID、LINE_PAY_CHANNEL_SECRET；
 * 若未設定，再從資料庫的 linePayApi（store_settings.frontend_settings）解析。
 */
export function getLinePaySandboxCredentials(linePayApiFromDb: string | null): LinePayCredentials | null {
  const envId =
    typeof process.env.LINE_PAY_CHANNEL_ID === "string" ? process.env.LINE_PAY_CHANNEL_ID.trim() : "";
  const envSecret =
    typeof process.env.LINE_PAY_CHANNEL_SECRET === "string" ? process.env.LINE_PAY_CHANNEL_SECRET.trim() : "";
  if (envId && envSecret) return { channelId: envId, channelSecret: envSecret };
  return parseLinePayCredentials(linePayApiFromDb);
}

/** Request 用的商品包內單一商品 */
export type LinePayProduct = {
  id: string;
  name: string;
  imageUrl?: string;
  quantity: number;
  price: number;
};

/** Request 用的商品包 */
export type LinePayPackage = {
  id: string;
  amount: number;
  userFee?: number;
  products: LinePayProduct[];
};

/** Request 用的轉向網址 */
export type LinePayRedirectUrls = {
  confirmUrl: string;
  cancelUrl: string;
};

export type RequestLinePayPaymentParams = {
  channelId: string;
  channelSecret: string;
  amount: number;
  orderId: string;
  packages: LinePayPackage[];
  redirectUrls?: LinePayRedirectUrls;
  options?: Record<string, unknown>;
};

export type RequestLinePayPaymentResult =
  | { success: true; info: { transactionId: string; paymentUrl?: { web?: string }; orderId?: string }; returnCode: string; returnMessage: string }
  | { success: false; returnCode: string; returnMessage: string };

/**
 * 呼叫 LINE Pay V3 Request API，取得交易 ID 與付款導向 URL（Sandbox 環境）。
 */
export async function requestLinePayPayment(
  params: RequestLinePayPaymentParams
): Promise<RequestLinePayPaymentResult> {
  const { channelId, channelSecret, amount, orderId, packages, redirectUrls, options } = params;
  const uri = "/v3/payments/request";
  const bodyObj = {
    amount,
    currency: "TWD" as const,
    orderId,
    packages,
    ...(redirectUrls && { redirectUrls }),
    ...(options && Object.keys(options).length > 0 && { options }),
  };
  const body = JSON.stringify(bodyObj);
  const nonce = randomUUID();

  const signature = generateSignature(channelSecret, uri, body, nonce);
  const baseUrl = getLinePayBaseUrl();
  const url = `${baseUrl}${uri}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LINE_PAY_REQUEST_TIMEOUT_MS);

  const res = await fetch(url, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      "X-LINE-ChannelId": channelId,
      "X-LINE-Authorization-Nonce": nonce,
      "X-LINE-Authorization": signature,
    },
    body,
  });

  clearTimeout(timeoutId);
  const text = await res.text();

  // transactionId 可能為 19 位數，超過 JS safe integer，以字串處理
  const raw = (() => {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { returnCode: "9000", returnMessage: "Invalid response" };
    }
  })();

  const returnCode = String(raw.returnCode ?? "");
  const returnMessage = String(raw.returnMessage ?? "-");

  if (returnCode !== "0000") {
    return { success: false, returnCode, returnMessage };
  }

  const info = raw.info as Record<string, unknown> | undefined;
  const transactionId = info?.transactionId != null ? String(info.transactionId) : "";
  const paymentUrlRaw = info?.paymentUrl;
  const paymentUrl =
    typeof paymentUrlRaw === "string"
      ? paymentUrlRaw
      : (paymentUrlRaw != null && typeof paymentUrlRaw === "object" && typeof (paymentUrlRaw as { web?: string }).web === "string")
        ? (paymentUrlRaw as { web: string }).web
        : undefined;
  return {
    success: true,
    info: {
      transactionId,
      paymentUrl: paymentUrl ? { web: paymentUrl } : undefined,
      orderId: info?.orderId != null ? String(info.orderId) : undefined,
    },
    returnCode,
    returnMessage,
  };
}

export type ConfirmLinePayPaymentParams = {
  channelId: string;
  channelSecret: string;
  transactionId: string;
  amount: number;
  currency?: "TWD" | "THB" | "USD";
};

export type ConfirmLinePayPaymentResult =
  | { success: true; info: Record<string, unknown>; returnCode: string; returnMessage: string }
  | { success: false; returnCode: string; returnMessage: string };

/** LINE Pay 錯誤碼 1172：交易已完成（可視為成功） */
const LINE_PAY_CODE_ALREADY_COMPLETED = "1172";

async function confirmLinePayPaymentOnce(
  params: ConfirmLinePayPaymentParams
): Promise<ConfirmLinePayPaymentResult> {
  const { channelId, channelSecret, transactionId, amount, currency = "TWD" } = params;
  const uri = `/v3/payments/${transactionId}/confirm`;
  const bodyObj = { amount, currency };
  const body = JSON.stringify(bodyObj);
  const nonce = randomUUID();

  const signature = generateSignature(channelSecret, uri, body, nonce);
  const baseUrl = getLinePayBaseUrl();
  const url = `${baseUrl}${uri}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LINE_PAY_REQUEST_TIMEOUT_MS);

  const res = await fetch(url, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      "X-LINE-ChannelId": channelId,
      "X-LINE-Authorization-Nonce": nonce,
      "X-LINE-Authorization": signature,
    },
    body,
  });

  clearTimeout(timeoutId);
  const text = await res.text();
  const raw = (() => {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { returnCode: "9000", returnMessage: "Invalid response" };
    }
  })();

  const returnCode = String(raw.returnCode ?? "");
  const returnMessage = String(raw.returnMessage ?? "-");

  if (returnCode === "0000") {
    const info = (raw.info as Record<string, unknown>) ?? {};
    return { success: true, info, returnCode, returnMessage };
  }
  if (returnCode === LINE_PAY_CODE_ALREADY_COMPLETED) {
    const info = (raw.info as Record<string, unknown>) ?? {};
    return { success: true, info, returnCode, returnMessage };
  }
  return { success: false, returnCode, returnMessage };
}

/**
 * 呼叫 LINE Pay V3 Confirm API，驗證並確認該筆交易（Sandbox 環境）。
 * 含 15 秒逾時、多重重試（網路波動或逾時時重試 1 次）、錯誤碼 1172 視為成功。
 */
export async function confirmLinePayPayment(
  params: ConfirmLinePayPaymentParams
): Promise<ConfirmLinePayPaymentResult> {
  const toFail = (msg: string): ConfirmLinePayPaymentResult =>
    ({ success: false, returnCode: "9000", returnMessage: msg });

  let result: ConfirmLinePayPaymentResult;
  try {
    result = await confirmLinePayPaymentOnce(params);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "連線失敗";
    const isRetryable = msg.toLowerCase().includes("abort") || msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("network");
    if (!isRetryable) return toFail(msg);
    try {
      result = await confirmLinePayPaymentOnce(params);
    } catch {
      return toFail("網路逾時或連線失敗，請稍後再試");
    }
  }

  if (result.success) return result;

  const isRetryable =
    result.returnCode === "9000" || result.returnMessage?.toLowerCase().includes("timeout") || result.returnMessage?.toLowerCase().includes("network");
  if (!isRetryable) return result;

  try {
    result = await confirmLinePayPaymentOnce(params);
  } catch {
    return toFail("網路逾時或連線失敗，請稍後再試");
  }
  return result;
}
