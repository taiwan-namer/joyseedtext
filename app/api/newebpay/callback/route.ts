import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { newebpayAesDecrypt, newebpayTradeSha } from "@/lib/payment-utils";
import { ensureCapacityAndMarkPaid } from "@/lib/bookingPayment";
import { getNewebpayCreds, getNewebpayCredsForLog } from "@/lib/newebpay/config";
import { issueInvoice } from "@/lib/invoice/service";
import { extractNewebpayPaymentTypeFromDecrypted } from "@/lib/newebpay/notifyPaymentType";
import { queryNewebpayPaymentType } from "@/lib/newebpay/queryTradeInfo";
import { parseNewebpayIncomingPost } from "@/lib/newebpay/parseIncomingPost";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * 藍新背景通知（NotifyURL）。
 * 完整 log 原始 payload；解密後依 Status / TradeStatus 判定成功並更新訂單。
 */
export async function POST(request: NextRequest) {
  console.log("[NewebPay callback] route hit (NotifyURL)");

  const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
  if (!merchantId) {
    console.error("[NewebPay callback] 未設定 NEXT_PUBLIC_CLIENT_ID");
    return NextResponse.json({ error: "未設定 NEXT_PUBLIC_CLIENT_ID" }, { status: 500 });
  }

  let parsed: Awaited<ReturnType<typeof parseNewebpayIncomingPost>>;
  try {
    parsed = await parseNewebpayIncomingPost(request);
  } catch (e) {
    console.error("[NewebPay callback] 讀取／解析 body 失敗", e);
    return NextResponse.json({ error: "body read failed" }, { status: 400 });
  }

  const { rawBody, contentType, parsedKeys, parsedObject, rawJsonBody, tradePairs } = parsed;

  console.log("[NewebPay callback] request content-type:", contentType);
  console.log("[NewebPay callback] raw body length:", rawBody.length);
  if (rawBody.length > 0) {
    console.log("[NewebPay callback] raw body text (full):", rawBody);
  }
  console.log("[NewebPay callback] trade pair candidates:", tradePairs.map((p) => p.source));

  console.log("[NewebPay callback] parsed form keys:", parsedKeys);
  console.log("[NewebPay callback] parsed form object (each key -> value length):", Object.fromEntries(parsedKeys.map((k) => [k, (parsedObject[k] ?? "").length])));

  const getStr = (key: string): string => (parsedObject[key] ?? parsedObject[key.toLowerCase()] ?? "").trim();
  console.log("[NewebPay callback] from raw payload (plain): Status:", getStr("Status"), "TradeStatus:", getStr("TradeStatus"), "Message:", getStr("Message"), "Result:", getStr("Result").slice(0, 100), "MerchantOrderNo:", getStr("MerchantOrderNo"), "OrderNo:", getStr("OrderNo"), "TradeNo:", getStr("TradeNo"), "Amt:", getStr("Amt"));

  const credsForLog = getNewebpayCredsForLog();
  if (credsForLog) {
    console.log("[NewebPay callback] merchantId:", credsForLog.merchantId, "hashKeyMask:", credsForLog.hashKeyMask, "hashIvMask:", credsForLog.hashIvMask);
  }

  const creds = getNewebpayCreds();
  if (!creds) {
    console.error("[NewebPay callback] 藍新金流未設定");
    return NextResponse.json({ error: "藍新金流未設定" }, { status: 500 });
  }

  if (tradePairs.length === 0) {
    console.log("[NewebPay callback] 無任何 TradeInfo／TradeSha 候選");
    return NextResponse.json({ error: "Missing TradeInfo or TradeSha" }, { status: 400 });
  }

  let tradeInfoEnc = "";
  let tradeShaReceived = "";
  let decrypted: string | null = null;
  let usedPairSource = "";

  for (const c of tradePairs) {
    const expectedSha = newebpayTradeSha(c.tradeInfo, creds.hashKey, creds.hashIv);
    const shaOk = c.tradeSha.toUpperCase() === expectedSha;
    console.log(
      "[NewebPay callback] 候選",
      c.source,
      "TradeSha:",
      shaOk ? "成功" : "失敗",
      "TradeInfo len:",
      c.tradeInfo.length
    );
    if (!shaOk) continue;
    try {
      decrypted = newebpayAesDecrypt(c.tradeInfo, creds.hashKey, creds.hashIv);
      tradeInfoEnc = c.tradeInfo;
      tradeShaReceived = c.tradeSha;
      usedPairSource = c.source;
      console.log(
        "[NewebPay callback] decrypt success, source:",
        usedPairSource,
        "decrypted length:",
        decrypted.length
      );
      break;
    } catch (e) {
      console.warn("[NewebPay callback] 候選", c.source, "TradeSha 通過但解密失敗:", e);
    }
  }

  if (!decrypted) {
    console.error("[NewebPay callback] 所有候選皆無法通過驗證／解密（請確認 HashKey／HashIV 與商店後台一致，或檢查 Notify 格式）");
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
  /** 解密內能拿到的付款別；若 Notify 回的是送單內容可能為空，稍後用 QueryTradeInfo 補 */
  let paymentTypeDec = extractNewebpayPaymentTypeFromDecrypted(decryptedObj, decrypted);
  const responseCode = getDecByKey("ResponseCode");
  const returnUrlVal = getDecByKey("ReturnURL");
  const notifyUrlVal = getDecByKey("NotifyURL");

  const rawSuccess = rawJsonBody && (rawJsonBody.success === true || String(rawJsonBody.Status ?? "").toUpperCase() === "SUCCESS");
  const rawPayStatus = rawJsonBody?.data && typeof rawJsonBody.data === "object"
    ? String((rawJsonBody.data as Record<string, unknown>).payStatus ?? "").toUpperCase()
    : "";
  const rawStatusSuccess = rawPayStatus === "SUCCESS" || (rawJsonBody && String(rawJsonBody.Status ?? "").toUpperCase() === "SUCCESS");

  console.log(
    "[NewebPay callback] after decrypt: Status:",
    statusVal,
    "TradeStatus:",
    tradeStatus,
    "Message:",
    message,
    "MerchantOrderNo:",
    merchantOrderNo,
    "TradeNo:",
    tradeNo,
    "Amt:",
    amt,
    "PaymentType:",
    paymentTypeDec || "(none)",
    "ResponseCode:",
    responseCode
  );
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

  if (!paymentTypeDec) {
    const amtNum = parseInt(String(amt).replace(/[^\d]/g, ""), 10) || 0;
    if (amtNum > 0) {
      const q = await queryNewebpayPaymentType({ merchantOrderNo, amt: amtNum });
      if (q) {
        paymentTypeDec = q;
        console.log("[NewebPay callback] PaymentType 由 QueryTradeInfo 補齊:", q);
      }
    }
  }

  const supabase = createServerSupabase();
  // 與綠界相同：庫存課訂單 merchant_id 為老師，sold_via_merchant_id 為結帳站，不可只 eq merchant_id
  const { data: bookingRows, error: fetchError } = await supabase
    .from("bookings")
    .select("id, class_id, merchant_id, sold_via_merchant_id, slot_date, slot_time, status, order_amount")
    .eq("newebpay_merchant_order_no", merchantOrderNo);

  if (fetchError) {
    console.error("[NewebPay callback] bookings by MerchantOrderNo:", fetchError.message);
  }
  const bRows = bookingRows ?? [];
  if ((bRows.length ?? 0) > 1) {
    console.warn("[NewebPay callback] 多筆訂單同 newebpay_merchant_order_no，取符合店家之一筆:", merchantOrderNo);
  }
  const booking =
    (bRows.find(
      (r) =>
        (r as { merchant_id?: string }).merchant_id === merchantId ||
        (r as { sold_via_merchant_id?: string | null }).sold_via_merchant_id === merchantId
    ) as (typeof bRows)[0] | undefined) ?? (bRows.length === 1 ? bRows[0] : undefined);

  if (!paymentTypeDec && booking && merchantOrderNo) {
    const oa = (booking as { order_amount?: number | null }).order_amount;
    const amtFallback = typeof oa === "number" && oa > 0 ? Math.round(oa) : 0;
    if (amtFallback > 0) {
      const q = await queryNewebpayPaymentType({ merchantOrderNo, amt: amtFallback });
      if (q) {
        paymentTypeDec = q;
        console.log("[NewebPay callback] PaymentType 依訂單 order_amount QueryTradeInfo 補齊:", q);
      }
    }
  }

  if (booking) {
    const status = (booking as { status?: string }).status ?? "";
    if (status === "paid" || status === "completed") {
      if (paymentTypeDec) {
        await supabase
          .from("bookings")
          .update({ newebpay_payment_type: paymentTypeDec })
          .eq("id", (booking as { id: string }).id)
          .eq("merchant_id", (booking as { merchant_id: string }).merchant_id)
          .is("newebpay_payment_type", null);
      }
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
      if (paymentTypeDec) {
        await supabase
          .from("bookings")
          .update({ newebpay_payment_type: paymentTypeDec })
          .eq("id", bookingRow.id)
          .eq("merchant_id", bookingRow.merchant_id);
      }
      console.log("[NewebPay callback] 訂單已更新為 paid bookingId:", bookingRow.id);
      const invoiceResult = await issueInvoice(supabase, bookingRow.id, bookingRow.merchant_id);
      if (!invoiceResult.ok) {
        console.error("[NewebPay callback] 發票開立失敗（不影響付款結果）bookingId:", bookingRow.id, "error:", invoiceResult.error);
      }
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
      .select("id, order_amount")
      .eq("payment_method", "newebpay")
      .eq("gateway_key", merchantOrderNo)
      .eq("merchant_id", merchantId)
      .maybeSingle();

    console.log("[NewebPay callback] pending lookup gateway_key:", JSON.stringify(merchantOrderNo), "pending found:", !!pending, "pendingErr:", pendingErr?.message ?? null);

    if (!pendingErr && pending) {
      if (!paymentTypeDec && merchantOrderNo) {
        const poa = (pending as { order_amount?: number | null }).order_amount;
        const pamt = typeof poa === "number" && poa > 0 ? Math.round(poa) : 0;
        if (pamt > 0) {
          const q = await queryNewebpayPaymentType({ merchantOrderNo, amt: pamt });
          if (q) {
            paymentTypeDec = q;
            console.log("[NewebPay callback] PaymentType 依 pending order_amount QueryTradeInfo 補齊:", q);
          }
        }
      }
      const { data: rpcResult, error: rpcErr } = await supabase.rpc("create_booking_from_pending", {
        p_pending_id: (pending as { id: string }).id,
      });
      if (!rpcErr && rpcResult) {
        const res = rpcResult as { ok?: boolean; booking_id?: string };
        if (res.ok && res.booking_id) {
          await supabase
            .from("bookings")
            .update({
              newebpay_merchant_order_no: merchantOrderNo,
              newebpay_trade_no: tradeNo,
              ...(paymentTypeDec ? { newebpay_payment_type: paymentTypeDec } : {}),
            })
            .eq("id", res.booking_id);
          console.log("[NewebPay callback] 從 pending 建立訂單成功 bookingId:", res.booking_id);
          const { data: createdBooking } = await supabase
            .from("bookings")
            .select("merchant_id")
            .eq("id", res.booking_id)
            .single();
          const bookingOwnerMerchant =
            (createdBooking as { merchant_id?: string } | null)?.merchant_id ?? merchantId;
          const invoiceResult = await issueInvoice(supabase, res.booking_id, bookingOwnerMerchant);
          if (!invoiceResult.ok) {
            console.error("[NewebPay callback] 發票開立失敗（不影響付款結果）bookingId:", res.booking_id, "error:", invoiceResult.error);
          }
        }
      }
    } else {
      console.log("[NewebPay callback] 無對應 booking 或 pending，仍回 200");
    }
  }

  revalidatePath("/member");
  return NextResponse.json({ message: "OK" });
}
