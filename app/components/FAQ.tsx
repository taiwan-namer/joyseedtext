"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { getFaqItems } from "@/app/actions/storeSettingsActions";
import type { FaqItem } from "@/app/actions/storeSettingsActions";

/** 每欄最多幾則；超過則往右新增一欄（例：11 則 → 5 + 5 + 1） */
const MAX_FAQ_PER_COLUMN = 5;

function splitIntoColumns<T>(arr: T[], maxPerColumn: number): T[][] {
  if (maxPerColumn < 1) return [arr];
  const cols: T[][] = [];
  for (let i = 0; i < arr.length; i += maxPerColumn) {
    cols.push(arr.slice(i, i + maxPerColumn));
  }
  return cols;
}

type FaqRowProps = {
  item: FaqItem;
  siteName: string;
  isOpen: boolean;
  onToggle: () => void;
};

function FaqAccordionRow({ item, siteName, isOpen, onToggle }: FaqRowProps) {
  const answer = item.answer.replace(/童趣島/g, siteName);
  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 rounded"
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${item.id}`}
        id={`faq-question-${item.id}`}
      >
        <span className="font-semibold text-gray-800 pr-2">{item.question}</span>
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
          <p className="pb-4 text-gray-600 leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export default function FAQ() {
  const { siteName } = useStoreSettings();
  const [items, setItems] = useState<FaqItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    getFaqItems().then((list) => {
      setItems(list);
      if (list.length > 0) {
        setOpenId((prev) => prev ?? list[0].id);
      }
    });
  }, []);

  if (items.length === 0) return null;

  const columns = splitIntoColumns(items, MAX_FAQ_PER_COLUMN);
  const multiColumn = columns.length > 1;

  const row = (item: FaqItem) => (
    <FaqAccordionRow
      key={item.id}
      item={item}
      siteName={siteName}
      isOpen={openId === item.id}
      onToggle={() => setOpenId(openId === item.id ? null : item.id)}
    />
  );

  return (
    <>
      {/* 手機：>5 則改為左右滑動分欄，並在右側顯示箭頭提示 */}
      {!multiColumn ? (
        <div className="w-full max-w-2xl mx-auto md:hidden">{items.map(row)}</div>
      ) : (
        <div className="md:hidden relative">
          <div className="overflow-x-auto pb-1 snap-x snap-mandatory">
            <div className="flex gap-3">
              {columns.map((col, colIndex) => (
                <div
                  key={colIndex}
                  className="w-[calc(100vw-2rem)] max-w-[560px] shrink-0 snap-start rounded-lg bg-white"
                >
                  {col.map(row)}
                </div>
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-14 bg-gradient-to-l from-white via-white/80 to-transparent" />
          <div className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/95 shadow border border-gray-200 p-1.5">
            <ChevronRight className="h-4 w-4 text-amber-600" aria-hidden />
          </div>
        </div>
      )}

      {/* 桌機：≤5 則維持置中寬度；>5 則每欄最多 5 則、多欄由左填滿 */}
      {!multiColumn ? (
        <div className="hidden md:block w-full max-w-2xl mx-auto">{items.map(row)}</div>
      ) : (
        <div
          className="hidden md:grid w-full max-w-7xl mx-auto gap-x-8 gap-y-0"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {columns.map((col, colIndex) => (
            <div key={colIndex} className="min-w-0">
              {col.map(row)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
