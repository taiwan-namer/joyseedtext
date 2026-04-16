"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getAdminBookings, type BookingWithClass } from "@/app/actions/bookingActions";

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

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

type Summary = {
  total_revenue: number;
  total_students: number;
  total_courses: number;
  average_order_value: number;
};

type MonthlyItem = { month: string; revenue: number };

const CHART_COLOR = "#d97706"; // amber-600

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyItem[]>([]);
  const [allBookings, setAllBookings] = useState<BookingWithClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCourseId, setFilterCourseId] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

  const { start: defaultStart, end: defaultEnd } = getCurrentMonthRange();
  const startDate = filterStartDate || defaultStart;
  const endDate = filterEndDate || defaultEnd;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
        if (filterCourseId) params.set("course_id", filterCourseId);
        const [summaryRes, monthlyRes, bookingsRes] = await Promise.all([
          fetch(`/api/dashboard/revenue-summary?${params}`),
          fetch("/api/dashboard/monthly-revenue"),
          getAdminBookings(),
        ]);

        if (cancelled) return;

        if (!summaryRes.ok) {
          const err = await summaryRes.json().catch(() => ({}));
          setError(err.error || summaryRes.statusText);
          setLoading(false);
          return;
        }
        if (!monthlyRes.ok) {
          const err = await monthlyRes.json().catch(() => ({}));
          setError(err.error || monthlyRes.statusText);
          setLoading(false);
          return;
        }

        const summaryData = await summaryRes.json();
        const monthly = await monthlyRes.json();
        setSummary(summaryData);
        setMonthlyData(monthly.items ?? []);

        if (bookingsRes.success) {
          setAllBookings(bookingsRes.data);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "載入失敗");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, filterCourseId]);

  const recentOrdersFiltered = allBookings.filter((row) => {
    if (filterCourseId && row.class_id !== filterCourseId) return false;
    if (filterStartDate && row.created_at.slice(0, 10) < filterStartDate) return false;
    if (filterEndDate && row.created_at.slice(0, 10) > filterEndDate) return false;
    return true;
  });
  const recentOrders = recentOrdersFiltered.slice(0, 10);

  const courseOptions = Array.from(
    new Map(allBookings.map((b) => [b.class_id, b.class_title || "—"])).entries()
  ).map(([id, title]) => ({ id, title }));

  const chartData = monthlyData.map(({ month, revenue }) => ({
    name: month.replace("-", "/"),
    revenue,
    full: month,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          prefetch
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 touch-manipulation"
        >
          <ChevronLeft className="w-4 h-4" />
          返回後台
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* 篩選：課程、日期（篩選後上方營收連動） */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <span className="text-sm font-medium text-gray-700">篩選</span>
        <select
          value={filterCourseId}
          onChange={(e) => setFilterCourseId(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">全部課程</option>
          {courseOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.title}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label htmlFor="dash_start" className="text-sm text-gray-600">開始日期</label>
          <input
            id="dash_start"
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="dash_end" className="text-sm text-gray-600">結束日期</label>
          <input
            id="dash_end"
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : (
        <>
          {/* Summary cards - 依篩選連動 */}
          <div>
            <p className="text-sm font-medium text-gray-500 mb-3">
              {filterCourseId || filterStartDate || filterEndDate ? "篩選後總覽" : "本月總覽"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-gray-500">總營收</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  NT$ {(summary?.total_revenue ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-gray-500">本月報名人數</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {summary?.total_students ?? 0} 人
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-gray-500">課程數量</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {summary?.total_courses ?? 0} 堂
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-gray-500">平均客單價</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  NT$ {(summary?.average_order_value ?? 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Monthly Revenue Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">最近 6 個月營收</h2>
            <div className="h-64 w-full">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  尚無營收資料
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) =>
                        [`NT$ ${Number(value ?? 0).toLocaleString()}`, "營收"]
                      }
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                    />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, index) => (
                        <Cell key={index} fill={CHART_COLOR} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">最近訂單</h2>
              <Link
                href="/admin/bookings"
                prefetch
                className="text-sm font-medium text-amber-600 hover:text-amber-700 touch-manipulation"
              >
                查看全部
              </Link>
            </div>
            <div className="overflow-x-auto">
              {recentOrders.length === 0 ? (
                <p className="py-8 px-4 text-center text-gray-500 text-sm">尚無訂單</p>
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">訂單編號</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">課程日期</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">課程名稱</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">家長姓名</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">金額</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">狀態</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">訂單日期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-gray-600 font-mono text-xs" title={row.id}>
                          {row.id.slice(0, 8)}…
                        </td>
                        <td className="py-3 px-4 text-gray-600">{formatCourseDate(row)}</td>
                        <td className="py-3 px-4 text-gray-900">{row.class_title || "—"}</td>
                        <td className="py-3 px-4 text-gray-900">{row.parent_name || "—"}</td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                          {row.class_price != null
                            ? `NT$ ${row.class_price.toLocaleString()}`
                            : "—"}
                        </td>
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
                        <td className="py-3 px-4 text-gray-600">{formatDate(row.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
