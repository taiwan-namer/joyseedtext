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

/** 從 store_settings.frontend_settings.linePayApi 解析出的 Line Pay 金鑰（可存成 JSON 字串） */
export type LinePayCredentials = {
  channelId: string;
  channelSecret: string;
};

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

  // 僅在後端執行，不暴露 Secret；僅用於除錯
  console.log("[LINE Pay Request]", {
    orderId,
    nonce,
    signaturePreview: signature.slice(0, 5) + "...",
    url,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-LINE-ChannelId": channelId,
      "X-LINE-Authorization-Nonce": nonce,
      "X-LINE-Authorization": signature,
    },
    body,
  });

  const text = await res.text();
  console.log("[LINE Pay Response]", { status: res.status, raw: text });

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

/**
 * 呼叫 LINE Pay V3 Confirm API，驗證並確認該筆交易（Sandbox 環境）。
 */
export async function confirmLinePayPayment(
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

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-LINE-ChannelId": channelId,
      "X-LINE-Authorization-Nonce": nonce,
      "X-LINE-Authorization": signature,
    },
    body,
  });

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

  if (returnCode !== "0000") {
    return { success: false, returnCode, returnMessage };
  }

  const info = (raw.info as Record<string, unknown>) ?? {};
  return { success: true, info, returnCode, returnMessage };
}
