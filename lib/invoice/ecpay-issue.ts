/**
 * 綠界 B2C 發票開立：組參數、加密、送 API。
 * 供 POST /api/invoice/issue 與 issueInvoice(bookingId) 共用。
 */
import { ecpayInvoiceEncryptData } from "@/lib/ecpay/invoice-encrypt";
import { getStoreSettings } from "@/app/actions/storeSettingsActions";

const ECPAY_INVOICE_STAGE_URL = "https://einvoice-stage.ecpay.com.tw/B2CInvoice/Issue";

export function getEcpayInvoiceCreds() {
  const merchantId = process.env.ECPAY_INVOICE_MERCHANT_ID?.trim() ?? "";
  const hashKey = process.env.ECPAY_INVOICE_HASH_KEY?.trim() ?? "";
  const hashIv = process.env.ECPAY_INVOICE_HASH_IV?.trim() ?? "";
  if (!merchantId || !hashKey || !hashIv) return null;
  return { merchantId, hashKey, hashIv };
}

export type EcpayInvoiceItem = {
  ItemSeq: number;
  ItemName: string;
  ItemCount: number;
  ItemWord: string;
  ItemPrice: number;
  ItemTaxType: string;
  ItemAmount: number;
};

export type IssueEcpayInvoicePayload = {
  relateNumber: string;
  customerName: string;
  customerAddr: string;
  customerPhone: string;
  customerEmail: string;
  salesAmount: number;
  ecpayItems: EcpayInvoiceItem[];
};

/**
 * 依後台設定的發票品項 + 總金額組出綠界 Items；若無設定則一筆「課程預約」。
 */
export async function buildEcpayItemsFromStore(total: number): Promise<{ items: EcpayInvoiceItem[]; salesAmount: number }> {
  const store = await getStoreSettings();
  const storeItems = store.invoiceItems;

  if (storeItems && storeItems.length > 0) {
    const fixedSum = storeItems.reduce((s, x) => s + (typeof x.amount === "number" && x.amount >= 0 ? x.amount : 0), 0);
    const noAmountIndex = storeItems.findIndex((x) => typeof x.amount !== "number" || !Number.isFinite(x.amount) || x.amount < 0);
    const restAmount = total - fixedSum;

    const items: EcpayInvoiceItem[] = storeItems.map((row, i) => {
      let amount: number;
      if (typeof row.amount === "number" && Number.isFinite(row.amount) && row.amount >= 0) {
        amount = row.amount;
      } else if (noAmountIndex === i && restAmount >= 0) {
        amount = restAmount;
      } else {
        amount = 0;
      }
      return {
        ItemSeq: i + 1,
        ItemName: String(row.name || "").slice(0, 500) || "品項",
        ItemCount: 1,
        ItemWord: String(row.word || "式").slice(0, 6),
        ItemPrice: amount,
        ItemTaxType: "1",
        ItemAmount: amount,
      };
    });
    return { items, salesAmount: total };
  }

  return {
    items: [
      {
        ItemSeq: 1,
        ItemName: "課程預約",
        ItemCount: 1,
        ItemWord: "堂",
        ItemPrice: total,
        ItemTaxType: "1",
        ItemAmount: total,
      },
    ],
    salesAmount: total,
  };
}

/**
 * 送綠界 B2C 開立發票 API。失敗不拋錯，回傳 { ok: false, error }。
 */
export async function issueEcpayInvoice(
  payload: IssueEcpayInvoicePayload
): Promise<{ ok: true; raw: string } | { ok: false; error: string }> {
  const creds = getEcpayInvoiceCreds();
  if (!creds) {
    return { ok: false, error: "ECPAY_INVOICE_* 未設定" };
  }

  const dataPayload = {
    MerchantID: creds.merchantId,
    RelateNumber: payload.relateNumber.slice(0, 50),
    CustomerID: "",
    CustomerIdentifier: "",
    CustomerName: payload.customerName,
    CustomerAddr: payload.customerAddr,
    CustomerPhone: payload.customerPhone,
    CustomerEmail: payload.customerEmail,
    ClearanceMark: "",
    Print: "0",
    Donation: "0",
    CarrierType: "",
    CarrierNum: "",
    TaxType: "1",
    SalesAmount: payload.salesAmount,
    InvType: "07",
    vat: "1",
    Items: payload.ecpayItems,
  };

  let encryptedData: string;
  try {
    encryptedData = ecpayInvoiceEncryptData(JSON.stringify(dataPayload), creds.hashKey, creds.hashIv);
  } catch (e) {
    return { ok: false, error: String((e as Error).message) };
  }

  const requestBody = {
    MerchantID: creds.merchantId,
    RqHeader: { Timestamp: Math.floor(Date.now() / 1000) },
    Data: encryptedData,
  };

  try {
    const res = await fetch(ECPAY_INVOICE_STAGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const raw = await res.text();
    if (res.ok) return { ok: true, raw };
    return { ok: false, error: `HTTP ${res.status}: ${raw.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: String((e as Error).message) };
  }
}
