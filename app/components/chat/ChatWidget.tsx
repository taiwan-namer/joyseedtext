"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";

const WELCOME_MESSAGE = `您好！我是 AI 課程助手 👋
可以問我：
• 有哪些適合 3 歲的課程？
• 本週有什麼活動？
• 我的訂單狀態是什麼？`;

type ChatMessage = { role: "user" | "assistant"; content: string };

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

function ChatMessages({
  messages,
  isLoading,
  messagesEndRef,
}: {
  messages: ChatMessage[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-4" style={{ maxHeight: "400px" }}>
      <div className="space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-brand text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              思考中…
            </div>
          </div>
        )}
      </div>
      <div ref={messagesEndRef} />
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
      className="fixed bottom-20 right-6 z-[99] flex w-[360px] flex-col rounded-xl border border-gray-200 bg-white shadow-xl transition-all duration-200 md:bottom-20 md:right-6 md:h-[520px] md:w-[360px]"
      style={{
        height: "70vh",
        maxHeight: "520px",
        width: "90%",
        maxWidth: "360px",
        transformOrigin: "bottom right",
      }}
      role="dialog"
      aria-label="AI 客服"
    >
      <ChatHeader onClose={onClose} />
      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        messagesEndRef={messagesEndRef}
      />
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
      const reply =
        data.reply ?? data.error ?? "抱歉，我暫時無法回覆，請稍後再試或聯絡客服。";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "連線發生錯誤，請稍後再試。" },
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
