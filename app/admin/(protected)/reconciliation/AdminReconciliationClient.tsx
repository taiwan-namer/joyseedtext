"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Loader2 } from "lucide-react";

type Line = {
  booking_id: string;
  created_at: string;
  supplier_label: string;
  class_title: string;
  course_amount: number;
  peace_addon_amount?: number;
  commission_amount: number;
  course_net_after_commission: number;
  commission_rate_percent: number;
  order_total?: number;
};

type Totals = {
  course_amount: number;
  peace_addon: number;
  commission: number;
  net: number;
  order_total: number;
};

function monthStartEnd(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function normalizeTotals(t: unknown): Totals | null {
  if (!t || typeof t !== "object") return null;
  const o = t as Record<string, unknown>;
  return {
    course_amount: Number(o.course_amount) || 0,
    peace_addon: Number(o.peace_addon) || 0,
    commission: Number(o.commission) || 0,
    net: Number(o.net) || 0,
    order_total: Number(o.order_total) || 0,
  };
}

function ReconciliationTable({
  lines,
  loading,
  emptyText,
}: {
  lines: Line[];
  loading: boolean;
  emptyText: string;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }
  if (lines.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-500">{emptyText}</p>;
  }
  return (
    <table className="w-full min-w-[960px] text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left py-3 px-4 font-medium text-gray-700">訂單時間</th>
          <th className="text-left py-3 px-4 font-medium text-gray-700">課程所屬店家</th>
          <th className="text-left py-3 px-4 font-medium text-gray-700">課程</th>
          <th className="text-right py-3 px-4 font-medium text-gray-700">客付總額</th>
          <th className="text-right py-3 px-4 font-medium text-gray-700">總金額（課程）</th>
          <th className="text-right py-3 px-4 font-medium text-gray-700">抽成%</th>
          <th className="text-right py-3 px-4 font-medium text-gray-700">傭金</th>
          <th className="text-right py-3 px-4 font-medium text-gray-700">扣除傭金後</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((row) => (
          <tr key={row.booking_id} className="border-b border-gray-100 hover:bg-gray-50/50">
            <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
              {new Date(row.created_at).toLocaleString("zh-TW")}
            </td>
            <td className="py-3 px-4 text-gray-800">{row.supplier_label}</td>
            <td className="py-3 px-4 text-gray-900">{row.class_title}</td>
            <td className="py-3 px-4 text-right text-gray-600">
              NT$ {(row.order_total ?? 0).toLocaleString()}
            </td>
            <td className="py-3 px-4 text-right font-medium">NT$ {row.course_amount.toLocaleString()}</td>
            <td className="text-right py-3 px-4 text-gray-600">{row.commission_rate_percent}%</td>
            <td className="py-3 px-4 text-right">NT$ {row.commission_amount.toLocaleString()}</td>
            <td className="py-3 px-4 text-right font-medium text-gray-900">
              NT$ {row.course_net_after_commission.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TotalsCards({ totals, title }: { totals: Totals | null; title: string }) {
  if (!totals) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">客付總額</p>
          <p className="mt-1 text-lg font-bold text-gray-900">NT$ {totals.order_total.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">總金額（課程）</p>
          <p className="mt-1 text-lg font-bold text-gray-900">NT$ {totals.course_amount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">傭金</p>
          <p className="mt-1 text-lg font-bold text-gray-900">NT$ {totals.commission.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">扣除傭金後（課程淨額）</p>
          <p className="mt-1 text-lg font-bold text-amber-900">NT$ {totals.net.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminReconciliationClient() {
  const defaults = useMemo(() => monthStartEnd(), []);
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [linesHq, setLinesHq] = useState<Line[]>([]);
  const [linesLocal, setLinesLocal] = useState<Line[]>([]);
  const [totalsAll, setTotalsAll] = useState<Totals | null>(null);
  const [totalsHq, setTotalsHq] = useState<Totals | null>(null);
  const [totalsLocal, setTotalsLocal] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapLine = (x: Record<string, unknown>): Line => ({
    booking_id: String(x.booking_id ?? ""),
    created_at: String(x.created_at ?? ""),
    supplier_label: String(x.supplier_label ?? ""),
    class_title: String(x.class_title ?? ""),
    course_amount: Number(x.course_amount) || 0,
    peace_addon_amount: Number(x.peace_addon_amount) || 0,
    commission_amount: Number(x.commission_amount) || 0,
    course_net_after_commission: Number(x.course_net_after_commission) || 0,
    commission_rate_percent: Number(x.commission_rate_percent) || 0,
    order_total: Number(x.order_total) || 0,
  });

  const load = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const res = await fetch(`/api/admin/reconciliation?${q}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "載入失敗");
        setLinesHq([]);
        setLinesLocal([]);
        setTotalsAll(null);
        setTotalsHq(null);
        setTotalsLocal(null);
        return;
      }
      const hq = Array.isArray(data.lines_hq) ? data.lines_hq.map((r: Record<string, unknown>) => mapLine(r)) : [];
      const loc = Array.isArray(data.lines_local)
        ? data.lines_local.map((r: Record<string, unknown>) => mapLine(r))
        : [];
      setLinesHq(hq);
      setLinesLocal(loc);
      setTotalsAll(normalizeTotals(data.totals));
      setTotalsHq(normalizeTotals(data.totals_hq));
      setTotalsLocal(normalizeTotals(data.totals_local));
    } catch (e) {
      setError(e instanceof Error ? e.message : "載入失敗");
      setLinesHq([]);
      setLinesLocal([]);
      setTotalsAll(null);
      setTotalsHq(null);
      setTotalsLocal(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">對帳明細</h1>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-gray-700">
          <Filter className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <span className="text-sm font-medium">篩選</span>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">開始日期</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[44px]"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">結束日期</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[44px]"
          />
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 min-h-[44px]"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" aria-hidden /> : null}
          重新整理
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {totalsAll ? <TotalsCards totals={totalsAll} title="全站合計（本篩選區間）" /> : null}

      <section className="space-y-4 rounded-xl border border-amber-200/80 bg-amber-50/30 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900">總站訂單</h2>
        {totalsHq ? <TotalsCards totals={totalsHq} title="小計" /> : null}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-h-[120px]">
            <ReconciliationTable
              lines={linesHq}
              loading={loading}
              emptyText="此區間無總站結帳訂單"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-sky-200/80 bg-sky-50/30 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900">本站訂單</h2>
        {totalsLocal ? <TotalsCards totals={totalsLocal} title="小計" /> : null}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-h-[120px]">
            <ReconciliationTable
              lines={linesLocal}
              loading={loading}
              emptyText="此區間無本站結帳訂單"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
