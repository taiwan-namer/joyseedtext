"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import { getCurrentMemberEmail } from "@/app/actions/bookingActions";
import { executeEcpayRefund } from "@/lib/ecpay/refundDoAction";
import {
  bookingsVisibleToMerchantOrFilter,
  getAdminBookingsAccessFilter,
  type AdminBookingsAccessFilter,
} from "@/lib/bookingsMerchantFilter";

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
  ecpay_merchant_trade_no: string | null;
  ecpay_trade_no: string | null;
  ecpay_payment_type: string | null;
  order_amount: number | null;
  refund_status: string | null;
};

function validatePaidEcpayCreditRefund(b: BookingRefundRow): string | null {
  if ((b.refund_status ?? "").trim().toLowerCase() === "refunded") {
    return "此訂單已標記為已退款";
  }
  if (b.status !== "paid") {
    return "僅限已付款（paid）訂單可退刷";
  }
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
  const amount =
    b.order_amount != null && Number.isFinite(Number(b.order_amount)) && Number(b.order_amount) > 0
      ? Number(b.order_amount)
      : null;
  if (amount == null) {
    return "訂單金額（order_amount）無效，無法退刷";
  }
  return null;
}

/** 無場次時付款曾扣 classes.capacity，取消／退刷後回補 +1（與 deleteBooking 一致） */
async function restoreClassCapacityIfPaidWithoutSlot(
  supabase: ReturnType<typeof createServerSupabase>,
  b: BookingRefundRow
): Promise<void> {
  const hadSlot = b.slot_date != null && b.slot_time != null;
  const classId = b.class_id;
  const ownerMerchantId = String(b.merchant_id ?? "");
  if (hadSlot || !classId || !ownerMerchantId) return;

  const { data: cls } = await supabase
    .from("classes")
    .select("capacity")
    .eq("id", classId)
    .eq("merchant_id", ownerMerchantId)
    .single();
  const current = (cls as { capacity?: number } | null)?.capacity ?? 0;
  await supabase
    .from("classes")
    .update({ capacity: Math.max(0, current + 1) })
    .eq("id", classId)
    .eq("merchant_id", ownerMerchantId);
}

/**
 * 後台：綠界信用卡自動退刷（DoAction R），成功後標記 refund_status 並取消訂單。
 * 權限與訂單列表相同（verifyAdminSession + 多租戶／開課者範圍）。
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
      supabase
        .from("bookings")
        .select(
          "id, status, merchant_id, class_id, slot_date, slot_time, ecpay_merchant_trade_no, ecpay_trade_no, ecpay_payment_type, order_amount, refund_status"
        )
        .eq("id", bookingId),
      access
    ).maybeSingle();

    if (fetchError || !row) return { success: false, error: "訂單不存在或無權限操作" };

    const b = row as BookingRefundRow;
    const validationError = validatePaidEcpayCreditRefund(b);
    if (validationError) return { success: false, error: validationError };

    const amount = Number(b.order_amount);

    const refund = await executeEcpayRefund(
      (b.ecpay_merchant_trade_no ?? "").trim(),
      (b.ecpay_trade_no ?? "").trim(),
      amount
    );
    if (!refund.ok) {
      return { success: false, error: refund.error };
    }

    await restoreClassCapacityIfPaidWithoutSlot(supabase, b);

    const { error: upErr } = await applyAdminBookingsAccess(
      supabase
        .from("bookings")
        .update({
          refund_status: "refunded",
          status: "cancelled",
        })
        .eq("id", bookingId)
        .eq("status", "paid"),
      access
    );

    if (upErr) return { success: false, error: upErr.message };

    return { success: true, message: "退刷成功，訂單已標記為已退款並取消" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "退刷失敗";
    return { success: false, error: msg };
  }
}

/**
 * 會員中心：本人訂單之綠界信用卡退刷（條件同後台退刷）。
 * 以登入信箱 + 本站可見範圍（merchant_id / sold_via）驗證。
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
      .select(
        "id, status, merchant_id, class_id, slot_date, slot_time, ecpay_merchant_trade_no, ecpay_trade_no, ecpay_payment_type, order_amount, refund_status"
      )
      .eq("id", bookingId)
      .eq("member_email", email)
      .or(bookingsVisibleToMerchantOrFilter(merchantId))
      .maybeSingle();

    if (fetchError || !row) return { success: false, error: "訂單不存在或無權限操作" };

    const b = row as BookingRefundRow;
    const validationError = validatePaidEcpayCreditRefund(b);
    if (validationError) return { success: false, error: validationError };

    const amount = Number(b.order_amount);

    const refund = await executeEcpayRefund(
      (b.ecpay_merchant_trade_no ?? "").trim(),
      (b.ecpay_trade_no ?? "").trim(),
      amount
    );
    if (!refund.ok) {
      return { success: false, error: refund.error };
    }

    await restoreClassCapacityIfPaidWithoutSlot(supabase, b);

    const { error: upErr } = await supabase
      .from("bookings")
      .update({
        refund_status: "refunded",
        status: "cancelled",
      })
      .eq("id", bookingId)
      .eq("member_email", email)
      .or(bookingsVisibleToMerchantOrFilter(merchantId))
      .eq("status", "paid");

    if (upErr) return { success: false, error: upErr.message };

    return { success: true, message: "退刷成功，預約已取消" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "退刷失敗";
    return { success: false, error: msg };
  }
}
