"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, CheckCircle, Trash2 } from "lucide-react";
import { getAdminBookings, markBookingAsPaid, completeBooking, deleteBooking, type BookingWithClass } from "@/app/actions/bookingActions";

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

export default function AdminBookingsPage() {
  const [list, setList] = useState<BookingWithClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700" title="來自報名時選擇的場次；舊訂單或未選場次顯示為 —">課程日期</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">課程名稱</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">家長姓名</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">電話</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">購買人信箱</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">購買時間</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">狀態</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 w-36">操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-gray-900" title={!row.slot_date ? "此筆為舊訂單或未選擇場次，故無課程日期" : undefined}>
                      {formatCourseDate(row)}
                    </td>
                    <td className="py-3 px-4 text-gray-900">{row.class_title || "—"}</td>
                    <td className="py-3 px-4 text-gray-900">{row.parent_name || "—"}</td>
                    <td className="py-3 px-4 text-gray-600">{row.parent_phone || "—"}</td>
                    <td className="py-3 px-4 text-gray-900">{row.member_email}</td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(row.created_at)}</td>
                    <td className="py-3 px-4">
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
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
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
