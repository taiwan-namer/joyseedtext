"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { HeaderMember } from "@/app/components/HeaderMember";
import {
  getMyBookings,
  cancelMemberUnpaidBooking,
  type BookingWithClass,
} from "@/app/actions/bookingActions";
import { processMemberBookingRefund } from "@/app/actions/refundActions";
import MemberRescheduleModal from "@/app/member/MemberRescheduleModal";
import {
  calendarDaysFromTodayTaipeiToSlotDate,
  rescheduleWindowFromDiff,
  COPY_RESCHEDULE_INTRO,
  COPY_RESCHEDULE_BLOCKED,
  COPY_RESCHEDULE_NO_SLOT,
} from "@/lib/memberBookingPolicy";

/** 後台 status：unpaid, paid, completed, cancelled + refund_status → 顯示用 */
type DisplayStatus = "UNPAID" | "PAID" | "COMPLETED" | "REFUNDED" | "CANCELLED";

function getStatusBadgeClass(status: DisplayStatus): string {
  switch (status) {
    case "UNPAID":
      return "bg-amber-100 text-amber-700";
    case "PAID":
      return "bg-green-100 text-green-700";
    case "COMPLETED":
      return "bg-blue-100 text-blue-700";
    case "REFUNDED":
      return "bg-gray-100 text-gray-700";
    case "CANCELLED":
      return "bg-stone-100 text-stone-600";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getStatusLabel(status: DisplayStatus): string {
  switch (status) {
    case "UNPAID":
      return "未付款";
    case "PAID":
      return "已付款";
    case "COMPLETED":
      return "已完成課程";
    case "REFUNDED":
      return "已退款";
    case "CANCELLED":
      return "已取消";
    default:
      return status;
  }
}

/** 將後台訂單轉成顯示用狀態 */
function bookingToDisplayStatus(status: string, refundStatus?: string | null): DisplayStatus {
  if (status === "completed") return "COMPLETED";
  if (status === "paid") return "PAID";
  if (status === "cancelled") {
    return (refundStatus ?? "").trim().toLowerCase() === "refunded" ? "REFUNDED" : "CANCELLED";
  }
  return "UNPAID"; // unpaid, upcoming 等
}

function formatBookingDate(createdAt: string): string {
  try {
    const d = new Date(createdAt);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return createdAt.slice(0, 10) || "—";
  }
}

type OrderDisplay = {
  id: string;
  courseName: string;
  courseSlug: string;
  /** 訂單建立日 */
  orderDate: string;
  /** 上課場次（無則顯示場次未設定） */
  courseSessionLabel: string;
  participant: string;
  amount: number;
  status: DisplayStatus;
  imageUrl: string | null;
  /** 加購明細，例如「課程 800 + 珍珠奶茶 50 + 雞排 60」 */
  addonSummary: string | null;
};

function formatBookingSessionLabel(b: BookingWithClass): string {
  const d = b.slot_date?.trim();
  const t = b.slot_time?.trim();
  if (d && t) return `${d} ${t}`;
  if (d) return d;
  if (t) return t;
  return "場次未設定";
}

function OrderCard({
  order,
  showRefundButton,
  onRefundClick,
  showRescheduleButton,
  onRescheduleClick,
}: {
  order: OrderDisplay;
  showRefundButton: boolean;
  onRefundClick?: () => void;
  showRescheduleButton: boolean;
  onRescheduleClick?: () => void;
}) {
  const courseHref = `/course/${order.courseSlug}`;
  return (
    <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex gap-4 p-4">
      <div className="w-24 h-24 shrink-0 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden">
        {order.imageUrl ? (
          <img src={order.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-400 text-xs">課程圖</span>
        )}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-2 mb-1 min-h-[1.5rem]">
          <Link
            href={courseHref}
            prefetch
            className="font-semibold text-gray-900 truncate hover:text-amber-600 transition-colors min-w-0 flex-1"
          >
            {order.courseName}
          </Link>
          <span
            className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${getStatusBadgeClass(
              order.status
            )}`}
          >
            {getStatusLabel(order.status)}
          </span>
        </div>
        <dl className="text-sm text-gray-600 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <dt className="text-gray-500 shrink-0 w-20">訂購日期</dt>
            <dd>{order.orderDate}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-gray-500 shrink-0 w-20">課程場次</dt>
            <dd>{order.courseSessionLabel}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-gray-500 shrink-0 w-12">參加者</dt>
            <dd>{order.participant}</dd>
          </div>
          {order.addonSummary && (
            <div className="flex items-start gap-1.5">
              <dt className="text-gray-500 shrink-0 w-12">加購</dt>
              <dd className="text-gray-700">{order.addonSummary}</dd>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 -mt-0.5 min-h-[1.25rem]">
            <div className="flex items-center gap-1.5">
              <dt className="text-gray-500 shrink-0 w-12">金額</dt>
              <dd className="font-medium text-gray-900">
                NT$ {order.amount.toLocaleString()}
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
              {showRescheduleButton && onRescheduleClick && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRescheduleClick();
                  }}
                  className="inline-flex items-center justify-center h-6 px-2.5 rounded-md border border-amber-500/80 text-amber-800 text-xs hover:bg-amber-50 transition-colors whitespace-nowrap leading-none"
                >
                  改期
                </button>
              )}
              {showRefundButton && onRefundClick && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRefundClick();
                  }}
                  className="inline-flex items-center justify-center h-6 px-2.5 rounded-md border border-gray-300 text-gray-600 text-xs hover:bg-gray-50 transition-colors whitespace-nowrap leading-none"
                >
                  申請退款/取消
                </button>
              )}
            </div>
          </div>
        </dl>
      </div>
      <div className="hidden sm:flex items-center shrink-0 text-gray-300">
        <ChevronRight className="w-5 h-5" />
      </div>
    </article>
  );
}

function buildAddonSummary(b: BookingWithClass): string | null {
  const total = b.class_price ?? 0;
  const indices = b.addon_indices;
  const addonPrices = b.class_addon_prices;
  if (!indices?.length || !addonPrices?.length) return null;
  let addonTotal = 0;
  const parts: string[] = [];
  for (const i of indices) {
    const addon = addonPrices[i];
    if (addon) {
      addonTotal += addon.price;
      parts.push(`${addon.name} ${addon.price}`);
    }
  }
  if (parts.length === 0) return null;
  const base = Math.max(0, total - addonTotal);
  return `課程 ${base.toLocaleString()} + ${parts.join(" + ")}`;
}

function mapBookingToOrder(b: BookingWithClass): OrderDisplay {
  return {
    id: b.id,
    courseName: b.class_title ?? "未命名課程",
    courseSlug: b.class_id,
    orderDate: formatBookingDate(b.created_at),
    courseSessionLabel: formatBookingSessionLabel(b),
    participant: b.parent_name?.trim() || "—",
    amount: b.class_price ?? 0,
    status: bookingToDisplayStatus(b.status, b.refund_status),
    imageUrl: b.class_image_url ?? null,
    addonSummary: buildAddonSummary(b),
  };
}

export type MemberDashboardClientProps = {
  siteName: string;
  initialBookings: BookingWithClass[];
  initialLoadError: string | null;
  initialMemberName: string | null;
};

export default function MemberDashboardClient({
  siteName,
  initialBookings,
  initialLoadError,
  initialMemberName,
}: MemberDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<"orders" | "history">("orders");
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [rescheduleGate, setRescheduleGate] = useState<
    null | { bookingId: string; variant: "intro" | "blocked" | "no_slot" }
  >(null);
  const [bookings, setBookings] = useState<BookingWithClass[]>(initialBookings);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(initialLoadError);
  const memberName = initialMemberName;

  /** 顯示用：後台名字的後兩字 + 你好，例如 羅錦諺 → 錦諺 你好 */
  const greetingText = memberName
    ? (memberName.length >= 2 ? memberName.slice(-2) : memberName) + " 你好"
    : "你好";

  const ordersDisplay = bookings.map(mapBookingToOrder);
  /** 我的預約：未付款 + 已付款 */
  const upcomingOrders = ordersDisplay.filter((o) => o.status === "UNPAID" || o.status === "PAID");
  /** 歷史訂單：已完成課程、已退款、已取消（未付款取消等） */
  const historyOrders = ordersDisplay.filter(
    (o) => o.status === "COMPLETED" || o.status === "REFUNDED" || o.status === "CANCELLED"
  );

  const openRefundModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    setRefundModalOpen(true);
  };

  const closeRefundModal = () => {
    setRefundModalOpen(false);
    setSelectedOrderId(null);
  };

  const openRescheduleFlow = (orderId: string) => {
    const b = bookings.find((x) => x.id === orderId);
    if (!b) return;
    const slotYmd =
      b.slot_date != null && String(b.slot_date).trim() !== ""
        ? String(b.slot_date).replace(/T.*$/, "").slice(0, 10)
        : null;
    const diff = calendarDaysFromTodayTaipeiToSlotDate(slotYmd);
    const rw = rescheduleWindowFromDiff(diff);
    if (rw === "blocked") {
      setRescheduleGate({ bookingId: orderId, variant: "blocked" });
      return;
    }
    if (rw === "no_slot_date") {
      setRescheduleGate({ bookingId: orderId, variant: "no_slot" });
      return;
    }
    setRescheduleGate({ bookingId: orderId, variant: "intro" });
  };

  const closeRescheduleGate = () => setRescheduleGate(null);

  const confirmRescheduleIntro = () => {
    if (!rescheduleGate || rescheduleGate.variant !== "intro") return;
    const id = rescheduleGate.bookingId;
    setRescheduleGate(null);
    setRescheduleBookingId(id);
  };

  const refreshBookings = async () => {
    setLoading(true);
    setLoadError(null);
    const refreshed = await getMyBookings();
    setLoading(false);
    if (refreshed.success) setBookings(refreshed.data);
    else setLoadError(refreshed.error);
  };

  const selectedBooking =
    selectedOrderId != null ? bookings.find((b) => b.id === selectedOrderId) ?? null : null;

  const handleConfirmRefund = async () => {
    if (!selectedOrderId || !selectedBooking) {
      closeRefundModal();
      return;
    }
    const st = selectedBooking.status;
    const pm = selectedBooking.payment_method;

    setRefundSubmitting(true);
    try {
      if (st === "unpaid" || st === "upcoming") {
        const res = await cancelMemberUnpaidBooking(selectedOrderId);
        if (!res.success) {
          alert(res.error);
          return;
        }
        alert(res.message ?? "已取消預約");
      } else if (st === "paid") {
        if (pm === "ecpay" || pm === "linepay" || pm === "newebpay") {
          const res = await processMemberBookingRefund(selectedOrderId);
          if (!res.success) {
            alert(res.error);
            return;
          }
          alert(res.message ?? "退款成功");
        } else {
          alert(
            "此訂單付款方式不支援線上自動退款，請透過 LINE 官方帳號或客服辦理。"
          );
          return;
        }
      } else {
        alert("此訂單狀態無法由此操作。");
        return;
      }

      await refreshBookings();
      closeRefundModal();
    } finally {
      setRefundSubmitting(false);
    }
  };

  const canRefund = (status: DisplayStatus) =>
    status === "UNPAID" || status === "PAID";
  const canReschedule = (status: DisplayStatus) => status === "UNPAID" || status === "PAID";

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <Link
            href="/"
            prefetch
            className="text-xl font-bold text-brand hover:opacity-90 transition-colors shrink-0"
          >
            {siteName}
          </Link>
          <span className="text-gray-700 font-medium truncate" aria-label="會員問候">
            {greetingText}
          </span>
          <HeaderMember />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-8 border-b border-gray-200 mb-8">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`pb-4 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "orders"
                ? "border-orange-500 text-gray-900 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            我的預約
            {upcomingOrders.length > 0 && (
              <span className="ml-1.5 text-xs opacity-90">({upcomingOrders.length})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`pb-4 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "history"
                ? "border-orange-500 text-gray-900 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            歷史訂單
            {historyOrders.length > 0 && (
              <span className="ml-1.5 text-xs opacity-90">({historyOrders.length})</span>
            )}
          </button>
        </div>

        {/* Content：我的預約 = 未付款 + 已付款，歷史訂單 = 已完成課程 + 已退款 */}
        {loading && (
          <p className="text-gray-500 py-8 text-center">載入訂單中…</p>
        )}
        {!loading && loadError && (
          <p className="text-amber-600 py-8 text-center">{loadError}</p>
        )}
        {!loading && !loadError && activeTab === "orders" && (
          <div className="space-y-4">
            {upcomingOrders.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">目前沒有預約中的訂單</p>
            ) : (
              upcomingOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  showRefundButton={canRefund(order.status)}
                  onRefundClick={() => openRefundModal(order.id)}
                  showRescheduleButton={canReschedule(order.status)}
                  onRescheduleClick={() => openRescheduleFlow(order.id)}
                />
              ))
            )}
          </div>
        )}

        {!loading && !loadError && activeTab === "history" && (
          <div className="space-y-4">
            {historyOrders.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">尚無歷史訂單</p>
            ) : (
              historyOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  showRefundButton={false}
                  showRescheduleButton={false}
                />
              ))
            )}
          </div>
        )}
      </main>

      {rescheduleGate && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeRescheduleGate} aria-hidden />
          <div
            className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reschedule-gate-title"
          >
            <h2 id="reschedule-gate-title" className="text-lg font-bold text-gray-900">
              改期
            </h2>
            {rescheduleGate.variant === "intro" ? (
              <>
                <p className="mt-3 text-sm font-medium text-gray-800">{COPY_RESCHEDULE_INTRO}</p>
                <p className="mt-2 text-sm text-gray-600">
                  按下「繼續改期」後，將開啟可選場次；若無其他場次可選，畫面會另行提示。
                </p>
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeRescheduleGate}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    返回
                  </button>
                  <button
                    type="button"
                    onClick={confirmRescheduleIntro}
                    className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:opacity-95"
                  >
                    繼續改期
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-gray-700">
                  {rescheduleGate.variant === "blocked"
                    ? COPY_RESCHEDULE_BLOCKED
                    : COPY_RESCHEDULE_NO_SLOT}
                </p>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={closeRescheduleGate}
                    className="rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-300"
                  >
                    我知道了
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <MemberRescheduleModal
        bookingId={rescheduleBookingId}
        open={rescheduleBookingId !== null}
        onClose={() => setRescheduleBookingId(null)}
        onSuccess={() => void refreshBookings()}
      />

      {/* Refund Modal */}
      {refundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeRefundModal}
            aria-hidden
          />
          <div
            className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            role="dialog"
            aria-labelledby="refund-modal-title"
            aria-modal="true"
          >
            <h2
              id="refund-modal-title"
              className="text-lg font-bold text-gray-900 mb-4"
            >
              {selectedBooking?.status === "paid"
                ? selectedBooking.payment_method === "ecpay" ||
                    selectedBooking.payment_method === "linepay" ||
                    selectedBooking.payment_method === "newebpay"
                  ? "確認取消預約與退款？"
                  : "確認申請退款？"
                : "確認取消預約？"}
            </h2>
            <p className="text-sm text-orange-600 font-medium mb-6">
              {selectedBooking?.status === "paid" ? (
                selectedBooking.payment_method === "ecpay" ? (
                  <>
                    綠界信用卡將嘗試自動退刷；依據平台政策，開課前 24 小時內取消可能酌收手續費。確定要繼續嗎？
                  </>
                ) : selectedBooking.payment_method === "linepay" ? (
                  <>
                    將向 LINE Pay 申請退款；依據平台政策，開課前 24 小時內取消可能酌收手續費。確定要繼續嗎？
                  </>
                ) : selectedBooking.payment_method === "newebpay" ? (
                  <>
                    將向藍新申請退款（信用卡／ATM 等依藍新規則處理）；依據平台政策，開課前 24
                    小時內取消可能酌收手續費。確定要繼續嗎？
                  </>
                ) : (
                  <>
                    此訂單不支援線上自動退款，按下確認後將提示您聯絡客服，訂單狀態不會自動變更。
                  </>
                )
              ) : (
                <>取消後此筆未付款預約將關閉。確定要繼續嗎？</>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={refundSubmitting}
                onClick={closeRefundModal}
                className="px-4 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                保留預約
              </button>
              <button
                type="button"
                disabled={refundSubmitting}
                onClick={() => void handleConfirmRefund()}
                className="px-4 py-2.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
              >
                {refundSubmitting ? "處理中…" : "確認取消"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
