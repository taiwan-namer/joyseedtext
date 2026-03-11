import { NextRequest, NextResponse } from "next/server";
import { ecpayInvoiceEncryptData } from "@/lib/ecpay/invoice-encrypt";

const ECPAY_INVOICE_STAGE_URL = "https://einvoice-stage.ecpay.com.tw/B2CInvoice/Issue";

function getEcpayInvoiceCreds() {
  const merchantId = process.env.ECPAY_INVOICE_MERCHANT_ID?.trim() ?? "";
  const hashKey = process.env.ECPAY_INVOICE_HASH_KEY?.trim() ?? "";
  const hashIv = process.env.ECPAY_INVOICE_HASH_IV?.trim() ?? "";
  if (!merchantId || !hashKey || !hashIv) {
    return null;
  }
  return { merchantId, hashKey, hashIv };
}

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

type InvoiceRequestBody = {
  relateNumber?: string;
  customerName?: string;
  customerAddr?: string;
  customerPhone?: string;
  customerEmail?: string;
  salesAmount?: number;
  /** 自行組好的 Items 字串（ItemName=...|ItemCount=...|ItemWord=...|ItemPrice=...|ItemAmount=...）；未提供時使用預設單一品項。 */
  itemsRaw?: string;
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
      body = {
        relateNumber: (form.get("relateNumber") as string) ?? undefined,
        customerName: (form.get("customerName") as string) ?? undefined,
        customerAddr: (form.get("customerAddr") as string) ?? undefined,
        customerPhone: (form.get("customerPhone") as string) ?? undefined,
        customerEmail: (form.get("customerEmail") as string) ?? undefined,
        salesAmount: form.get("salesAmount") ? Number(form.get("salesAmount")) : undefined,
        itemsRaw: (form.get("itemsRaw") as string) ?? undefined,
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
  const salesAmount = Number.isFinite(body.salesAmount) && (body.salesAmount as number) > 0 ? Number(body.salesAmount) : 850;

  // 綠界 B2C 發票 API：請求為 JSON，含 MerchantID、RqHeader.Timestamp、Data（AES 加密後的 payload）
  // Data 內容：先組 JSON 再 URL Encode 整串，再 AES-128-CBC 加密，輸出 Base64
  const dataPayload = {
    MerchantID: creds.merchantId,
    RelateNumber: relateNumber,
    CustomerID: "",
    CustomerIdentifier: "",
    CustomerName: customerName,
    CustomerAddr: customerAddr,
    CustomerPhone: customerPhone,
    CustomerEmail: customerEmail,
    ClearanceMark: "",
    Print: "0",
    Donation: "0",
    CarrierType: "",
    CarrierNum: "",
    TaxType: "1",
    SalesAmount: salesAmount,
    InvType: "07",
    vat: "1",
    Items: [
      {
        ItemSeq: 1,
        ItemName: "課程預約",
        ItemCount: 1,
        ItemWord: "堂",
        ItemPrice: salesAmount,
        ItemTaxType: "1",
        ItemAmount: salesAmount,
      },
    ],
  };

  let encryptedData: string;
  try {
    encryptedData = ecpayInvoiceEncryptData(
      JSON.stringify(dataPayload),
      creds.hashKey,
      creds.hashIv
    );
  } catch (e) {
    console.error("[Invoice issue] Data 加密失敗", e);
    return NextResponse.json(
      { ok: false, error: "Data encryption failed", detail: String((e as Error).message) },
      { status: 200 }
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const requestBody = {
    MerchantID: creds.merchantId,
    RqHeader: { Timestamp: timestamp },
    Data: encryptedData,
  };

  let responseText = "";
  let status = 200;
  try {
    const res = await fetch(ECPAY_INVOICE_STAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    status = res.status;
    responseText = await res.text();
  } catch (e) {
    console.error("[Invoice issue] 向綠界發票 API 發送請求失敗", e);
    return NextResponse.json(
      { ok: false, error: "Failed to call ECPay invoice API", detail: String((e as Error).message) },
      { status: 200 }
    );
  }

  console.log("Invoice Response:", responseText);

  return NextResponse.json(
    {
      ok: status === 200,
      ecpayStatus: status,
      raw: responseText,
      sent: {
        MerchantID: creds.merchantId,
        RelateNumber: relateNumber,
        SalesAmount: salesAmount,
      },
    },
    { status: 200 }
  );
}

