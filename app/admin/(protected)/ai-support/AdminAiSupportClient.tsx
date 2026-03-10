"use client";

import { useState, useEffect } from "react";
import { updateAiChatSettings } from "@/app/actions/storeSettingsActions";
import { Loader2, Send } from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; content: string };

const DEFAULT_WELCOME =
  "您好！我是 AI 課程助手 👋\n可以問我：\n• 有哪些適合 3 歲的課程？\n• 本週有什麼活動？\n• 我的訂單狀態是什麼？";

export function AdminAiSupportClient({
  initialAiChatEnabled,
  initialAiChatWelcomeMessage,
}: {
  initialAiChatEnabled: boolean;
  initialAiChatWelcomeMessage: string;
}) {
  const [aiChatEnabled, setAiChatEnabled] = useState(initialAiChatEnabled);
  const [welcomeMessage, setWelcomeMessage] = useState(
    initialAiChatWelcomeMessage || DEFAULT_WELCOME
  );
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [testMessages, setTestMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "在下方輸入問題測試 AI 回覆。" },
  ]);
  const [testInput, setTestInput] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    setAiChatEnabled(initialAiChatEnabled);
    setWelcomeMessage(initialAiChatWelcomeMessage || DEFAULT_WELCOME);
  }, [initialAiChatEnabled, initialAiChatWelcomeMessage]);

  const handleSave = async () => {
    setSaveMessage(null);
    setSaving(true);
    const result = await updateAiChatSettings(
      aiChatEnabled,
      welcomeMessage.trim() || null
    );
    setSaving(false);
    if (result.success) {
      setSaveMessage({ type: "success", text: result.message ?? "已儲存" });
    } else {
      setSaveMessage({ type: "error", text: result.error });
    }
  };

  const handleTestSend = async (overrideInput?: string) => {
    const text = (overrideInput ?? testInput).trim();
    if (!text || testLoading) return;
    setTestMessages((prev) => [...prev, { role: "user", content: text }]);
    if (!overrideInput) setTestInput("");
    setTestLoading(true);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      const reply =
        data.reply ?? data.error ?? "無法取得回覆，請檢查 DEEPSEEK_API_KEY 與網路。";
      setTestMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setTestMessages((prev) => [
        ...prev,
        { role: "assistant", content: "連線錯誤，請稍後再試。" },
      ]);
    } finally {
      setTestLoading(false);
    }
  };

  const quickTests = [
    { label: "課程", phrase: "有哪些適合 3 歲的課程？" },
    { label: "訂單", phrase: "我的訂單狀態是什麼？" },
    { label: "常見問題", phrase: "怎麼退款？" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">設定</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={aiChatEnabled}
              onChange={(e) => setAiChatEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-gray-700">啟用前台 AI 客服（顯示右下角按鈕）</span>
          </label>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">歡迎訊息（訪客開啟聊天時顯示）</label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder={DEFAULT_WELCOME}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              儲存設定
            </button>
            {saveMessage && (
              <span
                className={
                  saveMessage.type === "success"
                    ? "text-sm text-green-600"
                    : "text-sm text-red-600"
                }
              >
                {saveMessage.text}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">測試對話</h2>
        <p className="mb-3 text-sm text-gray-500">
          與前台使用相同 API，可測試常見問題、課程查詢等。
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {quickTests.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => handleTestSend(q.phrase)}
              disabled={testLoading}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              {q.label}模板
            </button>
          ))}
        </div>
        <div className="flex flex-col rounded-lg border border-gray-200 bg-gray-50/50">
          <div
            className="min-h-[200px] max-h-[320px] space-y-2 overflow-y-auto p-3"
          >
            {testMessages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-lg bg-amber-500 px-3 py-2 text-sm text-white"
                    : "max-w-[85%] rounded-lg bg-white px-3 py-2 text-sm text-gray-800 shadow-sm"
                }
              >
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            ))}
            {testLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                思考中…
              </div>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTestSend();
            }}
            className="flex gap-2 border-t border-gray-200 p-3"
          >
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="輸入測試問題…"
              disabled={testLoading}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="submit"
              disabled={testLoading || !testInput.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
              aria-label="送出"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
