import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getLinePaySandboxCredentials, validateLinePayCredentials, confirmLinePayPayment } from "@/lib/linepay";
import { logPaymentApi } from "@/lib/paymentLogs";
import { ensureCapacityAndMarkPaid } from "@/lib/bookingPayment";
import { resolvePublicBaseUrl } from "@/lib/appUrl";

/** 勿使用 request.url：建置預渲染會觸發 Dynamic server usage，catch 內 redirect 若 base 無 https 會 malformed */
export const dynamic = "force-dynamic";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * LINE Pay 使用者完成授權後會導向此 confirmUrl，並帶上 transactionId、orderId（= 我們的 booking id）。
 * 流程：從 URL 取得 transactionId / orderId → 呼叫 LINE Pay Confirm API →
 * 使用 Supabase Service Role 將對應訂單 status 更新為 paid、寫入 line_pay_transaction_id → 導向報名成功頁。
 * 訂單 ID 可從 orderId、bookingId、id 任一 query 參數讀取。
 * 失敗時導向結帳頁（不導向首頁 /）。
 */
export async function GET(request: NextRequest) {
  const baseUrl = resolvePublicBaseUrl(request.nextUrl.origin);
  const checkoutFailPath = "/course/course/checkout";
  const redirectFail = (msg: string, detail?: string, slug?: string) => {
    const params = new URLSearchParams({ error: "linepay_confirm", message: msg });
    if (detail) params.set("detail", detail);
    const path = `${baseUrl}/course/${slug ?? "course"}/checkout?${params.toString()}`;
    return NextResponse.redirect(path);
  };
  const redirectNoId = () =>
    NextResponse.redirect(`${baseUrl}${checkoutFailPath}?error=no_id_provided`);

  try {
    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get("transactionId");
    const orderIdRaw =
      searchParams.get("orderId") || searchParams.get("bookingId") || searchParams.get("id");
    const orderId = typeof orderIdRaw === "string" ? orderIdRaw.trim() : "";

    if (!orderId) {
      return redirectNoId();
    }

    if (!transactionId) {
      return redirectFail("缺少交易參數", "缺少 transactionId");
    }

    const currentMerchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!currentMerchantId) {
      return redirectFail("系統設定錯誤", "未設定 NEXT_PUBLIC_CLIENT_ID");
    }

    let supabase: ReturnType<typeof createServerSupabase>;
    try {
      supabase = createServerSupabase();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.error("[LINE Pay Confirm] Supabase 初始化失敗", m);
      return redirectFail("系統暫時無法處理付款回呼", m);
    }

    /** 已寫入交易編號的訂單：LINE 重複導向或使用者重新整理時直接導向成功頁，避免再次 Confirm 失敗 */
    const { data: alreadyPaid } = await supabase
      .from("bookings")
      .select("id")
      .eq("line_pay_transaction_id", transactionId)
      .maybeSingle();
    if (alreadyPaid && (alreadyPaid as { id?: string }).id) {
      revalidatePath("/member");
      const bid = (alreadyPaid as { id: string }).id;
      return NextResponse.redirect(`${baseUrl}/booking/success?bookingId=${encodeURIComponent(bid)}`);
    }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, merchant_id, sold_via_merchant_id, class_id, order_amount, status, payment_method, slot_date, slot_time"
    )
    .eq("id", orderId)
    .single();

  let merchantId: string;
  let amount: number;
  let finalBookingId: string;
  let classIdForFail: string | undefined;

  const bookingVisible =
    booking &&
    ((booking as { merchant_id: string }).merchant_id === currentMerchantId ||
      (booking as { sold_via_merchant_id?: string | null }).sold_via_merchant_id === currentMerchantId);

  if (
    !bookingError &&
    bookingVisible &&
    (booking as { status?: string }).status === "unpaid" &&
    (booking as { payment_method?: string }).payment_method === "linepay"
  ) {
    merchantId = (booking as { merchant_id: string }).merchant_id;
    const orderAmt = (booking as { order_amount?: number }).order_amount;
    amount = typeof orderAmt === "number" && orderAmt >= 0 ? orderAmt : 0;
    classIdForFail = (booking as { class_id?: string }).class_id;
    if (amount <= 0) {
      return redirectFail("訂單金額異常");
    }

    const { data: settingsRow, error: settingsError } = await supabase
      .from("store_settings")
      .select("frontend_settings")
      .eq("merchant_id", merchantId)
      .maybeSingle();

    if (settingsError || !settingsRow?.frontend_settings) {
      return redirectFail("店家金流未設定");
    }

    const raw = settingsRow.frontend_settings as Record<string, unknown>;
    const linePayApi = typeof raw.linePayApi === "string" ? raw.linePayApi : null;
    const creds = getLinePaySandboxCredentials(linePayApi);

    if (!creds) {
      return redirectFail("LINE Pay 未設定（請設定 .env 或後台金流）");
    }

    const validation = validateLinePayCredentials(creds);
    if (!validation.ok) {
      return redirectFail(validation.error);
    }

    const requestBody = { amount, currency: "TWD" as const };
    const confirmRes = await confirmLinePayPayment({
      channelId: creds.channelId,
      channelSecret: creds.channelSecret,
      transactionId,
      amount,
      currency: "TWD",
    });

    await logPaymentApi(supabase, {
      merchant_id: merchantId,
      order_id: orderId,
      transaction_id: transactionId,
      api_type: "confirm",
      request_body: JSON.stringify(requestBody),
      response_body: JSON.stringify({
        success: confirmRes.success,
        returnCode: confirmRes.returnCode,
        returnMessage: confirmRes.returnMessage,
        info: confirmRes.success ? confirmRes.info : undefined,
      }),
      return_code: confirmRes.returnCode,
      return_message: confirmRes.returnMessage,
    });

    if (!confirmRes.success) {
      return redirectFail(
        "支付失敗，請重新嘗試",
        `${confirmRes.returnCode}: ${confirmRes.returnMessage}`,
        classIdForFail ?? "course"
      );
    }

    const bookingRow = {
      id: orderId,
      class_id: (booking as { class_id?: string }).class_id ?? "",
      merchant_id: (booking as { merchant_id: string }).merchant_id,
      slot_date: (booking as { slot_date?: string | null }).slot_date ?? null,
      slot_time: (booking as { slot_time?: string | null }).slot_time ?? null,
    };
    const updateResult = await ensureCapacityAndMarkPaid(supabase, bookingRow, {
      status: "paid",
      line_pay_transaction_id: transactionId,
    });

    if (!updateResult.ok) {
      console.error("[LINE Pay Confirm]", updateResult.error);
      return redirectFail("更新訂單狀態失敗", updateResult.error);
    }

    finalBookingId = orderId;
  } else {
    const { data: pending, error: pendingErr } = await supabase
      .from("pending_payments")
      .select("id, merchant_id, order_amount")
      .eq("id", orderId)
      .eq("merchant_id", currentMerchantId)
      .eq("payment_method", "linepay")
      .maybeSingle();

    if (pendingErr || !pending) {
      const { data: paidAfterPending } = await supabase
        .from("bookings")
        .select("id")
        .eq("line_pay_transaction_id", transactionId)
        .maybeSingle();
      if (paidAfterPending && (paidAfterPending as { id: string }).id) {
        revalidatePath("/member");
        const bid = (paidAfterPending as { id: string }).id;
        return NextResponse.redirect(`${baseUrl}/booking/success?bookingId=${encodeURIComponent(bid)}`);
      }
      return redirectFail("訂單或待付款不存在", pendingErr?.message ?? "");
    }

    merchantId = (pending as { merchant_id: string }).merchant_id;
    amount = Math.max(0, Number((pending as { order_amount?: number }).order_amount) ?? 0);
    if (amount <= 0) {
      return redirectFail("訂單金額異常");
    }

    const { data: settingsRow, error: settingsError } = await supabase
      .from("store_settings")
      .select("frontend_settings")
      .eq("merchant_id", merchantId)
      .maybeSingle();

    if (settingsError || !settingsRow?.frontend_settings) {
      return redirectFail("店家金流未設定");
    }

    const raw = settingsRow.frontend_settings as Record<string, unknown>;
    const linePayApi = typeof raw.linePayApi === "string" ? raw.linePayApi : null;
    const creds = getLinePaySandboxCredentials(linePayApi);

    if (!creds) {
      return redirectFail("LINE Pay 未設定（請設定 .env 或後台金流）");
    }

    const validation = validateLinePayCredentials(creds);
    if (!validation.ok) {
      return redirectFail(validation.error);
    }

    const confirmRes = await confirmLinePayPayment({
      channelId: creds.channelId,
      channelSecret: creds.channelSecret,
      transactionId,
      amount,
      currency: "TWD",
    });

    await logPaymentApi(supabase, {
      merchant_id: merchantId,
      order_id: orderId,
      transaction_id: transactionId,
      api_type: "confirm",
      request_body: JSON.stringify({ amount, currency: "TWD" }),
      response_body: JSON.stringify({
        success: confirmRes.success,
        returnCode: confirmRes.returnCode,
        returnMessage: confirmRes.returnMessage,
      }),
      return_code: confirmRes.returnCode ?? "",
      return_message: confirmRes.returnMessage ?? "",
    });

    if (!confirmRes.success) {
      return redirectFail("支付失敗，請重新嘗試", `${confirmRes.returnCode}: ${confirmRes.returnMessage}`);
    }

    const { data: rpcResult, error: rpcErr } = await supabase.rpc("create_booking_from_pending", {
      p_pending_id: (pending as { id: string }).id,
    });
    if (rpcErr) {
      console.error("[LINE Pay Confirm] create_booking_from_pending", rpcErr);
      return redirectFail("建立訂單失敗", rpcErr.message);
    }
    const res = rpcResult as { ok?: boolean; booking_id?: string; error?: string } | null;
    if (!res?.ok || !res.booking_id) {
      const errorMsg = res?.error ?? "";
      const isPendingNotFound = errorMsg.includes("pending") || errorMsg.includes("不存在");
      if (isPendingNotFound) {
        const { data: existingBooking } = await supabase
          .from("bookings")
          .select("id")
          .eq("line_pay_transaction_id", transactionId)
          .maybeSingle();
        if (existingBooking && (existingBooking as { id: string }).id) {
          console.log("[LINE Pay Confirm] pending 已不存在，依 transactionId 找到已建立訂單，冪等導向 success bookingId:", (existingBooking as { id: string }).id);
          revalidatePath("/member");
          const successUrl = `${baseUrl}/booking/success?bookingId=${encodeURIComponent((existingBooking as { id: string }).id)}`;
          return NextResponse.redirect(successUrl);
        }
      }
      return redirectFail("建立訂單失敗", errorMsg || undefined);
    }
    finalBookingId = res.booking_id;
    await supabase.from("bookings").update({ line_pay_transaction_id: transactionId }).eq("id", finalBookingId);
  }

    revalidatePath("/member");

    const successUrl = `${baseUrl}/booking/success?bookingId=${encodeURIComponent(finalBookingId)}`;
    return NextResponse.redirect(successUrl);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[LINE Pay Confirm] 未預期錯誤", e);
    return redirectFail("系統暫時無法處理付款回呼", m);
  }
}
