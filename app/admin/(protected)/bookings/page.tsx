"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, CheckCircle, Trash2, Filter, CheckCheck, Banknote } from "lucide-react";
import { getAdminBookings, markBookingAsPaid, completeBooking, deleteBooking, batchMarkBookingsAsPaid, batchCompleteBookings, type BookingWithClass } from "@/app/actions/bookingActions";

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
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterCourseId, setFilterCourseId] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [batchPaidLoading, setBatchPaidLoading] = useState(false);
  const [batchCompleteLoading, setBatchCompleteLoading] = useState(false);

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

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    const res = await getAdminBookings();
    if (res.success) setList(res.data);
    else setError(res.error);
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
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 font-medium text-gray-700 w-24">訂單編號</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-700 w-36">課程日期</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-700 min-w-[100px]">課程名稱</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-700 w-24">家長姓名</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-700 w-28">電話</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-700 min-w-[140px]">購買人信箱</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-700 w-20">金額</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-700 w-32">購買時間</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-700 w-24">狀態</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-700 w-36">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors py-1"
                  >
                    <td className="py-2.5 px-3 text-gray-600 font-mono text-xs truncate" title={row.id}>
                      {row.id.slice(0, 8)}…
                    </td>
                    <td className="py-2.5 px-3 text-gray-700 text-xs" title={!row.slot_date ? "此筆為舊訂單或未選擇場次，故無課程日期" : undefined}>
                      {formatCourseDate(row)}
                    </td>
                    <td className="py-2.5 px-3 text-gray-900 truncate">{row.class_title || "—"}</td>
                    <td className="py-2.5 px-3 text-gray-900 truncate">{row.parent_name || "—"}</td>
                    <td className="py-2.5 px-3 text-gray-600 truncate">{row.parent_phone || "—"}</td>
                    <td className="py-2.5 px-3 text-gray-900 truncate" title={row.member_email}>{row.member_email}</td>
                    <td className="py-2.5 px-3 text-right text-gray-900 font-medium whitespace-nowrap">
                      {row.class_price != null ? `NT$ ${row.class_price.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 text-xs whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="py-2.5 px-3">
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
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(row.status === "unpaid" || row.status === "upcoming") && (row.payment_method === "atm" || !row.payment_method) && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsPaid(row.id)}
                            disabled={markingPaidId === row.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-medium hover:bg-sky-600 disabled:opacity-60 transition-colors"
                          >
                            {markingPaidId === row.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            已付款
                          </button>
                        )}
                        {row.status === "paid" && (
                          <button
                            type="button"
                            onClick={() => handleComplete(row.id)}
                            disabled={completingId === row.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 disabled:opacity-60 transition-colors"
                          >
                            {completingId === row.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            完成課程
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 transition-colors"
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
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
