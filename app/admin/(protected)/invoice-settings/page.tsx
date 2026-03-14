"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { getStoreSettings, updateInvoiceSettings, type InvoiceItemSetting } from "@/app/actions/storeSettingsActions";

const DEFAULT_ROW: InvoiceItemSetting = { name: "", word: "式", amount: undefined };

export type InvoiceProvider = "ecpay" | "ezpay";

export default function InvoiceSettingsPage() {
  const router = useRouter();
  const [invoiceProvider, setInvoiceProvider] = useState<InvoiceProvider>("ecpay");
  const [items, setItems] = useState<InvoiceItemSetting[]>([{ ...DEFAULT_ROW }]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getStoreSettings()
      .then((s) => {
        setInvoiceProvider(s.invoiceProvider ?? "ecpay");
        if (s.invoiceItems && s.invoiceItems.length > 0) {
          setItems(s.invoiceItems.map((x) => ({ name: x.name, word: x.word || "式", amount: x.amount })));
        } else {
          setItems([{ name: "課程預約", word: "堂", amount: undefined }]);
        }
      })
      .catch(() => setItems([{ name: "課程預約", word: "堂", amount: undefined }]))
      .finally(() => setLoading(false));
  }, []);

  const addRow = () => {
    setItems((prev) => [...prev, { ...DEFAULT_ROW }]);
  };

  const removeRow = (index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const updateRow = (index: number, field: keyof InvoiceItemSetting, value: string | number | undefined) => {
    setItems((prev) => {
      const next = [...prev];
      (next[index] as Record<string, unknown>)[field] = value;
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const list = items.filter((i) => (i.name ?? "").trim() !== "");
    if (list.length === 0) {
      setMessage({ type: "error", text: "請至少填寫一筆品項名稱" });
      return;
    }
    startTransition(async () => {
      const result = await updateInvoiceSettings(
        invoiceProvider,
        list.map((i) => ({
          name: (i.name ?? "").trim(),
          word: (i.word ?? "式").trim() || "式",
          amount: typeof i.amount === "number" && Number.isFinite(i.amount) && i.amount >= 0 ? i.amount : undefined,
        }))
      );
      if (result.success) {
        setMessage({ type: "success", text: result.message ?? "已儲存" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        載入中…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          返回後台
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900">發票設定</h1>
      <p className="text-sm text-gray-600">
        選擇發票開立廠商，並設定品項名稱與單位。若有多筆，可為其中一筆或數筆設定「固定金額」（例如服務費 50
        元），其餘金額會自動歸到未設固定金額的那一筆。
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {message && (
          <div
            role="alert"
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-2">發票開立廠商</h2>
            <p className="text-xs text-gray-500 mb-3">付款成功後將依此廠商開立電子發票。</p>
            <select
              value={invoiceProvider}
              onChange={(e) => setInvoiceProvider((e.target.value as InvoiceProvider) || "ecpay")}
              disabled={isPending}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white"
            >
              <option value="ecpay">綠界 ECPay</option>
              <option value="ezpay">藍新 ezPay</option>
            </select>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">發票品項</h2>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              新增一筆
            </button>
          </div>

          <div className="space-y-3">
            {items.map((row, index) => (
              <div
                key={index}
                className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3"
              >
                <div className="min-w-[140px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-500">品名</label>
                  <input
                    type="text"
                    value={row.name ?? ""}
                    onChange={(e) => updateRow(index, "name", e.target.value)}
                    placeholder="例：課程預約、服務費"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    disabled={isPending}
                  />
                </div>
                <div className="w-20">
                  <label className="mb-1 block text-xs font-medium text-gray-500">單位</label>
                  <input
                    type="text"
                    value={row.word ?? "式"}
                    onChange={(e) => updateRow(index, "word", e.target.value)}
                    placeholder="式"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    disabled={isPending}
                  />
                </div>
                <div className="w-28">
                  <label className="mb-1 block text-xs font-medium text-gray-500">固定金額（選填）</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.amount ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateRow(index, "amount", v === "" ? undefined : Number(v));
                    }}
                    placeholder="留空＝依訂單"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    disabled={isPending}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  disabled={isPending || items.length <= 1}
                  className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  title="刪除此筆"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            固定金額：若填寫，開立時此品項會使用該金額；未填的品項會分攤剩餘金額（通常僅一筆不填，作為「課程」等主項）。
          </p>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isPending ? "儲存中…" : "儲存"}
          </button>
        </div>
      </form>
    </div>
  );
}
