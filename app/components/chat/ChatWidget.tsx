"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { ChatCourseCard, type ChatCourseItem } from "./ChatCourseCard";

const WELCOME_MESSAGE = `您好！我是 AI 課程助手 👋
可以問我：
• 有哪些適合 3 歲的課程？
• 本週有什麼活動？
• 我的訂單狀態是什麼？`;

export type ChatOrderItem = {
  id: string;
  courseTitle: string;
  status: string;
  slotDate: string | null;
  slotTime: string | null;
  amount: number | null;
  courseUrl: string;
};

type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "assistant"; type: "course_recommendation"; reply: string; courses: ChatCourseItem[] }
  | { role: "assistant"; type: "order_list"; reply: string; orders: ChatOrderItem[] }
  | { role: "assistant"; type: "faq"; reply: string };

const ChatButton = React.forwardRef<
  HTMLButtonElement,
  { onClick: () => void; ariaExpanded: boolean; primaryColor: string }
>(function ChatButton({ onClick, ariaExpanded, primaryColor }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label="開啟 AI 客服"
      aria-expanded={ariaExpanded}
      className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        backgroundColor: primaryColor,
        color: "white",
        border: "none",
      }}
    >
      <MessageCircle className="h-6 w-6" aria-hidden />
    </button>
  );
});

function ChatHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">AI 客服</h2>
        <p className="text-xs text-gray-500">即時回答您的課程問題</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="關閉"
        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  unpaid: "未付款",
  paid: "已付款",
  upcoming: "即將上課",
  completed: "已完成",
  cancelled: "已取消",
};

function ChatMessages({
  messages,
  isLoading,
  primaryColor,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  primaryColor: string;
}) {
  return (
    <div className="space-y-3">
      {messages.map((m, i) => {
        if (m.role === "user") {
          return (
            <div key={i} className="flex justify-end">
              <div className="max-w-[75%] rounded-lg bg-brand px-3 py-2 text-sm text-white whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          );
        }
        if ("type" in m && m.type === "course_recommendation") {
          return (
            <div key={i} className="flex justify-start flex-col gap-2">
              <div className="max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">
                {m.reply}
              </div>
              {m.courses.length > 0 && (
                <div className="grid gap-2 max-w-[85%]">
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
            <div key={i} className="flex justify-start flex-col gap-2">
              <div className="max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">
                {m.reply}
              </div>
              {m.orders.length > 0 && (
                <ul className="max-w-[85%] space-y-2 rounded-lg border border-gray-200 bg-white p-2 text-sm">
                  {m.orders.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                      <span className="font-medium text-gray-900">{o.courseTitle}</span>
                      <span className="text-gray-500">{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                      {(o.slotDate || o.slotTime) && (
                        <span className="text-xs text-gray-500 w-full">
                          {[o.slotDate, o.slotTime].filter(Boolean).join(" ")}
                        </span>
                      )}
                      {o.amount != null && <span className="text-gray-700">NT$ {o.amount}</span>}
                      <Link
                        href={o.courseUrl}
                        className="text-xs font-medium rounded border border-gray-300 px-2 py-1 hover:bg-gray-50"
                      >
                        查看課程
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }
        const text = "reply" in m ? m.reply : "content" in m ? m.content : "";
        return (
          <div key={i} className="flex justify-start">
            <div className="max-w-[75%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
              {text}
            </div>
          </div>
        );
      })}
      {isLoading && (
        <div className="flex justify-start">
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            思考中…
          </div>
        </div>
      )}
    </div>
  );
}

function ChatInput({
  onSend,
  disabled,
  primaryColor,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
  primaryColor: string;
}) {
  const [value, setValue] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue("");
  };
  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 border-t border-gray-200 p-3"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="輸入您的問題…"
        disabled={disabled}
        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: primaryColor }}
        aria-label="送出"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
}

function ChatWindow({
  isOpen,
  onClose,
  messages,
  onSend,
  isLoading,
  primaryColor,
}: {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isLoading: boolean;
  primaryColor: string;
}) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isOpen, messages]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-24 right-4 z-[99] flex w-[360px] flex-col rounded-xl border border-gray-200 bg-white shadow-xl transition-all duration-200 sm:right-6 md:bottom-24 md:right-6 md:h-[480px] md:w-[360px]"
      style={{
        height: "min(60vh, 480px)",
        maxHeight: "480px",
        width: "calc(100% - 2rem)",
        maxWidth: "360px",
        transformOrigin: "bottom right",
      }}
      role="dialog"
      aria-label="AI 客服"
    >
      <ChatHeader onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-3 py-4" style={{ maxHeight: "400px" }}>
        <ChatMessages messages={messages} isLoading={isLoading} primaryColor={primaryColor} />
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSend={onSend} disabled={isLoading} primaryColor={primaryColor} />
    </div>
  );
}

export default function ChatWidget() {
  const pathname = usePathname();
  const { primaryColor, aiChatEnabled, aiChatWelcomeMessage } = useStoreSettings();
  const welcomeText = (aiChatWelcomeMessage && aiChatWelcomeMessage.trim()) || WELCOME_MESSAGE;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: welcomeText },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  if (pathname?.startsWith("/admin")) return null;
  if (!aiChatEnabled) return null;

  const handleSend = async (text: string) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (data.type === "course_recommendation" && Array.isArray(data.courses)) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", type: "course_recommendation", reply: data.reply ?? "", courses: data.courses },
        ]);
      } else if (data.type === "order_list" && Array.isArray(data.orders)) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", type: "order_list", reply: data.reply ?? "", orders: data.orders },
        ]);
      } else {
        const reply = data.reply ?? data.error ?? "抱歉，我暫時無法回覆，請稍後再試或聯絡客服。";
        setMessages((prev) => [...prev, { role: "assistant", type: "faq", reply }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", type: "faq", reply: "連線發生錯誤，請稍後再試。" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => buttonRef.current?.focus(), 0);
  };

  return (
    <>
      <ChatButton
        ref={buttonRef}
        onClick={() => setIsOpen((v) => !v)}
        ariaExpanded={isOpen}
        primaryColor={primaryColor}
      />
      <ChatWindow
        isOpen={isOpen}
        onClose={handleClose}
        messages={messages}
        onSend={handleSend}
        isLoading={isLoading}
        primaryColor={primaryColor}
      />
    </>
  );
}
