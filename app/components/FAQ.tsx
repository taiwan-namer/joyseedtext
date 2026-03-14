"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { getFaqItems } from "@/app/actions/storeSettingsActions";
import type { FaqItem } from "@/app/actions/storeSettingsActions";

export default function FAQ() {
  const { siteName } = useStoreSettings();
  const [items, setItems] = useState<FaqItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    getFaqItems().then((list) => {
      setItems(list);
      if (list.length > 0 && !openId) setOpenId(list[0].id);
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {items.map((item) => {
        const isOpen = openId === item.id;
        const answer = item.answer.replace(/童趣島/g, siteName);
        return (
          <div
            key={item.id}
            className="border-b border-gray-200"
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="w-full flex items-center justify-between gap-3 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 rounded"
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${item.id}`}
              id={`faq-question-${item.id}`}
            >
              <span className="font-semibold text-gray-800 pr-2">
                {item.question}
              </span>
              <ChevronDown
                className={`shrink-0 w-5 h-5 text-gray-500 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>
            <div
              id={`faq-answer-${item.id}`}
              role="region"
              aria-labelledby={`faq-question-${item.id}`}
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className="pb-4 text-gray-600 leading-relaxed">
                  {answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

