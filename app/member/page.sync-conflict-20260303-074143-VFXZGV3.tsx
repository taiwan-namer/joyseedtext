"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, User, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MEMBER_STORAGE_KEY = "member_registered";

/** 檢查是否已登入／已註冊會員（Supabase 登入或舊版 sessionStorage） */
function useIsMember() {
  const [isMember, setIsMember] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          setIsMember(true);
          return;
        }
        setIsMember(sessionStorage.getItem(MEMBER_STORAGE_KEY) === "1");
      } catch {
        if (!cancelled) setIsMember(sessionStorage.getItem(MEMBER_STORAGE_KEY) === "1");
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return isMember;
}

type OrderStatus = "PAID" | "PENDING" | "REFUNDED";

type OrderItem = {
  id: string;
  courseName: string;
  courseSlug: string; // 課程 slug，用於連結 /course/[slug]
  date: string;
  participant: string;
  amount: number;
  status: OrderStatus;
};

const MOCK_ORDERS: OrderItem[] = [
  {
    id: "A",
    courseName: "汪汪隊主題派對",
    courseSlug: "5",
    date: "2026-03-15",
    participant: "小寶",
    amount: 850,
    status: "PAID",
  },
  {
    id: "B",
    courseName: "兒童微型紙建築",
    courseSlug: "1",
    date: "2026-03-20",
    participant: "大寶",
    amount: 1200,
    status: "PENDING",
  },
  {
    id: "C",
    courseName: "幼兒塗鴉體驗",
    courseSlug: "4",
    date: "2026-02-10",
    participant: "小寶",
    amount: 600,
    status: "REFUNDED",
  },
];

// 歷史訂單（已完成／已結束的課程）
const MOCK_HISTORY_ORDERS: OrderItem[] = [
  {
    id: "H1",
    courseName: "兒童微型紙建築實驗室",
    courseSlug: "1",
    date: "2026-01-12",
    participant: "小寶",
    amount: 1200,
    status: "PAID",
  },
  {
    id: "H2",
    courseName: "親子黏土捏塑創作課",
    courseSlug: "2",
    date: "2025-12-08",
    participant: "大寶",
    amount: 880,
    status: "PAID",
  },
  {
    id: "H3",
    courseName: "汪汪隊主題派對",
    courseSlug: "5",
    date: "2025-11-20",
    participant: "小寶",
    amount: 850,
    status: "REFUNDED",
  },
];

function getStatusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case "PAID":
      return "bg-green-100 text-green-700";
    case "PENDING":
      return "bg-orange-100 text-orange-700";
    case "REFUNDED":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "PAID":
      return "已付款";
    case "PENDING":
      return "待現場繳費";
    case "REFUNDED":
      return "已退款";
    default:
      return status;
  }
}

function OrderCard({
  order,
  showRefundButton,
  onRefundClick,
}: {
  order: OrderItem;
  showRefundButton: boolean;
  onRefundClick?: () => void;
}) {
  const courseHref = `/course/${order.courseSlug}`;
  return (
    <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex gap-4 p-4">
      <div className="w-24 h-24 shrink-0 rounded-lg bg-gray-200 flex items-center justify-center">
        <span className="text-gray-400 text-xs">課程圖</span>
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-start justify-between gap-2 mb-1 min-h-[1.5rem]">
          <Link
            href={courseHref}
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
            <dt className="text-gray-500 shrink-0 w-12">日期</dt>
            <dd>{order.date}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-gray-500 shrink-0 w-12">參加者</dt>
            <dd>{order.participant}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 -mt-0.5 min-h-[1.25rem]">
            <div className="flex items-center gap-1.5">
              <dt className="text-gray-500 shrink-0 w-12">金額</dt>
              <dd className="font-medium text-gray-900">
                NT$ {order.amount.toLocaleString()}
              </dd>
            </div>
            {showRefundButton && onRefundClick && (
              <button
                type="button"
                onClick={onRefundClick}
                className="inline-flex items-center justify-center h-6 px-2.5 rounded-md border border-gray-300 text-gray-600 text-xs hover:bg-gray-50 transition-colors whitespace-nowrap shrink-0 leading-none"
              >
                申請退款/取消
              </button>
            )}
          </div>
        </dl>
      </div>
      <div className="hidden sm:flex items-center shrink-0 text-gray-300">
        <ChevronRight className="w-5 h-5" />
      </div>
    </article>
  );
}

export default function MemberDashboardPage() {
  const isMember = useIsMember();
  const [activeTab, setActiveTab] = useState<"orders" | "history">("orders");
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // 需註冊為會員才能進入，未登入顯示註冊引導
  if (isMember === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">載入中…</p>
      </div>
    );
  }
  if (!isMember) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-amber-600 hover:text-amber-700 transition-colors">
              童趣島
            </Link>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-amber-100 bg-white p-8 shadow-sm text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
              <UserPlus className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">會員專屬頁面</h1>
            <p className="text-gray-600 text-sm mb-6">
              此為會員中心，請先註冊成為會員後即可使用預約查詢、歷史訂單等功能。
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              <UserPlus className="w-5 h-5" />
              使用 Google 登入
            </Link>
            <Link
              href="/register"
              className="block mt-3 text-center text-sm text-gray-600 hover:text-amber-600 transition-colors"
            >
              或使用信箱註冊
            </Link>
            <Link
              href="/"
              className="block mt-4 text-sm text-gray-500 hover:text-amber-600 transition-colors"
            >
              返回首頁
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const openRefundModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    setRefundModalOpen(true);
  };

  const closeRefundModal = () => {
    setRefundModalOpen(false);
    setSelectedOrderId(null);
  };

  const handleConfirmRefund = () => {
    console.log("API: 執行退款");
    closeRefundModal();
  };

  const canRefund = (status: OrderStatus) =>
    status === "PAID" || status === "PENDING";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold text-amber-600 hover:text-amber-700 transition-colors"
          >
            童趣島
          </Link>
          <Link
            href="/member"
            className="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
            aria-label="會員中心"
          >
            <User size={22} />
            <span className="text-sm hidden sm:inline">會員中心</span>
          </Link>
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
          </button>
        </div>

        {/* Content */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {MOCK_ORDERS.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                showRefundButton={canRefund(order.status)}
                onRefundClick={() => openRefundModal(order.id)}
              />
            ))}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            {MOCK_HISTORY_ORDERS.map((order) => (
              <OrderCard key={order.id} order={order} showRefundButton={false} />
            ))}
          </div>
        )}
      </main>

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
              確認取消預約與退款？
            </h2>
            <p className="text-sm text-orange-600 font-medium mb-6">
              依據平台政策，開課前 24 小時內取消將酌收 50%
              手續費。確定要繼續嗎？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeRefundModal}
                className="px-4 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition-colors"
              >
                保留預約
              </button>
              <button
                type="button"
                onClick={handleConfirmRefund}
                className="px-4 py-2.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
              >
                確認取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
