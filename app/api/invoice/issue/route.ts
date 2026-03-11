import { NextRequest, NextResponse } from "next/server";
import {
  getEcpayInvoiceCreds,
  buildEcpayItemsFromStore,
  issueEcpayInvoice,
  type EcpayInvoiceItem,
} from "@/lib/invoice/ecpay-issue";

/** GET：瀏覽器直接開網址時顯示說明，避免空白頁 */
export async function GET() {
  return NextResponse.json(
    {
      message: "此為發票開立 API，請使用 POST 請求。",
      hint: "可用 curl、Postman 或瀏覽器 Console 的 fetch('...', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relateNumber: 'INVTEST1', salesAmount: 850 }) }) 測試。",
    },
    { status: 200 }
  );
}

/** 發票單一品項（由呼叫端傳入，可多筆，例如課程＋服務費） */
export type InvoiceItemInput = {
  /** 品名，例如「課程預約」「服務費」 */
  name: string;
  /** 數量，預設 1 */
  count?: number;
  /** 單位，預設「式」 */
  word?: string;
  /** 單價（含稅） */
  price: number;
  /** 小計（含稅），未填則為 price * count */
  amount?: number;
};

type InvoiceRequestBody = {
  relateNumber?: string;
  customerName?: string;
  customerAddr?: string;
  customerPhone?: string;
  customerEmail?: string;
  /** 總金額（含稅）；若傳入 items 則可省略，會自動加總 */
  salesAmount?: number;
  /** 發票品項陣列；未傳則使用預設一筆「課程預約」+ salesAmount */
  items?: InvoiceItemInput[];
};

export async function POST(req: NextRequest) {
  const creds = getEcpayInvoiceCreds();
  if (!creds) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "ECPAY_INVOICE_MERCHANT_ID / ECPAY_INVOICE_HASH_KEY / ECPAY_INVOICE_HASH_IV 未設定，請先在環境變數中填寫綠界電子發票金鑰。",
      },
      { status: 200 }
    );
  }

  let body: InvoiceRequestBody = {};
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      body = (await req.json()) as InvoiceRequestBody;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      const itemsStr = form.get("items") as string | null;
      let items: InvoiceItemInput[] | undefined;
      if (itemsStr) {
        try {
          items = JSON.parse(itemsStr) as InvoiceItemInput[];
        } catch {
          items = undefined;
        }
      }
      body = {
        relateNumber: (form.get("relateNumber") as string) ?? undefined,
        customerName: (form.get("customerName") as string) ?? undefined,
        customerAddr: (form.get("customerAddr") as string) ?? undefined,
        customerPhone: (form.get("customerPhone") as string) ?? undefined,
        customerEmail: (form.get("customerEmail") as string) ?? undefined,
        salesAmount: form.get("salesAmount") ? Number(form.get("salesAmount")) : undefined,
        items,
      };
    }
  } catch (e) {
    console.error("[Invoice issue] 解析請求 body 失敗", e);
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 200 });
  }

  const relateNumber = (body.relateNumber ?? `INV${Date.now()}`).slice(0, 50);
  const customerName = body.customerName?.trim() || "測試買家";
  const customerAddr = body.customerAddr?.trim() || "台北市信義區測試地址";
  const customerPhone = body.customerPhone?.trim() || "0912345678";
  const customerEmail = body.customerEmail?.trim() || "test@example.com";

  let ecpayItems: EcpayInvoiceItem[];
  let salesAmount: number;

  if (Array.isArray(body.items) && body.items.length > 0) {
    ecpayItems = body.items.map((row, i) => {
      const count = Number.isFinite(row.count) && (row.count as number) >= 1 ? Math.round(Number(row.count)) : 1;
      const price = Number(row.price);
      const amount = Number.isFinite(row.amount) ? Number(row.amount) : price * count;
      return {
        ItemSeq: i + 1,
        ItemName: String(row.name || "").slice(0, 500) || "品項",
        ItemCount: count,
        ItemWord: String(row.word || "式").slice(0, 6),
        ItemPrice: price,
        ItemTaxType: "1",
        ItemAmount: amount,
      };
    });
    salesAmount = ecpayItems.reduce((sum, x) => sum + x.ItemAmount, 0);
  } else {
    const total = Number.isFinite(body.salesAmount) && (body.salesAmount as number) > 0 ? Number(body.salesAmount) : 850;
    const built = await buildEcpayItemsFromStore(total);
    ecpayItems = built.items;
    salesAmount = built.salesAmount;
  }

  const result = await issueEcpayInvoice({
    relateNumber,
    customerName,
    customerAddr,
    customerPhone,
    customerEmail,
    salesAmount,
    ecpayItems,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, sent: { RelateNumber: relateNumber, SalesAmount: salesAmount } },
      { status: 200 }
    );
  }

  console.log("Invoice Response:", result.raw);

  return NextResponse.json(
    {
      ok: true,
      ecpayStatus: 200,
      raw: result.raw,
      sent: {
        MerchantID: creds!.merchantId,
        RelateNumber: relateNumber,
        SalesAmount: salesAmount,
        items: ecpayItems.map((x) => ({ name: x.ItemName, count: x.ItemCount, word: x.ItemWord, price: x.ItemPrice, amount: x.ItemAmount })),
      },
    },
    { status: 200 }
  );
}

