/**
 * 藍新 MPG 回傳（ReturnURL / NotifyURL）POST body 解析。
 * 部分付款方式或閘道可能使用 multipart、或 Content-Type 與實際格式不一致，
 * 僅用單一路徑解析會拿到錯誤的 TradeInfo → TradeSha 仍可能誤判或解密 bad decrypt。
 */

import type { NextRequest } from "next/server";

export type NewebpayTradePair = { tradeInfo: string; tradeSha: string; source: string };

export type ParsedNewebpayPost = {
  rawBody: string;
  contentType: string;
  parsedKeys: string[];
  parsedObject: Record<string, string>;
  rawJsonBody: Record<string, unknown> | null;
  tradePairs: NewebpayTradePair[];
};

/** 去除 BOM、零寬字元；藍新 TradeInfo 為 hex，不應含空白，一併刪除（避免誤插入的空格）。 */
export function normalizeNewebpayTradeCipher(s: string): string {
  let t = s.trim().replace(/^\ufeff/, "").replace(/[\u200B-\u200D\uFEFF]/g, "");
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t.replace(/\s+/g, "");
}

function pushPair(
  pairs: NewebpayTradePair[],
  tradeInfo: string,
  tradeSha: string,
  source: string
): void {
  const ti = normalizeNewebpayTradeCipher(tradeInfo);
  const ts = normalizeNewebpayTradeCipher(tradeSha);
  if (!ti || !ts) return;
  if (pairs.some((p) => p.tradeInfo === ti && p.tradeSha === ts)) return;
  pairs.push({ tradeInfo: ti, tradeSha: ts, source });
}

/** 從已解析的 JSON 物件抽出 TradeInfo / TradeSha（與 callback 欄位邏輯一致）。 */
export function tradePairFromJsonRoot(body: Record<string, unknown>): NewebpayTradePair | null {
  let ti =
    typeof body.TradeInfo === "string"
      ? body.TradeInfo
      : typeof body.tradeinfo === "string"
        ? body.tradeinfo
        : "";
  let ts =
    typeof body.TradeSha === "string"
      ? body.TradeSha
      : typeof body.tradesha === "string"
        ? body.tradesha
        : "";
  if (!ti && body.Result && typeof body.Result === "object") {
    const r = body.Result as Record<string, unknown>;
    if (typeof r.TradeInfo === "string") ti = r.TradeInfo;
    if (typeof r.TradeSha === "string") ts = r.TradeSha;
  }
  if (!ti && body.data && typeof body.data === "object") {
    const d = body.data as Record<string, unknown>;
    if (typeof d.TradeInfo === "string") ti = d.TradeInfo;
    if (typeof d.TradeSha === "string") ts = d.TradeSha;
  }
  ti = normalizeNewebpayTradeCipher(ti);
  ts = normalizeNewebpayTradeCipher(ts);
  if (!ti || !ts) return null;
  return { tradeInfo: ti, tradeSha: ts, source: "json" };
}

function collectTradePairsFromRawBody(rawBody: string, contentType: string): NewebpayTradePair[] {
  const pairs: NewebpayTradePair[] = [];
  const trimmed = rawBody.trim();

  // 1) application/x-www-form-urlencoded 或任意「像 query string」的 body
  try {
    const params = new URLSearchParams(trimmed);
    const ti = params.get("TradeInfo") ?? params.get("tradeinfo") ?? "";
    const ts = params.get("TradeSha") ?? params.get("tradesha") ?? "";
    pushPair(pairs, ti, ts, "urlencoded");
  } catch {
    /* ignore */
  }

  // 2) JSON（即使 Content-Type 標錯，只要內容是 JSON 也試）
  if (trimmed.startsWith("{") || contentType.toLowerCase().includes("json")) {
    try {
      const body = JSON.parse(trimmed) as Record<string, unknown>;
      const p = tradePairFromJsonRoot(body);
      if (p) pushPair(pairs, p.tradeInfo, p.tradeSha, p.source);
    } catch {
      /* ignore */
    }
  }

  return pairs;
}

/**
 * 讀取 POST 並解析；multipart 與純文字分開處理（body 只能讀一次）。
 */
export async function parseNewebpayIncomingPost(request: NextRequest): Promise<ParsedNewebpayPost> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const fd = await request.formData();
    const parsedObject: Record<string, string> = {};
    const parsedKeys: string[] = [];
    fd.forEach((value, key) => {
      parsedKeys.push(key);
      parsedObject[key] = typeof value === "string" ? value : "";
    });
    const ti = String(fd.get("TradeInfo") ?? fd.get("tradeinfo") ?? "");
    const ts = String(fd.get("TradeSha") ?? fd.get("tradesha") ?? "");
    const tradePairs: NewebpayTradePair[] = [];
    pushPair(tradePairs, ti, ts, "multipart");
    return {
      rawBody: "",
      contentType,
      parsedKeys,
      parsedObject,
      rawJsonBody: null,
      tradePairs,
    };
  }

  const rawBody = await request.text();
  const parsedKeys: string[] = [];
  const parsedObject: Record<string, string> = {};
  let rawJsonBody: Record<string, unknown> | null = null;

  if (contentType.toLowerCase().includes("application/json")) {
    try {
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      rawJsonBody = body;
      for (const k of Object.keys(body)) {
        parsedKeys.push(k);
        const v = body[k];
        const s =
          v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v).slice(0, 200) : String(v);
        parsedObject[k] = s;
      }
    } catch {
      const params = new URLSearchParams(rawBody);
      params.forEach((value, key) => {
        parsedKeys.push(key);
        parsedObject[key] = value;
      });
    }
  } else {
    const params = new URLSearchParams(rawBody);
    params.forEach((value, key) => {
      parsedKeys.push(key);
      parsedObject[key] = value;
    });
  }

  const tradePairs = collectTradePairsFromRawBody(rawBody, contentType);

  // 若主解析路徑已有 TradeInfo（例如 form 欄位），也納入候選（可能與 collect 重複，pushPair 會去重）
  const primaryTi =
    parsedObject.TradeInfo ??
    parsedObject.tradeinfo ??
    parsedObject.TRADEINFO ??
    "";
  const primaryTs =
    parsedObject.TradeSha ?? parsedObject.tradesha ?? parsedObject.TRADESHA ?? "";
  pushPair(tradePairs, primaryTi, primaryTs, "primary");

  return {
    rawBody,
    contentType,
    parsedKeys,
    parsedObject,
    rawJsonBody,
    tradePairs,
  };
}
