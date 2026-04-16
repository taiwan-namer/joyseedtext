"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  CheckCircle,
  Trash2,
  Filter,
  CheckCheck,
  Banknote,
  RotateCcw,
  CalendarClock,
} from "lucide-react";
import {
  getAdminBookings,
  markBookingAsPaid,
  completeBooking,
  deleteBooking,
  batchMarkBookingsAsPaid,
  batchCompleteBookings,
  type BookingWithClass,
} from "@/app/actions/bookingActions";
import { processBookingRefund } from "@/app/actions/refundActions";
import AdminRescheduleModal from "@/app/admin/(protected)/bookings/AdminRescheduleModal";
import { MARKETPLACE_MERCHANT_ID } from "@/lib/constants";
import { classifyPurchaseChannelForBranchAdmin } from "@/lib/purchaseChannelForBranch";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusLabel(s: string) {
  switch (s) {
    case "unpaid":
    case "upcoming":
      return "未付款";
    case "paid":
      return "已付款";
    case "completed":
      return "完成課程";
    case "cancelled":
      return "已取消";
    default:
      return s;
  }
}

/**
 * 結帳來源：與「對帳明細」相同規則（{@link classifyPurchaseChannelForBranchAdmin}）。
 * 含 sold_via 未填時依庫存 merchant_id 是否為本站推斷，故與僅比對 sold===model 時可能不同。
 */
function checkoutSourceCell(row: BookingWithClass, branchMerchantId: string): { text: string; title: string } {
  const sold = row.sold_via_merchant_id?.trim();
  const inv = row.merchant_id?.trim();
  const channel = classifyPurchaseChannelForBranchAdmin(branchMerchantId, {
    sold_via_merchant_id: row.sold_via_merchant_id ?? null,
    merchant_id: row.merchant_id ?? null,
  });
  const text = channel === "hq" ? "總站" : "本站";
  const title = [
    `與對帳明細相同：sold===「${MARKETPLACE_MERCHANT_ID}」→總站；sold===本站ID→本站；sold未填→依庫存merchant_id是否為本站`,
    `庫存歸屬 merchant_id：${inv ?? "—"}`,
    `結帳站 sold_via_merchant_id：${sold ?? "（未填）"}`,
    `開課快照 class_creator_merchant_id：${row.class_creator_merchant_id?.trim() ?? "—"}`,
    `本分站 NEXT_PUBLIC_CLIENT_ID：${branchMerchantId || "（未設定）"}`,
  ].join("\n");
  return { text, title };
}

function formatCourseDate(row: BookingWithClass) {
  const datePart = row.slot_date?.trim?.() || row.slot_date;
  if (!datePart) return "—";
  const timePart = (row.slot_time != null ? String(row.slot_time).slice(0, 5) : null) || "00:00";
  try {
    const iso = timePart.length === 5 ? `${datePart}T${timePart}:00` : `${datePart}T00:00:00`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return `${datePart} ${timePart}`;
    return d.toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return timePart ? `${datePart} ${timePart}` : datePart;
  }
}

const STATUS_OPTIONS = [
  { value: "", label: "全部狀態" },
  { value: "unpaid", label: "未付款" },
  { value: "paid", label: "已付款" },
  { value: "completed", label: "完成課程" },
  { value: "cancelled", label: "已取消" },
] as const;

export default function AdminBookingsPage() {
  const [list, setList] = useState<BookingWithClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterCourseId, setFilterCourseId] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [batchPaidLoading, setBatchPaidLoading] = useState(false);
  const [batchCompleteLoading, setBatchCompleteLoading] = useState(false);

  /** 與對帳明細相同：用於判斷 sold 未填時「總站／本站」 */
  const branchMerchantId = (process.env.NEXT_PUBLIC_CLIENT_ID ?? "").trim();

  const filteredList = list.filter((row) => {
    if (filterStatus && row.status !== filterStatus) return false;
    if (filterCourseId && row.class_id !== filterCourseId) return false;
    if (filterStartDate) {
      const rowDate = row.created_at.slice(0, 10);
      if (rowDate < filterStartDate) return false;
    }
    if (filterEndDate) {
      const rowDate = row.created_at.slice(0, 10);
      if (rowDate > filterEndDate) return false;
    }
    return true;
  });

  const idsForBatchPaid = filteredList
    .filter((r) => (r.status === "unpaid" || r.status === "upcoming") && (r.payment_method === "atm" || !r.payment_method))
    .map((r) => r.id);
  const idsForBatchComplete = filteredList.filter((r) => r.status === "paid").map((r) => r.id);

  /** 已入庫、ATM／未註記付款方式之未付款訂單（非線上金流 pending_payments） */
  const atmUnpaidBookings = useMemo(
    () =>
      list.filter(
        (r) =>
          (r.status === "unpaid" || r.status === "upcoming") &&
          (r.payment_method === "atm" || !r.payment_method)
      ),
    [list]
  );

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    const bookingsRes = await getAdminBookings();
    if (bookingsRes.success) setList(bookingsRes.data);
    else setError(bookingsRes.error);
    setLoading(false);
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleMarkAsPaid = async (bookingId: string) => {
    setMarkingPaidId(bookingId);
    const res = await markBookingAsPaid(bookingId);
    setMarkingPaidId(null);
    if (res.success) {
      setList((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "paid" } : b))
      );
    } else {
      alert(res.error);
    }
  };

  const handleComplete = async (bookingId: string) => {
    setCompletingId(bookingId);
    const res = await completeBooking(bookingId);
    setCompletingId(null);
    if (res.success) {
      setList((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "completed" } : b))
      );
    } else {
      alert(res.error);
    }
  };

  const handleDelete = async (bookingId: string) => {
    if (!confirm("確定要刪除此筆訂單嗎？刪除後將無法復原。")) return;
    setDeletingId(bookingId);
    const res = await deleteBooking(bookingId);
    setDeletingId(null);
    if (res.success) {
      setList((prev) => prev.filter((b) => b.id !== bookingId));
    } else {
      alert(res.error);
    }
  };

  const handleOnlineRefund = async (bookingId: string, paymentMethod: string) => {
    const pm = paymentMethod.toLowerCase();
    const msg =
      pm === "linepay"
        ? "確定要對此筆訂單執行 LINE Pay 退款？成功後訂單將標記為已退款並取消，且無場次時會回補課程名額。"
        : pm === "newebpay"
          ? "確定要對此筆訂單執行藍新退款？成功後訂單將標記為已退款並取消，且無場次時會回補課程名額。"
          : "確定要對此筆訂單執行綠界信用卡退刷？成功後訂單將標記為已退款並取消，且無場次時會回補課程名額。";
    if (!confirm(msg)) return;
    setRefundingId(bookingId);
    const res = await processBookingRefund(bookingId);
    setRefundingId(null);
    if (res.success) {
      setList((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: "cancelled", refund_status: "refunded" }
            : b
        )
      );
      alert(res.message ?? "退款成功");
    } else {
      alert(res.error);
    }
  };

  const handleBatchPaid = async () => {
    if (idsForBatchPaid.length === 0) {
      alert("目前篩選結果中沒有可標記為已付款的訂單（需為未付款且 ATM）。");
      return;
    }
    if (!confirm(`確定要將篩選結果中的 ${idsForBatchPaid.length} 筆訂單一鍵標記為已付款？`)) return;
    setBatchPaidLoading(true);
    const res = await batchMarkBookingsAsPaid(idsForBatchPaid);
    setBatchPaidLoading(false);
    if (res.success) {
      setList((prev) =>
        prev.map((b) =>
          idsForBatchPaid.includes(b.id) ? { ...b, status: "paid" } : b
        )
      );
      alert(res.message ?? `已更新 ${res.updated} 筆`);
    } else {
      alert(res.error);
    }
  };

  const handleBatchComplete = async () => {
    if (idsForBatchComplete.length === 0) {
      alert("目前篩選結果中沒有可標記為完成課程的訂單（需為已付款）。");
      return;
    }
    if (!confirm(`確定要將篩選結果中的 ${idsForBatchComplete.length} 筆訂單一鍵標記為完成課程？`)) return;
    setBatchCompleteLoading(true);
    const res = await batchCompleteBookings(idsForBatchComplete);
    setBatchCompleteLoading(false);
    if (res.success) {
      setList((prev) =>
        prev.map((b) =>
          idsForBatchComplete.includes(b.id) ? { ...b, status: "completed" } : b
        )
      );
      alert(res.message ?? `已更新 ${res.updated} 筆`);
    } else {
      alert(res.error);
    }
  };

  const courseOptions = Array.from(
    new Map(list.map((b) => [b.class_id, b.class_title || "—"])).entries()
  ).map(([id, title]) => ({ id, title }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" />
          返回後台
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900">訂單管理</h1>

      {atmUnpaidBookings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-amber-900">ATM 待確認入帳</h2>
            <p className="text-xs text-amber-800/90 mt-1">
              以下為 ATM 轉帳之未付款訂單；確認入帳後請按「標記已付款」，或使用下方「一鍵已付款」。
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-amber-200/80 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-amber-100/50 border-b border-amber-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-800">建立時間</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-800">訂單編號</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-800">課程</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-800">信箱</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-800">金額</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-800 w-32">操作</th>
                </tr>
              </thead>
              <tbody>
                {atmUnpaidBookings.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-gray-600 text-xs whitespace-nowrap">{formatDate(p.created_at)}</td>
                    <td className="py-2 px-3 text-gray-600 font-mono text-xs truncate align-middle" title={p.id}>
                      {p.id.slice(0, 8)}…
                    </td>
                    <td className="py-2 px-3 text-gray-900 truncate max-w-[200px]" title={p.class_title ?? p.class_id}>
                      {p.class_title || "—"}
                    </td>
                    <td className="py-2 px-3 text-gray-700 truncate max-w-[180px]" title={p.member_email}>
                      {p.member_email}
                    </td>
                    <td className="py-2 px-3 text-left font-medium tabular-nums">
                      {p.class_price != null ? `NT$ ${p.class_price.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => handleMarkAsPaid(p.id)}
                        disabled={markingPaidId === p.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-60"
                      >
                        {markingPaidId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        標記已付款
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="text-sm font-medium text-gray-700 shrink-0">篩選</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[100px]"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-w-[120px]"
          >
            <option value="">全部課程</option>
            {courseOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.title}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <label htmlFor="bookings_start" className="text-sm text-gray-600 whitespace-nowrap">開始日期</label>
            <input
              id="bookings_start"
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="bookings_end" className="text-sm text-gray-600 whitespace-nowrap">結束日期</label>
            <input
              id="bookings_end"
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <span className="text-sm text-gray-500 ml-auto">
            顯示 {filteredList.length} / {list.length} 筆
          </span>
        </div>
        {/* 一鍵按鈕：不論篩選與否都顯示，操作對象為「目前篩選結果」 */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <span className="text-sm font-medium text-gray-700">批次操作</span>
          <button
            type="button"
            onClick={handleBatchPaid}
            disabled={batchPaidLoading || idsForBatchPaid.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {batchPaidLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
            一鍵已付款
            {idsForBatchPaid.length > 0 && (
              <span className="opacity-90">({idsForBatchPaid.length})</span>
            )}
          </button>
          <button
            type="button"
            onClick={handleBatchComplete}
            disabled={batchCompleteLoading || idsForBatchComplete.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {batchCompleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            一鍵完成課程
            {idsForBatchComplete.length > 0 && (
              <span className="opacity-90">({idsForBatchComplete.length})</span>
            )}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : error ? (
            <p className="py-8 px-4 text-red-600 text-sm">{error}</p>
          ) : list.length === 0 ? (
            <p className="py-8 px-4 text-gray-500 text-sm">尚無訂單</p>
          ) : filteredList.length === 0 ? (
            <p className="py-8 px-4 text-gray-500 text-sm">篩選後無符合的訂單</p>
          ) : (
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700 w-24">訂單編號</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700 w-36">課程日期</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700 min-w-[100px]">課程名稱</th>
                  <th
                    className="text-left py-2 px-3 font-medium text-gray-700 w-[7.5rem]"
                    title="與對帳明細相同：sold 為 model→總站；sold 為本站 ID→本站；sold 未填則依庫存 merchant_id 推斷"
                  >
                    結帳來源
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700 w-24">家長姓名</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700 w-28">電話</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700 min-w-[140px]">購買人信箱</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700 w-24">金額</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700 w-32">購買時間</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700 w-24">狀態</th>
                  <th className="text-left py-2 pl-3 pr-2 font-medium text-gray-700 min-w-[20rem]">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((row) => {
                  const src = checkoutSourceCell(row, branchMerchantId);
                  return (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-2 px-3 text-gray-600 font-mono text-xs truncate align-middle" title={row.id}>
                      {row.id.slice(0, 8)}…
                    </td>
                    <td className="py-2 px-3 text-gray-700 text-xs align-middle" title={!row.slot_date ? "此筆為舊訂單或未選擇場次，故無課程日期" : undefined}>
                      {formatCourseDate(row)}
                    </td>
                    <td className="py-2 px-3 text-gray-900 truncate align-middle">{row.class_title || "—"}</td>
                    <td
                      className="py-2 px-3 text-gray-700 font-mono text-xs truncate max-w-[8rem] align-middle"
                      title={src.title}
                    >
                      {src.text}
                    </td>
                    <td className="py-2 px-3 text-gray-900 truncate align-middle">{row.parent_name || "—"}</td>
                    <td className="py-2 px-3 text-gray-600 truncate align-middle">{row.parent_phone || "—"}</td>
                    <td className="py-2 px-3 text-gray-900 truncate align-middle" title={row.member_email}>{row.member_email}</td>
                    <td className="py-2 px-3 text-left text-gray-900 font-medium whitespace-nowrap align-middle tabular-nums">
                      {row.class_price != null ? `NT$ ${row.class_price.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2 px-3 text-gray-600 text-xs whitespace-nowrap align-middle">{formatDate(row.created_at)}</td>
                    <td className="py-2 px-3 align-middle">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          row.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : row.status === "paid"
                              ? "bg-sky-100 text-sky-800"
                              : row.status === "cancelled"
                                ? "bg-gray-100 text-gray-600"
                                : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="py-2 pl-3 pr-2 align-middle">
                      <div className="flex w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300">
                        {(row.status === "unpaid" || row.status === "upcoming") && (row.payment_method === "atm" || !row.payment_method) && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsPaid(row.id)}
                            disabled={markingPaidId === row.id}
                            className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-md bg-sky-500 text-white text-xs font-medium hover:bg-sky-600 disabled:opacity-60 transition-colors"
                          >
                            {markingPaidId === row.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            已付款
                          </button>
                        )}
                        {(row.status === "unpaid" || row.status === "upcoming" || row.status === "paid") && (
                          <button
                            type="button"
                            onClick={() => setRescheduleBookingId(row.id)}
                            className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-md border border-amber-600/80 text-amber-900 text-xs font-medium hover:bg-amber-50 transition-colors"
                            title="改至同課程其他場次"
                          >
                            <CalendarClock className="w-3.5 h-3.5" />
                            課程改期
                          </button>
                        )}
                        {row.status === "paid" && (
                          <button
                            type="button"
                            onClick={() => handleComplete(row.id)}
                            disabled={completingId === row.id}
                            className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-md bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 disabled:opacity-60 transition-colors"
                          >
                            {completingId === row.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            完成課程
                          </button>
                        )}
                        {row.status === "paid" &&
                          (row.payment_method === "ecpay" ||
                            row.payment_method === "linepay" ||
                            row.payment_method === "newebpay") &&
                          (row.refund_status ?? "").trim().toLowerCase() !== "refunded" && (
                            <button
                              type="button"
                              onClick={() => handleOnlineRefund(row.id, row.payment_method)}
                              disabled={refundingId === row.id}
                              title={
                                row.payment_method === "linepay"
                                  ? "LINE Pay 退款（需有 line_pay_transaction_id 與店家 linePayApi）"
                                  : row.payment_method === "newebpay"
                                    ? "藍新退款（需有 newebpay_merchant_order_no；建議一併有 newebpay_trade_no 以利電子錢包備援）"
                                    : "綠界信用卡退刷（需有交易編號與 PaymentType）"
                              }
                              className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-md bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-60 transition-colors"
                            >
                              {refundingId === row.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5" />
                              )}
                              {row.payment_method === "linepay"
                                ? "LINE 退款"
                                : row.payment_method === "newebpay"
                                  ? "藍新退款"
                                  : "綠界退刷"}
                            </button>
                          )}
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          className="inline-flex shrink-0 items-center justify-center h-8 w-8 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 transition-colors"
                          title="刪除訂單"
                          aria-label="刪除訂單"
                        >
                          {deletingId === row.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <AdminRescheduleModal
        bookingId={rescheduleBookingId}
        open={rescheduleBookingId !== null}
        onClose={() => setRescheduleBookingId(null)}
        onSuccess={() => void fetchList()}
      />
    </div>
  );
}
