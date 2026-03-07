import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { newebpayAesDecrypt, newebpayTradeSha } from "@/lib/payment-utils";
import { ensureCapacityAndMarkPaid } from "@/lib/bookingPayment";
import { getNewebpayCreds, getNewebpayCredsForLog } from "@/lib/newebpay/config";

/**
 * 藍新背景通知（NotifyURL）。
 * 完整 log 原始 payload；解密後依 Status / TradeStatus 判定成功並更新訂單。
 */
export async function POST(request: NextRequest) {
  console.log("[NewebPay callback] route hit (NotifyURL)");

  const contentType = request.headers.get("content-type") ?? "";
  console.log("[NewebPay callback] request content-type:", contentType);

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (e) {
    console.error("[NewebPay callback] 讀取 body 失敗", e);
    return NextResponse.json({ error: "body read failed" }, { status: 400 });
  }

  console.log("[NewebPay callback] raw body length:", rawBody.length);
  console.log("[NewebPay callback] raw body text (full):", rawBody);

  const parsedKeys: string[] = [];
  const parsedObject: Record<string, string> = {};
  let tradeInfoEnc = "";
  let tradeShaReceived = "";
  let rawJsonBody: Record<string, unknown> | null = null;

  if (contentType.includes("application/json")) {
    try {
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      rawJsonBody = body;
      for (const k of Object.keys(body)) {
        parsedKeys.push(k);
        const v = body[k];
        const s = v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v).slice(0, 200) : String(v);
        parsedObject[k] = s;
      }
      tradeInfoEnc = typeof body.TradeInfo === "string" ? body.TradeInfo : (body.tradeinfo as string) ?? "";
      tradeShaReceived = typeof body.TradeSha === "string" ? body.TradeSha : (body.tradesha as string) ?? "";
      if (!tradeInfoEnc && body.Result && typeof body.Result === "object") {
        const r = body.Result as Record<string, unknown>;
        if (typeof r.TradeInfo === "string") tradeInfoEnc = r.TradeInfo;
        if (typeof r.TradeSha === "string") tradeShaReceived = r.TradeSha;
      }
      if (!tradeInfoEnc && body.data && typeof body.data === "object") {
        const d = body.data as Record<string, unknown>;
        if (typeof d.TradeInfo === "string") tradeInfoEnc = d.TradeInfo;
        if (typeof d.TradeSha === "string") tradeShaReceived = d.TradeSha;
      }
    } catch (e) {
      console.error("[NewebPay callback] JSON parse 失敗，改試 form", e);
      const params = new URLSearchParams(rawBody);
      params.forEach((value, key) => {
        parsedKeys.push(key);
        parsedObject[key] = value;
      });
      tradeInfoEnc = params.get("TradeInfo") ?? params.get("tradeinfo") ?? "";
      tradeShaReceived = params.get("TradeSha") ?? params.get("tradesha") ?? "";
    }
  } else {
    const params = new URLSearchParams(rawBody);
    params.forEach((value, key) => {
      parsedKeys.push(key);
      parsedObject[key] = value;
    });
    tradeInfoEnc = params.get("TradeInfo") ?? params.get("tradeinfo") ?? "";
    tradeShaReceived = params.get("TradeSha") ?? params.get("tradesha") ?? "";
  }

  console.log("[NewebPay callback] parsed form keys:", parsedKeys);
  console.log("[NewebPay callback] parsed form object (each key -> value length):", Object.fromEntries(parsedKeys.map((k) => [k, (parsedObject[k] ?? "").length])));

  const getStr = (key: string): string => (parsedObject[key] ?? parsedObject[key.toLowerCase()] ?? "").trim();
  console.log("[NewebPay callback] from raw payload (plain): Status:", getStr("Status"), "TradeStatus:", getStr("TradeStatus"), "Message:", getStr("Message"), "Result:", getStr("Result").slice(0, 100), "MerchantOrderNo:", getStr("MerchantOrderNo"), "OrderNo:", getStr("OrderNo"), "TradeNo:", getStr("TradeNo"), "Amt:", getStr("Amt"));

  console.log("[NewebPay callback] field used for decrypt: TradeInfo, length:", tradeInfoEnc.length, "preview (前 32 字):", tradeInfoEnc.slice(0, 32));

  const credsForLog = getNewebpayCredsForLog();
  if (credsForLog) {
    console.log("[NewebPay callback] merchantId:", credsForLog.merchantId, "hashKeyMask:", credsForLog.hashKeyMask, "hashIvMask:", credsForLog.hashIvMask);
  }

  const creds = getNewebpayCreds();
  if (!creds) {
    console.error("[NewebPay callback] 藍新金流未設定");
    return NextResponse.json({ error: "藍新金流未設定" }, { status: 500 });
  }

  if (!tradeInfoEnc || !tradeShaReceived) {
    console.log("[NewebPay callback] TradeInfo 或 TradeSha 為空");
    return NextResponse.json({ error: "Missing TradeInfo or TradeSha" }, { status: 400 });
  }

  const expectedSha = newebpayTradeSha(tradeInfoEnc, creds.hashKey, creds.hashIv);
  const shaValid = tradeShaReceived.toUpperCase() === expectedSha;
  console.log("[NewebPay callback] TradeSha 驗證:", shaValid ? "成功" : "失敗");
  if (!shaValid) {
    return NextResponse.json({ error: "TradeSha 驗證失敗" }, { status: 400 });
  }

  let decrypted: string;
  try {
    decrypted = newebpayAesDecrypt(tradeInfoEnc, creds.hashKey, creds.hashIv);
    console.log("[NewebPay callback] decrypt success, decrypted length:", decrypted.length);
  } catch (e) {
    console.error("[NewebPay callback] decrypt failure", e);
    return NextResponse.json({ error: "解密失敗" }, { status: 400 });
  }

  let decryptedObj: Record<string, string> = {};
  const decryptedKeys: string[] = [];
  if (decrypted.trim().startsWith("{")) {
    try {
      const j = JSON.parse(decrypted) as Record<string, unknown>;
      for (const [k, v] of Object.entries(j)) {
        decryptedKeys.push(k);
        decryptedObj[k] = v === undefined || v === null ? "" : String(v);
      }
      console.log("[NewebPay callback] decrypted 為 JSON，已解析");
    } catch {
      // 非 JSON 則當 query string 處理
    }
  }
  if (decryptedKeys.length === 0) {
    const params = new URLSearchParams(decrypted);
    params.forEach((_, key) => decryptedKeys.push(key));
    params.forEach((value, key) => {
      decryptedObj[key] = value;
    });
  }
  console.log("[NewebPay callback] decrypted payload keys:", decryptedKeys.sort());
  console.log("[NewebPay callback] decrypted payload (full):", decryptedObj);
  console.log("[NewebPay callback] decrypted raw (前 300 字元):", decrypted.slice(0, 300));

  const getDecByKey = (targetKey: string): string => {
    const lower = targetKey.toLowerCase();
    for (const [k, v] of Object.entries(decryptedObj)) {
      if (k.toLowerCase() === lower) return (v ?? "").trim();
    }
    return "";
  };
  const statusVal = getDecByKey("Status");
  const tradeStatus = getDecByKey("TradeStatus");
  const message = getDecByKey("Message");
  const tradeNo = getDecByKey("TradeNo");
  const merchantOrderNoFromDec =
    getDecByKey("MerchantOrderNo") ||
    getDecByKey("merchant_order_no") ||
    (decrypted.match(/"MerchantOrderNo"\s*:\s*"([^"]+)"/) ?? decrypted.match(/MerchantOrderNo=([^&]+)/))?.[1]?.trim() ||
    (decrypted.match(/"merchant_order_no"\s*:\s*"([^"]+)"/) ?? decrypted.match(/merchant_order_no=([^&]+)/))?.[1]?.trim();
  const merchantOrderNo = merchantOrderNoFromDec || getStr("MerchantOrderNo") || getStr("OrderNo");
  const amt = getDecByKey("Amt");
  const responseCode = getDecByKey("ResponseCode");
  const returnUrlVal = getDecByKey("ReturnURL");
  const notifyUrlVal = getDecByKey("NotifyURL");

  const rawSuccess = rawJsonBody && (rawJsonBody.success === true || String(rawJsonBody.Status ?? "").toUpperCase() === "SUCCESS");
  const rawPayStatus = rawJsonBody?.data && typeof rawJsonBody.data === "object"
    ? String((rawJsonBody.data as Record<string, unknown>).payStatus ?? "").toUpperCase()
    : "";
  const rawStatusSuccess = rawPayStatus === "SUCCESS" || (rawJsonBody && String(rawJsonBody.Status ?? "").toUpperCase() === "SUCCESS");

  console.log("[NewebPay callback] after decrypt: Status:", statusVal, "TradeStatus:", tradeStatus, "Message:", message, "MerchantOrderNo:", merchantOrderNo, "TradeNo:", tradeNo, "Amt:", amt, "ResponseCode:", responseCode);
  console.log("[NewebPay callback] ReturnURL/NotifyURL from decrypt:", !!returnUrlVal, !!notifyUrlVal);
  console.log("[NewebPay callback] from raw JSON: success:", rawJsonBody?.success, "Status:", rawJsonBody?.Status, "data.payStatus:", rawPayStatus || "(none)");

  const hasDecryptedStatus = statusVal !== "" || tradeStatus !== "" || responseCode !== "";
  const hasReturnOrNotify = returnUrlVal !== "" || notifyUrlVal !== "" || /ReturnURL=|NotifyURL=/i.test(decrypted);
  const hasAmtWeSent = /Amt=\d+/.test(decrypted);
  const looksLikeOurRequest = !!merchantOrderNo && (hasReturnOrNotify || hasAmtWeSent);

  const isSuccess =
    statusVal.toUpperCase() === "SUCCESS" ||
    tradeStatus === "1" ||
    String(responseCode).toUpperCase() === "SUCCESS" ||
    rawSuccess === true ||
    rawStatusSuccess ||
    (looksLikeOurRequest && !hasDecryptedStatus);

  console.log("[NewebPay callback] looksLikeOurRequest:", looksLikeOurRequest, "hasReturnOrNotify:", hasReturnOrNotify, "hasAmtWeSent:", hasAmtWeSent, "hasDecryptedStatus:", hasDecryptedStatus);

  if (looksLikeOurRequest && !hasDecryptedStatus) {
    console.log("[NewebPay callback] 解密內容為我們送出的請求（含 ReturnURL/NotifyURL 或 Amt、無 Status），視為 NotifyURL 回呼即付款完成，判定成功");
  }

  if (!isSuccess) {
    console.log("[NewebPay callback] 非成功 (decrypt Status:", statusVal, "TradeStatus:", tradeStatus, "raw success:", rawSuccess, "rawPayStatus:", rawPayStatus, "looksLikeOurRequest:", looksLikeOurRequest, ") 仍回 200");
    return NextResponse.json({ message: "payment not success" });
  }

  if (!merchantOrderNo) {
    console.log("[NewebPay callback] 判定成功但無 MerchantOrderNo，仍回 200");
    return NextResponse.json({ message: "OK" });
  }

  const supabase = createServerSupabase();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, class_id, merchant_id, slot_date, slot_time, status")
    .eq("newebpay_merchant_order_no", merchantOrderNo)
    .maybeSingle();

  if (!fetchError && booking) {
    const status = (booking as { status?: string }).status ?? "";
    if (status === "paid" || status === "completed") {
      console.log("[NewebPay callback] 訂單已為 paid/completed，冪等直接回 200 bookingId:", (booking as { id: string }).id);
      revalidatePath("/member");
      return NextResponse.json({ message: "OK" });
    }
    if (status === "unpaid") {
      const bookingRow = {
        id: (booking as { id: string }).id,
        class_id: (booking as { class_id?: string }).class_id ?? "",
        merchant_id: (booking as { merchant_id: string }).merchant_id,
        slot_date: (booking as { slot_date?: string | null }).slot_date ?? null,
        slot_time: (booking as { slot_time?: string | null }).slot_time ?? null,
      };
      const result = await ensureCapacityAndMarkPaid(supabase, bookingRow, {
        newebpay_trade_no: tradeNo,
      });
      if (!result.ok) {
        console.error("[NewebPay callback] 更新訂單失敗", result.error);
        return NextResponse.json({ error: "更新訂單失敗" }, { status: 500 });
      }
      console.log("[NewebPay callback] 訂單已更新為 paid bookingId:", bookingRow.id);
      revalidatePath("/member");
      return NextResponse.json({ message: "OK" });
    }
  }

  if (!booking) {
    console.log("[NewebPay callback] 無 booking, MerchantOrderNo:", JSON.stringify(merchantOrderNo), "→ 改查 pending_payments");
  }

  {
    const { data: pending, error: pendingErr } = await supabase
      .from("pending_payments")
      .select("id")
      .eq("payment_method", "newebpay")
      .eq("gateway_key", merchantOrderNo)
      .maybeSingle();

    console.log("[NewebPay callback] pending lookup gateway_key:", JSON.stringify(merchantOrderNo), "pending found:", !!pending, "pendingErr:", pendingErr?.message ?? null);

    if (!pendingErr && pending) {
      const { data: rpcResult, error: rpcErr } = await supabase.rpc("create_booking_from_pending", {
        p_pending_id: (pending as { id: string }).id,
      });
      if (!rpcErr && rpcResult) {
        const res = rpcResult as { ok?: boolean; booking_id?: string };
        if (res.ok && res.booking_id) {
          await supabase
            .from("bookings")
            .update({ newebpay_merchant_order_no: merchantOrderNo, newebpay_trade_no: tradeNo })
            .eq("id", res.booking_id);
          console.log("[NewebPay callback] 從 pending 建立訂單成功 bookingId:", res.booking_id);
        }
      }
    } else {
      console.log("[NewebPay callback] 無對應 booking 或 pending，仍回 200");
    }
  }

  revalidatePath("/member");
  return NextResponse.json({ message: "OK" });
}
