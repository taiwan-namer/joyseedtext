"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { getBookingsByMemberEmailForAdmin, type BookingWithClass } from "@/app/actions/bookingActions";

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

export function MemberBookingLink({ email, count }: { email: string | null; count: number }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<BookingWithClass[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    if (!email || count === 0) return;
    setOpen(true);
    if (list === null && !loading) {
      setLoading(true);
      setError(null);
      getBookingsByMemberEmailForAdmin(email)
        .then((res) => {
          if (res.success) setList(res.data);
          else setError(res.error);
        })
        .finally(() => setLoading(false));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`text-sm font-medium ${count > 0 ? "text-amber-600 hover:text-amber-700 underline" : "text-gray-500 cursor-default"}`}
        disabled={count === 0}
      >
        {count}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="member-bookings-title">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 id="member-bookings-title" className="text-lg font-semibold text-gray-900">購買紀錄</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="關閉"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {loading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              )}
              {error && <p className="text-red-600 text-sm py-4">{error}</p>}
              {!loading && list && list.length === 0 && (
                <p className="text-gray-500 text-sm py-4">尚無購買紀錄</p>
              )}
              {!loading && list && list.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="py-2 pr-3 font-medium text-gray-700">課程日期</th>
                      <th className="py-2 pr-3 font-medium text-gray-700">課程名稱</th>
                      <th className="py-2 pr-3 font-medium text-gray-700">金額</th>
                      <th className="py-2 pr-3 font-medium text-gray-700">狀態</th>
                      <th className="py-2 font-medium text-gray-700">訂單時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 text-gray-700">{formatCourseDate(row)}</td>
                        <td className="py-2 pr-3 text-gray-900">{row.class_title || "—"}</td>
                        <td className="py-2 pr-3 text-gray-900">
                          {row.class_price != null ? `NT$ ${row.class_price.toLocaleString()}` : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="py-2 text-gray-600">{formatDate(row.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
