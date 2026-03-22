"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import { getCurrentMemberEmail } from "@/app/actions/bookingActions";
import { executeEcpayRefund } from "@/lib/ecpay/refundDoAction";
import { executeNewebpayRefund } from "@/lib/newebpay/refund";
import {
  executeLinePayRefund,
  getLinePaySandboxCredentials,
  validateLinePayCredentials,
  type LinePayCredentials,
} from "@/lib/linepay";
import {
  bookingsVisibleToMerchantOrFilter,
  getAdminBookingsAccessFilter,
  type AdminBookingsAccessFilter,
} from "@/lib/bookingsMerchantFilter";
import { voidEcpayInvoice } from "@/lib/invoice/ecpay-void";
import { bookingHasExplicitSessionSlot } from "@/lib/bookingSessionSlot";

function applyAdminBookingsAccess<T>(q: T, access: AdminBookingsAccessFilter): T {
  if (access.mode === "class_creator") {
    return (q as { eq: (c: string, v: string) => T }).eq("class_creator_merchant_id", access.merchantId);
  }
  return (q as { or: (clause: string) => T }).or(access.orClause);
}

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

type BookingRefundRow = {
  id: string;
  status: string;
  merchant_id: string;
  class_id: string | null;
  slot_date: string | null;
  slot_time: string | null;
  payment_method: string;
  ecpay_merchant_trade_no: string | null;
  ecpay_trade_no: string | null;
  ecpay_payment_type: string | null;
  line_pay_transaction_id: string | null;
  newebpay_merchant_order_no: string | null;
  newebpay_trade_no: string | null;
  newebpay_payment_type: string | null;
  order_amount: number | null;
  refund_status: string | null;
  invoice_status: string | null;
  invoice_no: string | null;
};

const BOOKING_REFUND_SELECT =
  "id, status, merchant_id, class_id, slot_date, slot_time, payment_method, ecpay_merchant_trade_no, ecpay_trade_no, ecpay_payment_type, line_pay_transaction_id, newebpay_merchant_order_no, newebpay_trade_no, newebpay_payment_type, order_amount, refund_status, invoice_status, invoice_no";

function validateCommonPaidRefundEligibility(b: BookingRefundRow): string | null {
  if ((b.refund_status ?? "").trim().toLowerCase() === "refunded") {
    return "此訂單已標記為已退款";
  }
  if (b.status !== "paid") {
    return "僅限已付款（paid）訂單可退款";
  }
  const amount =
    b.order_amount != null && Number.isFinite(Number(b.order_amount)) && Number(b.order_amount) > 0
      ? Number(b.order_amount)
      : null;
  if (amount == null) {
    return "訂單金額（order_amount）無效，無法退款";
  }
  return null;
}

function validateEcpayCreditRefundFields(b: BookingRefundRow): string | null {
  const tradeNo = (b.ecpay_trade_no ?? "").trim();
  if (!tradeNo) {
    return "缺少綠界交易編號（ecpay_trade_no）";
  }
  const paymentType = (b.ecpay_payment_type ?? "").trim();
  if (!paymentType) {
    return "缺少付款方式（ecpay_payment_type），無法判斷是否為信用卡";
  }
  if (!paymentType.includes("Credit")) {
    return "非信用卡交易無法自動退刷";
  }
  const merchantTradeNo = (b.ecpay_merchant_trade_no ?? "").trim();
  if (!merchantTradeNo) {
    return "缺少綠界商店訂單編號（ecpay_merchant_trade_no）";
  }
  return null;
}

function validateLinePayRefundFields(b: BookingRefundRow): string | null {
  const tid = (b.line_pay_transaction_id ?? "").trim();
  if (!tid) {
    return "缺少 LINE Pay 交易序號（line_pay_transaction_id）";
  }
  return null;
}

function validateNewebpayRefundFields(b: BookingRefundRow): string | null {
  const orderNo = (b.newebpay_merchant_order_no ?? "").trim();
  if (!orderNo) {
    return "缺少藍新商店訂單編號（newebpay_merchant_order_no）";
  }
  return null;
}

async function resolveLinePayCredentialsForMerchant(
  supabase: ReturnType<typeof createServerSupabase>,
  merchantId: string
): Promise<{ ok: true; creds: LinePayCredentials } | { ok: false; error: string }> {
  const { data: settingsRow, error } = await supabase
    .from("store_settings")
    .select("frontend_settings")
    .eq("merchant_id", merchantId)
    .maybeSingle();

  if (error || !settingsRow?.frontend_settings) {
    return { ok: false, error: "無法讀取店家金流設定（store_settings）" };
  }

  const raw = settingsRow.frontend_settings as Record<string, unknown>;
  const linePayApi = typeof raw.linePayApi === "string" ? raw.linePayApi : null;
  const creds = getLinePaySandboxCredentials(linePayApi);
  if (!creds) {
    return { ok: false, error: "LINE Pay 未設定（請設定 .env 或後台金流 linePayApi）" };
  }

  const validation = validateLinePayCredentials(creds);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  return { ok: true, creds };
}

/**
 * 無場次（未指定有效 slot_date + slot_time）時，付款流程會扣 classes.capacity；
 * 退款／取消成功後回補 +1（與 deleteBooking、confirm_booking_paid 語意一致）。
 */
async function restoreClassCapacityIfPaidWithoutSlot(
  supabase: ReturnType<typeof createServerSupabase>,
  b: BookingRefundRow
): Promise<void> {
  const hadSlot = bookingHasExplicitSessionSlot(b.slot_date, b.slot_time);
  const classId = b.class_id;
  const ownerMerchantId = String(b.merchant_id ?? "");
  if (hadSlot || !classId || !ownerMerchantId) return;

  const { data: cls, error: fetchErr } = await supabase
    .from("classes")
    .select("capacity")
    .eq("id", classId)
    .eq("merchant_id", ownerMerchantId)
    .maybeSingle();
  if (fetchErr) {
    console.error(
      "[Refund] 無場次名額回補：讀取課程失敗",
      fetchErr.message,
      "bookingId:",
      b.id,
      "classId:",
      classId
    );
    return;
  }
  const current = (cls as { capacity?: number } | null)?.capacity ?? 0;
  const { error: upErr } = await supabase
    .from("classes")
    .update({ capacity: Math.max(0, current + 1) })
    .eq("id", classId)
    .eq("merchant_id", ownerMerchantId);
  if (upErr) {
    console.error(
      "[Refund] 無場次名額回補失敗",
      upErr.message,
      "bookingId:",
      b.id,
      "classId:",
      classId
    );
  }
}

type RefundSuccessPatch = {
  refund_status: string;
  status: string;
  invoice_status?: string;
};

/**
 * 金流退款成功後共用：必要時嘗試綠界發票作廢（不拋錯）、回補名額、更新訂單為已退款／取消。
 */
async function applyRefundSuccessToBooking(
  supabase: ReturnType<typeof createServerSupabase>,
  bookingId: string,
  b: BookingRefundRow,
  runUpdate: (patch: RefundSuccessPatch) => Promise<{ error: { message: string } | null }>
): Promise<{ error: string | null }> {
  let invoiceVoided = false;
  const invSt = (b.invoice_status ?? "").trim().toLowerCase();
  const invNo = (b.invoice_no ?? "").trim();
  if (invSt === "issued" && invNo) {
    try {
      const voidRes = await voidEcpayInvoice(invNo);
      if (voidRes.ok) {
        invoiceVoided = true;
      } else {
        console.error("[Refund] 綠界發票作廢失敗:", voidRes.error, "bookingId:", bookingId, "invoiceNo:", invNo);
      }
    } catch (e) {
      console.error("[Refund] 綠界發票作廢例外:", e, "bookingId:", bookingId, "invoiceNo:", invNo);
    }
  }

  await restoreClassCapacityIfPaidWithoutSlot(supabase, b);

  const patch: RefundSuccessPatch = {
    refund_status: "refunded",
    status: "cancelled",
  };
  if (invoiceVoided) {
    patch.invoice_status = "voided";
  }

  const { error } = await runUpdate(patch);
  return { error: error?.message ?? null };
}

/**
 * 後台：依付款方式執行綠界信用卡退刷或 LINE Pay 退款，成功後標記 refund_status 並取消訂單。
 */
export async function processBookingRefund(
  bookingId: string
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  try {
    await verifyAdminSession();
    const supabase = createServerSupabase();
    const access = await getAdminBookingsAccessFilter(supabase);
    if (!access) return { success: false, error: "未設定店家" };

    const { data: row, error: fetchError } = await applyAdminBookingsAccess(
      supabase.from("bookings").select(BOOKING_REFUND_SELECT).eq("id", bookingId),
      access
    ).maybeSingle();

    if (fetchError || !row) return { success: false, error: "訂單不存在或無權限操作" };

    const b = row as BookingRefundRow;
    const commonErr = validateCommonPaidRefundEligibility(b);
    if (commonErr) return { success: false, error: commonErr };

    const pm = (b.payment_method ?? "").trim().toLowerCase();
    const amount = Number(b.order_amount);

    if (pm === "ecpay") {
      const ecpayErr = validateEcpayCreditRefundFields(b);
      if (ecpayErr) return { success: false, error: ecpayErr };

      const refund = await executeEcpayRefund(
        (b.ecpay_merchant_trade_no ?? "").trim(),
        (b.ecpay_trade_no ?? "").trim(),
        amount
      );
      if (!refund.ok) {
        return { success: false, error: refund.error };
      }

      const { error: upErr } = await applyRefundSuccessToBooking(supabase, bookingId, b, async (patch) => {
        return await applyAdminBookingsAccess(
          supabase.from("bookings").update(patch).eq("id", bookingId).eq("status", "paid"),
          access
        );
      });
      if (upErr) return { success: false, error: upErr };

      return { success: true, message: "綠界退刷成功，訂單已標記為已退款並取消" };
    }

    if (pm === "linepay") {
      const lpErr = validateLinePayRefundFields(b);
      if (lpErr) return { success: false, error: lpErr };

      const credsRes = await resolveLinePayCredentialsForMerchant(supabase, b.merchant_id);
      if (!credsRes.ok) return { success: false, error: credsRes.error };

      const lpRefund = await executeLinePayRefund(
        (b.line_pay_transaction_id ?? "").trim(),
        amount,
        credsRes.creds.channelId,
        credsRes.creds.channelSecret
      );
      if (!lpRefund.ok) {
        return { success: false, error: lpRefund.error };
      }

      const { error: upErr } = await applyRefundSuccessToBooking(supabase, bookingId, b, async (patch) => {
        return await applyAdminBookingsAccess(
          supabase.from("bookings").update(patch).eq("id", bookingId).eq("status", "paid"),
          access
        );
      });
      if (upErr) return { success: false, error: upErr };

      return { success: true, message: "LINE Pay 退款成功，訂單已標記為已退款並取消" };
    }

    if (pm === "newebpay") {
      const nwErr = validateNewebpayRefundFields(b);
      if (nwErr) return { success: false, error: nwErr };

      const nwRefund = await executeNewebpayRefund({
        merchantOrderNo: (b.newebpay_merchant_order_no ?? "").trim(),
        tradeNo: (b.newebpay_trade_no ?? "").trim() || null,
        amount,
        newebpayPaymentType: b.newebpay_payment_type,
      });
      if (!nwRefund.ok) {
        return { success: false, error: nwRefund.error };
      }

      const { error: upErr } = await applyRefundSuccessToBooking(supabase, bookingId, b, async (patch) => {
        return await applyAdminBookingsAccess(
          supabase.from("bookings").update(patch).eq("id", bookingId).eq("status", "paid"),
          access
        );
      });
      if (upErr) return { success: false, error: upErr };

      return { success: true, message: "藍新退款成功，訂單已標記為已退款並取消" };
    }

    return { success: false, error: "此付款方式不支援後台自動退款（僅支援綠界信用卡、LINE Pay、藍新）" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "退款失敗";
    return { success: false, error: msg };
  }
}

/**
 * 會員中心：本人訂單之綠界／LINE Pay／藍新自動退款（條件同後台金流邏輯）。
 */
export async function processMemberBookingRefund(
  bookingId: string
): Promise<{ success: true; message?: string } | { success: false; error: string }> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    const email = await getCurrentMemberEmail();
    if (!merchantId) return { success: false, error: "未設定店家" };
    if (!email) return { success: false, error: "請先登入" };

    const supabase = createServerSupabase();
    const { data: row, error: fetchError } = await supabase
      .from("bookings")
      .select(BOOKING_REFUND_SELECT)
      .eq("id", bookingId)
      .eq("member_email", email)
      .or(bookingsVisibleToMerchantOrFilter(merchantId))
      .maybeSingle();

    if (fetchError || !row) return { success: false, error: "訂單不存在或無權限操作" };

    const b = row as BookingRefundRow;
    const commonErr = validateCommonPaidRefundEligibility(b);
    if (commonErr) return { success: false, error: commonErr };

    const pm = (b.payment_method ?? "").trim().toLowerCase();
    const amount = Number(b.order_amount);

    if (pm === "ecpay") {
      const ecpayErr = validateEcpayCreditRefundFields(b);
      if (ecpayErr) return { success: false, error: ecpayErr };

      const refund = await executeEcpayRefund(
        (b.ecpay_merchant_trade_no ?? "").trim(),
        (b.ecpay_trade_no ?? "").trim(),
        amount
      );
      if (!refund.ok) {
        return { success: false, error: refund.error };
      }

      const { error: upErr } = await applyRefundSuccessToBooking(supabase, bookingId, b, async (patch) => {
        return await supabase
          .from("bookings")
          .update(patch)
          .eq("id", bookingId)
          .eq("member_email", email)
          .or(bookingsVisibleToMerchantOrFilter(merchantId))
          .eq("status", "paid");
      });
      if (upErr) return { success: false, error: upErr };

      return { success: true, message: "退刷成功，預約已取消" };
    }

    if (pm === "linepay") {
      const lpErr = validateLinePayRefundFields(b);
      if (lpErr) return { success: false, error: lpErr };

      const credsRes = await resolveLinePayCredentialsForMerchant(supabase, b.merchant_id);
      if (!credsRes.ok) return { success: false, error: credsRes.error };

      const lpRefund = await executeLinePayRefund(
        (b.line_pay_transaction_id ?? "").trim(),
        amount,
        credsRes.creds.channelId,
        credsRes.creds.channelSecret
      );
      if (!lpRefund.ok) {
        return { success: false, error: lpRefund.error };
      }

      const { error: upErr } = await applyRefundSuccessToBooking(supabase, bookingId, b, async (patch) => {
        return await supabase
          .from("bookings")
          .update(patch)
          .eq("id", bookingId)
          .eq("member_email", email)
          .or(bookingsVisibleToMerchantOrFilter(merchantId))
          .eq("status", "paid");
      });
      if (upErr) return { success: false, error: upErr };

      return { success: true, message: "LINE Pay 退款成功，預約已取消" };
    }

    if (pm === "newebpay") {
      const nwErr = validateNewebpayRefundFields(b);
      if (nwErr) return { success: false, error: nwErr };

      const nwRefund = await executeNewebpayRefund({
        merchantOrderNo: (b.newebpay_merchant_order_no ?? "").trim(),
        tradeNo: (b.newebpay_trade_no ?? "").trim() || null,
        amount,
        newebpayPaymentType: b.newebpay_payment_type,
      });
      if (!nwRefund.ok) {
        return { success: false, error: nwRefund.error };
      }

      const { error: upErr } = await applyRefundSuccessToBooking(supabase, bookingId, b, async (patch) => {
        return await supabase
          .from("bookings")
          .update(patch)
          .eq("id", bookingId)
          .eq("member_email", email)
          .or(bookingsVisibleToMerchantOrFilter(merchantId))
          .eq("status", "paid");
      });
      if (upErr) return { success: false, error: upErr };

      return { success: true, message: "藍新退款成功，預約已取消" };
    }

    return { success: false, error: "此付款方式不支援線上自動退款，請聯絡客服" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "退款失敗";
    return { success: false, error: msg };
  }
}
