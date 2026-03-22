import { ecpayCheckMacValueForParams } from "@/lib/ecpay/checkmac";

const ECPAY_DO_ACTION_STAGE = "https://payment-stage.ecpay.com.tw/CreditDetail/DoAction";
const ECPAY_DO_ACTION_PRODUCTION = "https://payment.ecpay.com.tw/CreditDetail/DoAction";

function getEcpayRefundCreds(): { merchantId: string; hashKey: string; hashIv: string } | null {
  const merchantId = process.env.ECPAY_MERCHANT_ID?.trim();
  const hashKey = process.env.ECPAY_HASH_KEY?.trim();
  const hashIv = process.env.ECPAY_HASH_IV?.trim();
  if (!merchantId || !hashKey || !hashIv) return null;
  return { merchantId, hashKey, hashIv };
}

function getEcpayDoActionUrl(): string {
  return (process.env.ECPAY_ENV ?? "").trim().toLowerCase() === "production"
    ? ECPAY_DO_ACTION_PRODUCTION
    : ECPAY_DO_ACTION_STAGE;
}

function parseUrlEncodedResponse(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  new URLSearchParams(text.trim()).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export type EcpayRefundResult =
  | { ok: true; rtnCode: string; rtnMsg: string; raw: Record<string, string> }
  | { ok: false; error: string; rtnCode?: string; rtnMsg?: string; raw?: Record<string, string> };

/**
 * 綠界信用卡關帳／退刷 DoAction（Action=R）。
 */
export async function executeEcpayRefund(
  merchantTradeNo: string,
  tradeNo: string,
  totalAmount: number
): Promise<EcpayRefundResult> {
  const creds = getEcpayRefundCreds();
  if (!creds) {
    return {
      ok: false,
      error: "ECPay 金流未設定（需 ECPAY_MERCHANT_ID、ECPAY_HASH_KEY、ECPAY_HASH_IV）",
    };
  }

  const mtn = merchantTradeNo.trim();
  const tn = tradeNo.trim();
  if (!mtn || !tn) {
    return { ok: false, error: "MerchantTradeNo 或 TradeNo 不可為空" };
  }

  const amt = Math.round(Number(totalAmount));
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, error: "退款金額無效" };
  }

  const baseParams: Record<string, string> = {
    MerchantID: creds.merchantId,
    MerchantTradeNo: mtn,
    TradeNo: tn,
    Action: "R",
    TotalAmount: String(amt),
  };

  const checkMacValue = ecpayCheckMacValueForParams(baseParams, creds.hashKey, creds.hashIv);
  const body = new URLSearchParams({ ...baseParams, CheckMacValue: checkMacValue });

  let res: Response;
  try {
    res = await fetch(getEcpayDoActionUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: body.toString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `網路請求失敗：${msg}` };
  }

  const text = await res.text();
  let raw: Record<string, string>;
  try {
    raw = parseUrlEncodedResponse(text);
  } catch {
    return {
      ok: false,
      error: "無法解析綠界回應內容",
      raw: {},
    };
  }

  const rtnCode = raw.RtnCode ?? "";
  const rtnMsg = raw.RtnMsg ?? "";

  if (rtnCode === "1") {
    return { ok: true, rtnCode, rtnMsg, raw };
  }

  return {
    ok: false,
    error: rtnMsg.trim() ? rtnMsg : `綠界退刷失敗（RtnCode=${rtnCode || "（空）"}）`,
    rtnCode: rtnCode || undefined,
    rtnMsg: rtnMsg || undefined,
    raw,
  };
}
