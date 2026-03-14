/**
 * 藍新 ezPay 電子發票開立：使用 ezpay-invoice-js SDK。
 * 供 issueInvoice(bookingId) 在後台選擇「藍新 ezPay」時呼叫。
 */
import { EzpayInvoiceClient } from "ezpay-invoice-js";
import { getStoreSettings } from "@/app/actions/storeSettingsActions";

export function getEzpayInvoiceCreds() {
  const merchantId = process.env.EZPAY_INVOICE_MERCHANT_ID?.trim() ?? "";
  const hashKey = process.env.EZPAY_INVOICE_HASH_KEY?.trim() ?? "";
  const hashIV = process.env.EZPAY_INVOICE_HASH_IV?.trim() ?? "";
  if (!merchantId || !hashKey || !hashIV) return null;
  const env = process.env.EZPAY_INVOICE_ENV?.trim()?.toLowerCase();
  const isProduction = env === "production";
  return { merchantId, hashKey, hashIV, isProduction };
}

/** ezPay 開立參數與綠界對齊（由 service 傳入） */
export type IssueEzpayInvoicePayload = {
  relateNumber: string;
  customerName: string;
  customerAddr: string;
  customerPhone: string;
  customerEmail: string;
  salesAmount: number;
};

/**
 * 將 relateNumber 轉成 ezPay 接受的 MerchantOrderNo（20 字內，僅英文、數字、底線）。
 */
function toMerchantOrderNo(relateNumber: string): string {
  const s = relateNumber.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 20);
  return s || "ORDER_" + String(Date.now()).slice(-12);
}

/**
 * 依後台發票品項 + 總金額（含稅）組出 ezPay 所需品項與未稅金額。
 * 回傳 pipe 分隔字串供 SDK 使用。
 */
export async function buildEzpayItemsFromStore(
  totalTaxIncl: number
): Promise<{ Amt: number; ItemName: string; ItemCount: string; ItemUnit: string; ItemPrice: string; ItemAmt: string }> {
  const store = await getStoreSettings();
  const storeItems = store.invoiceItems;
  const totalAmtTaxExcl = Math.round(totalTaxIncl / 1.05);

  if (storeItems && storeItems.length > 0) {
    const fixedSumTaxIncl = storeItems.reduce(
      (s, x) => s + (typeof x.amount === "number" && x.amount >= 0 ? x.amount : 0),
      0
    );
    const noAmountIndex = storeItems.findIndex(
      (x) => typeof x.amount !== "number" || !Number.isFinite(x.amount) || x.amount < 0
    );
    const restTaxIncl = totalTaxIncl - fixedSumTaxIncl;

    const itemAmountsTaxExcl: number[] = storeItems.map((row, i) => {
      let taxIncl: number;
      if (typeof row.amount === "number" && Number.isFinite(row.amount) && row.amount >= 0) {
        taxIncl = row.amount;
      } else if (noAmountIndex === i && restTaxIncl >= 0) {
        taxIncl = restTaxIncl;
      } else {
        taxIncl = 0;
      }
      return Math.round(taxIncl / 1.05);
    });

    const ItemName = storeItems.map((r) => String(r.name || "").slice(0, 200) || "品項").join("|");
    const ItemCount = itemAmountsTaxExcl.map(() => "1").join("|");
    const ItemUnit = storeItems.map((r) => String(r.word || "式").slice(0, 6)).join("|");
    const ItemPrice = itemAmountsTaxExcl.join("|");
    const ItemAmt = itemAmountsTaxExcl.join("|");

    return {
      Amt: totalAmtTaxExcl,
      ItemName,
      ItemCount,
      ItemUnit,
      ItemPrice,
      ItemAmt,
    };
  }

  return {
    Amt: totalAmtTaxExcl,
    ItemName: "課程預約",
    ItemCount: "1",
    ItemUnit: "堂",
    ItemPrice: String(totalAmtTaxExcl),
    ItemAmt: String(totalAmtTaxExcl),
  };
}

/**
 * 呼叫 ezPay 開立發票 API。失敗不拋錯，回傳 { ok: false, error }。
 */
export async function issueEzpayInvoice(
  payload: IssueEzpayInvoicePayload
): Promise<{ ok: true; raw?: string } | { ok: false; error: string }> {
  const creds = getEzpayInvoiceCreds();
  if (!creds) {
    return { ok: false, error: "EZPAY_INVOICE_MERCHANT_ID / HASH_KEY / HASH_IV 未設定" };
  }

  if (creds.hashKey.length !== 32 || creds.hashIV.length !== 16) {
    return {
      ok: false,
      error: "ezPay 發票 HashKey 須 32 字元、HashIV 須 16 字元，請至 ezPay 後台取得正確金鑰",
    };
  }

  const merchantOrderNo = toMerchantOrderNo(payload.relateNumber);
  const items = await buildEzpayItemsFromStore(payload.salesAmount);

  try {
    const client = new EzpayInvoiceClient({
      merchantId: creds.merchantId,
      hashKey: creds.hashKey,
      hashIV: creds.hashIV,
      env: creds.isProduction ? "production" : "sandbox",
    });

    const result = await client.issueInvoice({
      MerchantOrderNo: merchantOrderNo,
      Category: "B2C",
      BuyerName: payload.customerName.slice(0, 60) || "顧客",
      BuyerEmail: payload.customerEmail || undefined,
      BuyerPhone: payload.customerPhone || undefined,
      CarrierType: "1",
      CarrierNum: payload.customerEmail || payload.customerPhone || "",
      Amt: items.Amt,
      ItemName: items.ItemName,
      ItemCount: items.ItemCount,
      ItemUnit: items.ItemUnit,
      ItemPrice: items.ItemPrice,
      ItemAmt: items.ItemAmt,
    });

    if (result.Status === "SUCCESS") {
      return { ok: true, raw: JSON.stringify(result) };
    }
    return {
      ok: false,
      error: result.Message || String(result.Result || "ezPay 開立失敗"),
    };
  } catch (e) {
    const err = e as Error & { field?: string; status?: string };
    const msg = err?.message || String(e);
    return { ok: false, error: msg };
  }
}
