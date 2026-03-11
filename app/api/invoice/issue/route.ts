import { NextRequest, NextResponse } from "next/server";
import { generateECPayMacValue } from "@/lib/crypto-utils";

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
        error:
          "ECPAY_INVOICE_MERCHANT_ID / ECPAY_INVOICE_HASH_KEY / ECPAY_INVOICE_HASH_IV 未設定，請先在環境變數中填寫綠界電子發票金鑰。",
      },
      { status: 500 }
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
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const relateNumber = (body.relateNumber ?? `INV${Date.now()}`).slice(0, 30);
  const customerName = body.customerName?.trim() || "測試買家";
  const customerAddr = body.customerAddr?.trim() || "台北市信義區測試地址";
  const customerPhone = body.customerPhone?.trim() || "0912345678";
  const customerEmail = body.customerEmail?.trim() || "test@example.com";
  const salesAmount = Number.isFinite(body.salesAmount) && (body.salesAmount as number) > 0 ? Number(body.salesAmount) : 850;

  const defaultItems = `ItemName=課程預約|ItemCount=1|ItemWord=堂|ItemPrice=${salesAmount}|ItemAmount=${salesAmount}`;
  const itemsRaw = body.itemsRaw?.trim() || defaultItems;

  const params: Record<string, string> = {
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
    TaxType: "1",
    SalesAmount: String(salesAmount),
    Items: encodeURIComponent(itemsRaw),
    InvType: "07",
    vat: "1",
  };

  const checkMac = generateECPayMacValue(params, creds.hashKey, creds.hashIv);
  params.CheckMacValue = checkMac;

  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    searchParams.append(k, v);
  }

  let responseText = "";
  let status = 200;
  try {
    const res = await fetch(ECPAY_INVOICE_STAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      body: searchParams.toString(),
    });
    status = res.status;
    responseText = await res.text();
  } catch (e) {
    console.error("[Invoice issue] 向綠界發票 API 發送請求失敗", e);
    return NextResponse.json({ error: "Failed to call ECPay invoice API" }, { status: 502 });
  }

  console.log("Invoice Response:", responseText);

  return NextResponse.json(
    {
      ok: status === 200,
      status,
      raw: responseText,
      sent: {
        MerchantID: params.MerchantID,
        RelateNumber: params.RelateNumber,
        SalesAmount: params.SalesAmount,
        ItemsRaw: itemsRaw,
      },
    },
    { status: status === 200 ? 200 : 502 }
  );
}

