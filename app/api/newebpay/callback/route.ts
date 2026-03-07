import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { newebpayAesDecrypt, newebpayTradeSha } from "@/lib/payment-utils";
import { ensureCapacityAndMarkPaid } from "@/lib/bookingPayment";
import { getNewebpayCreds } from "@/lib/newebpay/config";

/**
 * 藍新背景通知（NotifyURL）。
 * 藍新依 RespondType 可能回傳 application/json 或 application/x-www-form-urlencoded，兩者皆支援。
 */
export async function POST(request: NextRequest) {
  console.log("[NewebPay callback] route hit (NotifyURL)");

  const contentType = request.headers.get("content-type") ?? "";
  console.log("[NewebPay callback] raw request content-type:", contentType);

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (e) {
    console.error("[NewebPay callback] 讀取 body 失敗", e);
    return NextResponse.json({ error: "body read failed" }, { status: 400 });
  }

  console.log("[NewebPay callback] raw body length:", rawBody.length, "body preview (前 120 字元):", rawBody.slice(0, 120));

  let tradeInfoEnc: string;
  let tradeShaReceived: string;
  const parsedKeys: string[] = [];

  if (contentType.includes("application/json")) {
    try {
      const body = JSON.parse(rawBody) as Record<string, unknown>;
      parsedKeys.push(...Object.keys(body));
      tradeInfoEnc = typeof body.TradeInfo === "string" ? body.TradeInfo : "";
      tradeShaReceived = typeof body.TradeSha === "string" ? body.TradeSha : "";
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
      console.log("[NewebPay callback] parsed as JSON, keys:", parsedKeys);
    } catch (e) {
      console.error("[NewebPay callback] JSON parse 失敗，改試 form", e);
      const params = new URLSearchParams(rawBody);
      params.forEach((_, key) => parsedKeys.push(key));
      tradeInfoEnc = params.get("TradeInfo") ?? "";
      tradeShaReceived = params.get("TradeSha") ?? "";
      console.log("[NewebPay callback] parsed as form (fallback), keys:", parsedKeys);
    }
  } else {
    const params = new URLSearchParams(rawBody);
    params.forEach((_, key) => parsedKeys.push(key));
    tradeInfoEnc = params.get("TradeInfo") ?? "";
    tradeShaReceived = params.get("TradeSha") ?? "";
    console.log("[NewebPay callback] parsed as form, keys:", parsedKeys);
  }

  console.log("[NewebPay callback] TradeInfo length:", tradeInfoEnc.length, "TradeSha length:", tradeShaReceived.length);

  const creds = getNewebpayCreds();
  if (!creds) {
    console.error("[NewebPay callback] 藍新金流未設定（缺少 NEWEBPAY_MERCHANT_ID / HASH_KEY / HASH_IV）");
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
    console.log("[NewebPay callback] decrypt success");
  } catch (e) {
    console.error("[NewebPay callback] decrypt failure", e);
    return NextResponse.json({ error: "解密失敗" }, { status: 400 });
  }

  const params = new URLSearchParams(decrypted);
  const status = params.get("Status");
  const tradeNo = params.get("TradeNo") ?? "";
  const merchantOrderNoRaw = params.get("MerchantOrderNo") ?? "";
  const merchantOrderNo = merchantOrderNoRaw.trim();
  const amt = params.get("Amt") ?? "";
  console.log("[NewebPay callback] MerchantOrderNo (trimmed):", JSON.stringify(merchantOrderNo), "length:", merchantOrderNo.length, "Status:", status);
  console.log("[NewebPay callback] TradeNo:", tradeNo, "Amt:", amt);

  if (status !== "SUCCESS") {
    console.log("[NewebPay callback] 非 SUCCESS 仍回 200 避免重試");
    return NextResponse.json({ message: "payment not success" });
  }

  const supabase = createServerSupabase();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, class_id, merchant_id, slot_date, slot_time")
    .eq("newebpay_merchant_order_no", merchantOrderNo)
    .eq("status", "unpaid")
    .maybeSingle();

  if (!booking) {
    console.log("[NewebPay callback] 無 unpaid booking 對應 newebpay_merchant_order_no:", JSON.stringify(merchantOrderNo), "→ 改查 pending_payments");
  }

  if (!fetchError && booking) {
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
    console.log("[NewebPay callback] 訂單已更新為 paid bookingId:", bookingRow.id, "DB update result: ok");
  } else {
    const { data: pending, error: pendingErr } = await supabase
      .from("pending_payments")
      .select("id")
      .eq("payment_method", "newebpay")
      .eq("gateway_key", merchantOrderNo)
      .maybeSingle();

    console.log("[NewebPay callback] pending lookup gateway_key (trimmed):", JSON.stringify(merchantOrderNo), "length:", merchantOrderNo.length, "pending found:", !!pending, "pendingErr:", pendingErr?.message ?? null);

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
          console.log("[NewebPay callback] 從 pending 建立訂單成功 bookingId:", res.booking_id, "DB update result: ok");
        }
      }
    } else {
      console.log("[NewebPay callback] 無對應 booking 或 pending，仍回 200");
    }
  }

  revalidatePath("/member");
  return NextResponse.json({ message: "OK" });
}
