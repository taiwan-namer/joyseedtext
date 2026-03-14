"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Download } from "lucide-react";

function getDefaultMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

type Summary = {
  total_revenue: number;
  total_students: number;
  total_courses: number;
  average_order_value: number;
};

type CourseItem = {
  course_title: string;
  total_students: number;
  total_revenue: number;
};

export default function AdminRevenuePage() {
  const defaultRange = getDefaultMonthRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [courseItems, setCourseItems] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const [summaryRes, courseRes] = await Promise.all([
        fetch(`/api/dashboard/revenue-summary?${params}`),
        fetch(`/api/dashboard/course-revenue?${params}`),
      ]);

      if (!summaryRes.ok) {
        const err = await summaryRes.json().catch(() => ({}));
        setError(err.error || summaryRes.statusText);
        setLoading(false);
        return;
      }
      if (!courseRes.ok) {
        const err = await courseRes.json().catch(() => ({}));
        setError(err.error || courseRes.statusText);
        setLoading(false);
        return;
      }

      const summaryData = await summaryRes.json();
      const courseData = await courseRes.json();
      setSummary(summaryData);
      setCourseItems(courseData.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportCsv = () => {
    setExporting(true);
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    const url = `/api/export/orders?${params}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => setExporting(false), 500);
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
      <h1 className="text-xl font-bold text-gray-900">訂單金額管理</h1>

      {/* 日期篩選 */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="start_date" className="text-sm font-medium text-gray-700">
            開始日期
          </label>
          <input
            id="start_date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="end_date" className="text-sm font-medium text-gray-700">
            結束日期
          </label>
          <input
            id="end_date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : summary ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-gray-500">總營收</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                NT$ {summary.total_revenue.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-gray-500">總報名人數</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {summary.total_students} 人
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-gray-500">課程數量</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {summary.total_courses} 堂
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-gray-500">平均客單價</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                NT$ {summary.average_order_value.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 課程列表 */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">課程列表</h2>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-60 transition-colors"
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                匯出 CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              {courseItems.length === 0 ? (
                <p className="py-8 px-4 text-center text-gray-500 text-sm">此區間無已付款訂單</p>
              ) : (
                <table className="w-full min-w-[400px] text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">課程名稱</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">報名人數</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">營收</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseItems.map((item, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-gray-900">{item.course_title}</td>
                        <td className="py-3 px-4 text-right text-gray-700">
                          {item.total_students}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                          NT$ {item.total_revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
