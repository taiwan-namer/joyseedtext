"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { updateAiChatSettings, uploadAiChatAvatarImage } from "@/app/actions/storeSettingsActions";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { Loader2, Send, Upload, RotateCcw } from "lucide-react";
import { ChatCourseCard, type ChatCourseItem } from "@/app/components/chat/ChatCourseCard";

type ChatOrderItem = {
  id: string;
  courseTitle: string;
  status: string;
  slotDate: string | null;
  slotTime: string | null;
  amount: number | null;
  courseUrl: string;
};

type ChatMsg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "assistant"; type: "course_recommendation"; reply: string; courses: ChatCourseItem[] }
  | { role: "assistant"; type: "order_list"; reply: string; orders: ChatOrderItem[] };

const DEFAULT_WELCOME =
  "您好！我是 AI 課程助手 👋\n可以問我：\n• 有哪些適合 3 歲的課程？\n• 本週有什麼活動？\n• 我的訂單狀態是什麼？";

const ORDER_STATUS_LABELS: Record<string, string> = {
  unpaid: "未付款",
  paid: "已付款",
  upcoming: "即將上課",
  completed: "已完成",
  cancelled: "已取消",
};

export function AdminAiSupportClient({
  initialAiChatEnabled,
  initialAiChatWelcomeMessage,
  initialAiChatAvatarUrl,
}: {
  initialAiChatEnabled: boolean;
  initialAiChatWelcomeMessage: string;
  initialAiChatAvatarUrl: string | null;
}) {
  const { primaryColor } = useStoreSettings();
  const [aiChatEnabled, setAiChatEnabled] = useState(initialAiChatEnabled);
  const [welcomeMessage, setWelcomeMessage] = useState(
    initialAiChatWelcomeMessage || DEFAULT_WELCOME
  );
  const [aiChatAvatarUrl, setAiChatAvatarUrl] = useState<string | null>(initialAiChatAvatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDraftSrc, setAvatarDraftSrc] = useState<string | null>(null);
  const [avatarScale, setAvatarScale] = useState(1);
  const [avatarOffset, setAvatarOffset] = useState({ x: 0, y: 0 });
  const [draggingAvatar, setDraggingAvatar] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [avatarStartOffset, setAvatarStartOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [avatarNaturalSize, setAvatarNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [testMessages, setTestMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "在下方輸入問題測試 AI 回覆；可點「訂單模板」預覽訂單列表（僅後台範例）。" },
  ]);
  const [testInput, setTestInput] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    setAiChatEnabled(initialAiChatEnabled);
    setWelcomeMessage(initialAiChatWelcomeMessage || DEFAULT_WELCOME);
    setAiChatAvatarUrl(initialAiChatAvatarUrl);
  }, [initialAiChatEnabled, initialAiChatWelcomeMessage, initialAiChatAvatarUrl]);

  const handleSave = async () => {
    setSaveMessage(null);
    setSaving(true);
    const result = await updateAiChatSettings(
      aiChatEnabled,
      welcomeMessage.trim() || null,
      aiChatAvatarUrl
    );
    setSaving(false);
    if (result.success) {
      setSaveMessage({ type: "success", text: result.message ?? "已儲存" });
    } else {
      setSaveMessage({ type: "error", text: result.error });
    }
  };

  const handleTestSend = async (overrideInput?: string, adminPreviewOrder?: boolean) => {
    const text = (overrideInput ?? testInput).trim();
    if (!text || testLoading) return;
    setTestMessages((prev) => [...prev, { role: "user", content: text }]);
    if (!overrideInput) setTestInput("");
    setTestLoading(true);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, admin_preview_order: adminPreviewOrder === true }),
      });
      const data = await res.json();
      if (data.type === "course_recommendation" && Array.isArray(data.courses)) {
        setTestMessages((prev) => [
          ...prev,
          { role: "assistant", type: "course_recommendation", reply: data.reply ?? "", courses: data.courses },
        ]);
      } else if (data.type === "order_list" && Array.isArray(data.orders)) {
        setTestMessages((prev) => [
          ...prev,
          { role: "assistant", type: "order_list", reply: data.reply ?? "", orders: data.orders },
        ]);
      } else {
        const reply = data.reply ?? data.error ?? "無法取得回覆，請檢查 DEEPSEEK_API_KEY 與網路。";
        setTestMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      }
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
    { label: "課程", phrase: "有哪些適合 3 歲的課程？", adminPreview: false },
    { label: "訂單", phrase: "我的訂單狀態是什麼？", adminPreview: true },
    { label: "常見問題", phrase: "怎麼退款？", adminPreview: false },
  ];

  const openAvatarDraft = async (file: File) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("無法讀取圖片"));
      img.src = src;
    });
    setAvatarNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    setAvatarDraftSrc(src);
    setAvatarScale(1);
    setAvatarOffset({ x: 0, y: 0 });
  };

  const handleAvatarFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setSaveMessage({ type: "error", text: "請選擇圖片檔案" });
      return;
    }
    try {
      await openAvatarDraft(f);
      setSaveMessage(null);
    } catch {
      setSaveMessage({ type: "error", text: "圖片讀取失敗，請換一張再試" });
    }
  };

  const applyAvatarCrop = async () => {
    if (!avatarDraftSrc || !avatarNaturalSize) return;
    setAvatarUploading(true);
    try {
      const frame = 96;
      const canvas = document.createElement("canvas");
      canvas.width = frame;
      canvas.height = frame;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("無法建立裁切畫布");
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("圖片載入失敗"));
        img.src = avatarDraftSrc;
      });
      const base = Math.max(frame / avatarNaturalSize.w, frame / avatarNaturalSize.h);
      const drawScale = base * avatarScale;
      const drawW = avatarNaturalSize.w * drawScale;
      const drawH = avatarNaturalSize.h * drawScale;
      const x = (frame - drawW) / 2 + avatarOffset.x;
      const y = (frame - drawH) / 2 + avatarOffset.y;
      ctx.clearRect(0, 0, frame, frame);
      ctx.drawImage(img, x, y, drawW, drawH);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
      if (!blob) throw new Error("裁切失敗");
      const fd = new FormData();
      fd.set("ai_chat_avatar", new File([blob], "ai-chat-avatar.png", { type: "image/png" }));
      const uploaded = await uploadAiChatAvatarImage(fd);
      if (!uploaded.success) {
        setSaveMessage({ type: "error", text: uploaded.error });
        return;
      }
      setAiChatAvatarUrl(uploaded.url);
      setAvatarDraftSrc(null);
      setSaveMessage({ type: "success", text: "頭像已更新，記得按「儲存設定」套用前台" });
    } catch (err) {
      setSaveMessage({ type: "error", text: err instanceof Error ? err.message : "頭像裁切失敗" });
    } finally {
      setAvatarUploading(false);
    }
  };

  const closeAvatarDraft = () => {
    if (avatarDraftSrc?.startsWith("blob:")) URL.revokeObjectURL(avatarDraftSrc);
    setAvatarDraftSrc(null);
    setAvatarNaturalSize(null);
    setDraggingAvatar(false);
    setDragStart(null);
  };

  const handleAvatarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!avatarDraftSrc) return;
    setDraggingAvatar(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setAvatarStartOffset(avatarOffset);
  };

  const handleAvatarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingAvatar || !dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setAvatarOffset({ x: avatarStartOffset.x + dx, y: avatarStartOffset.y + dy });
  };

  const handleAvatarPointerUp = () => {
    setDraggingAvatar(false);
    setDragStart(null);
  };

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
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-lg font-semibold text-gray-900">AI 客服頭像</h3>
            <p className="mt-1 text-sm text-gray-500">
              建議尺寸：正方形（至少 256×256）。上傳後可拖曳調整位置、縮放裁切，前台右下角按鈕將使用此圖。
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="text-sm text-gray-700">目前前台預覽</div>
              <div className="h-14 w-14 overflow-hidden rounded-full border border-gray-300 bg-white">
                {aiChatAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={aiChatAvatarUrl} alt="AI 客服頭像預覽" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">預設</div>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100">
                <Upload className="h-4 w-4" />
                選擇圖片並裁切
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFilePick} />
              </label>
              <button
                type="button"
                onClick={() => setAiChatAvatarUrl(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw className="h-4 w-4" />
                恢復預設吉祥物
              </button>
            </div>
          </div>
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

      {avatarDraftSrc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">裁切 AI 客服頭像</h3>
            <p className="mt-1 text-xs text-gray-500">拖曳調整位置；縮放到前台按鈕顯示的構圖。</p>
            <div
              className="relative mt-3 h-64 w-full overflow-hidden rounded-lg bg-gray-100"
              onPointerDown={handleAvatarPointerDown}
              onPointerMove={handleAvatarPointerMove}
              onPointerUp={handleAvatarPointerUp}
              onPointerLeave={handleAvatarPointerUp}
            >
              <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-500/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              {avatarNaturalSize ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarDraftSrc}
                  alt="裁切預覽"
                  draggable={false}
                  className="absolute left-1/2 top-1/2 select-none pointer-events-none"
                  style={{
                    width: `${avatarNaturalSize.w}px`,
                    height: `${avatarNaturalSize.h}px`,
                    transform: `translate(-50%, -50%) translate(${avatarOffset.x}px, ${avatarOffset.y}px) scale(${avatarScale})`,
                    transformOrigin: "center center",
                  }}
                />
              ) : null}
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">縮放</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={avatarScale}
                onChange={(e) => setAvatarScale(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeAvatarDraft}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                disabled={avatarUploading}
              >
                取消
              </button>
              <button
                type="button"
                onClick={applyAvatarCrop}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
                disabled={avatarUploading}
              >
                {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                套用裁切
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              onClick={() => handleTestSend(q.phrase, q.adminPreview)}
              disabled={testLoading}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              {q.label}模板
            </button>
          ))}
        </div>
        <div className="flex flex-col rounded-lg border border-gray-200 bg-gray-50/50">
          <div
            className="min-h-[200px] max-h-[400px] space-y-2 overflow-y-auto p-3"
          >
            {testMessages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-amber-500 px-3 py-2 text-sm text-white">
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  </div>
                );
              }
              if ("type" in m && m.type === "course_recommendation") {
                return (
                  <div key={i} className="space-y-2">
                    <div className="max-w-[85%] rounded-lg bg-white px-3 py-2 text-sm text-gray-800 shadow-sm">
                      {m.reply}
                    </div>
                    {m.courses.length > 0 && (
                      <div className="grid max-w-[85%] gap-2 sm:grid-cols-2">
                        {m.courses.map((c) => (
                          <ChatCourseCard key={c.id} course={c} primaryColor={primaryColor} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              if ("type" in m && m.type === "order_list") {
                return (
                  <div key={i} className="space-y-2">
                    <div className="max-w-[85%] rounded-lg bg-white px-3 py-2 text-sm text-gray-800 shadow-sm">
                      {m.reply}
                    </div>
                    {m.orders.length > 0 && (
                      <ul className="max-w-[85%] space-y-2 rounded-lg border border-gray-200 bg-white p-2 text-sm">
                        {m.orders.map((o) => (
                          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                            <span className="font-medium text-gray-900">{o.courseTitle}</span>
                            <span className="text-gray-500">{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                            {(o.slotDate || o.slotTime) && (
                              <span className="w-full text-xs text-gray-500">
                                {[o.slotDate, o.slotTime].filter(Boolean).join(" ")}
                              </span>
                            )}
                            {o.amount != null && <span className="text-gray-700">NT$ {o.amount}</span>}
                            <Link href={o.courseUrl} className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50">
                              查看課程
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              }
              return (
                <div key={i} className="max-w-[85%] rounded-lg bg-white px-3 py-2 text-sm text-gray-800 shadow-sm">
                  <span className="whitespace-pre-wrap">{m.content}</span>
                </div>
              );
            })}
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
