"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getFaqItems, updateFaqItems, type FaqItem } from "@/app/actions/storeSettingsActions";
import { Plus, Ban, Loader2 } from "lucide-react";

function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `faq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 後台常見問題：可編輯、＋ 新增、－ 刪除，對應首頁下方 FAQ */
export default function AdminFaqPage() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFaqItems().then((list) => {
      if (cancelled) return;
      setItems(list.length > 0 ? list : [{ id: generateId(), question: "", answer: "" }]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addItem = () => {
    setItems((prev) => [...prev, { id: generateId(), question: "", answer: "" }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const updateItem = (index: number, field: "question" | "answer", value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateFaqItems(items);
      if (result.success) {
        setMessage({ type: "success", text: result.message ?? "已儲存" });
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
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">常見問題</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/#faq"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            前往首頁預覽 →
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60 touch-manipulation min-h-[44px]"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isPending ? "儲存中…" : "儲存"}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          以下內容對應首頁下方的「常見問題」區塊。可編輯問與答、－ 刪除該題，最後點「儲存」。
        </p>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-amber-300 hover:text-amber-600 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          新增一題
        </button>
      </div>

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

      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm relative"
          >
            <button
              type="button"
              onClick={() => removeItem(index)}
              disabled={items.length <= 1}
              className="absolute top-3 right-3 p-1 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="刪除此題"
              aria-label="刪除此題"
            >
              <Ban className="w-4 h-4" />
            </button>
            <div className="pr-8 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-500">問題</span>
                <input
                  type="text"
                  value={item.question}
                  onChange={(e) => updateItem(index, "question", e.target.value)}
                  placeholder="例：請問報名後如何繳費？"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500">回答</span>
                <textarea
                  value={item.answer}
                  onChange={(e) => updateItem(index, "answer", e.target.value)}
                  placeholder="請輸入回答內容…"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y"
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
