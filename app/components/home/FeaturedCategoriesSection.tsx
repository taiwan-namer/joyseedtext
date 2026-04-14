"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import type { FeaturedCategory } from "@/app/lib/frontendSettingsShared";
import { DEFAULT_FEATURED_CATEGORIES } from "@/app/lib/frontendSettingsShared";
import { isValidImageUrl } from "@/lib/safeMedia";

type Props = {
  categories?: FeaturedCategory[];
  sectionTitle?: string;
  /** 上方小圖示（可選） */
  sectionIconUrl?: string;
  /** 點選分館卡片時的回呼（若提供則不跳轉連結） */
  onCategoryClick?: (cat: FeaturedCategory) => void;
  /** 滑鼠移入／鍵盤聚焦分館時更新下方課程（僅桌機列與可聚焦按鈕；手機仍以點選為主） */
  onCategoryHover?: (cat: FeaturedCategory) => void;
  /** 目前選中的分館 id（用於外觀高亮，與下方 1+6 區塊同步） */
  activeCategoryId?: string | null;
  /** 外層底色 class（例如外層已鋪背景圖時傳 `bg-transparent`） */
  surfaceClassName?: string;
};

/** 手機分館列自動輪播間隔（毫秒） */
const MOBILE_CATEGORY_AUTOPLAY_MS = 4500;

export default function FeaturedCategoriesSection({
  categories = DEFAULT_FEATURED_CATEGORIES,
  sectionTitle = "精選課程",
  sectionIconUrl,
  onCategoryClick,
  onCategoryHover,
  activeCategoryId,
  surfaceClassName,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const blockNavClickRef = useRef(false);

  const enabledCategories = categories.filter((c) => c.enabled !== false);
  const hasCategories = enabledCategories.length > 0;
  const visibleCount = hasCategories ? Math.min(4, enabledCategories.length) : 0;

  const handlePrev = () => {
    if (!hasCategories) return;
    setCurrentIndex((prev) => (prev - visibleCount + enabledCategories.length) % enabledCategories.length);
  };

  const handleNext = () => {
    if (!hasCategories) return;
    setCurrentIndex((prev) => (prev + visibleCount) % enabledCategories.length);
  };

  const SWIPE_MIN = 45;

  const onCarouselTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const onCarouselTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    touchStartRef.current = null;
    if (Math.abs(dx) < SWIPE_MIN) return;
    blockNavClickRef.current = true;
    window.setTimeout(() => {
      blockNavClickRef.current = false;
    }, 350);
    if (dx > 0) handlePrev();
    else handleNext();
  };

  const onCarouselClickCapture = (e: React.MouseEvent) => {
    if (blockNavClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleSelectCategory = (cat: FeaturedCategory) => {
    if (onCategoryClick) onCategoryClick(cat);
  };

  const categoryButtonClass = (cat: FeaturedCategory) =>
    [
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg transition-shadow",
      activeCategoryId != null && activeCategoryId === cat.id
        ? "ring-2 ring-brand/90 ring-offset-2 ring-offset-white"
        : "",
    ]
      .filter(Boolean)
      .join(" ");

  const getVisibleCategories = () => {
    if (!hasCategories || visibleCount === 0) return [];
    const result: FeaturedCategory[] = [];
    for (let i = 0; i < visibleCount; i++) {
      const idx = (currentIndex + i) % enabledCategories.length;
      result.push(enabledCategories[idx]);
    }
    return result;
  };

  const canRotateMobile =
    hasCategories && visibleCount > 0 && enabledCategories.length > visibleCount;

  useEffect(() => {
    if (!canRotateMobile) return;
    const id = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + visibleCount) % enabledCategories.length);
    }, MOBILE_CATEGORY_AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [canRotateMobile, enabledCategories.length, visibleCount]);

  return (
    <section
      className={`w-full pt-0 pb-4 sm:pt-1 md:pt-2 md:pb-9 ${surfaceClassName ?? "bg-transparent"}`}
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-col items-center mb-4 sm:mb-5">
          {isValidImageUrl(sectionIconUrl) && (
            <Image
              src={sectionIconUrl}
              alt=""
              width={221}
              height={80}
              sizes="(max-width:640px) 90vw, 13.77rem"
              className="mb-0 block h-auto w-[13.77rem] max-w-[90vw] aspect-[221/80] object-contain"
            />
          )}
          <h2 className="mt-1 text-lg font-semibold text-gray-800 text-center">{sectionTitle}</h2>
        </div>
        {/* 手機版：一次顯示多張；自動輪播 + 可左右滑切換 */}
        <div className="w-full px-3 sm:hidden">
          {hasCategories && (
            <div
              role="region"
              aria-label={`${sectionTitle}，左右滑動可切換`}
              className="touch-pan-y"
              onTouchStart={onCarouselTouchStart}
              onTouchEnd={onCarouselTouchEnd}
              onClickCapture={onCarouselClickCapture}
            >
              <div className="flex justify-center gap-2.5">
                {getVisibleCategories().map((cat) => {
                    const hasPrimary = isValidImageUrl(cat.imageUrl);
                    const hasHover = isValidImageUrl(cat.hoverImageUrl);
                    const isSelected = activeCategoryId != null && activeCategoryId === cat.id;
                    const content = (
                      <div className="flex flex-col items-center">
                        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden">
                          {hasPrimary || hasHover ? (
                            <>
                              {hasPrimary ? (
                                <Image
                                  src={cat.imageUrl!}
                                  alt=""
                                  fill
                                  sizes="80px"
                                  className={`object-contain object-center drop-shadow-sm transition-opacity duration-200 ${
                                    hasHover && isSelected ? "opacity-0" : "opacity-100"
                                  }`}
                                  aria-hidden
                                />
                              ) : null}
                              {hasHover ? (
                                <Image
                                  src={cat.hoverImageUrl!}
                                  alt=""
                                  fill
                                  sizes="80px"
                                  className={`pointer-events-none object-contain object-center drop-shadow-sm transition-opacity duration-200 ${
                                    hasPrimary ? (isSelected ? "opacity-100" : "opacity-0") : "opacity-100"
                                  }`}
                                  aria-hidden
                                />
                              ) : null}
                            </>
                          ) : (
                            <div className="flex h-14 w-16 items-center justify-center rounded-full bg-amber-50">
                              <ImageIcon className="h-7 w-7 text-amber-200" strokeWidth={1.5} aria-hidden />
                            </div>
                          )}
                        </div>
                      </div>
                    );

                    if (onCategoryClick) {
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          aria-label={cat.name}
                          onClick={() => handleSelectCategory(cat)}
                          onFocus={() => onCategoryHover?.(cat)}
                          className={categoryButtonClass(cat)}
                        >
                          {content}
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={cat.id}
                        href={cat.link}
                        prefetch={true}
                        aria-label={cat.name}
                        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg"
                      >
                        {content}
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* 桌機版：一整排 icon 風格（可點選） */}
        <div className="hidden sm:flex flex-wrap justify-center gap-4 sm:gap-6">
          {enabledCategories.map((cat) => {
            const hasPrimaryImage = isValidImageUrl(cat.imageUrl);
            const hasHoverImage = isValidImageUrl(cat.hoverImageUrl);
            const content = (
              <div className="flex flex-col items-center">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center sm:h-32 sm:w-32">
                  {hasPrimaryImage || hasHoverImage ? (
                    <div className="relative h-full w-full">
                      {hasPrimaryImage ? (
                        <Image
                          src={cat.imageUrl!}
                          alt=""
                          fill
                          sizes="(min-width:640px) 128px, 112px"
                          className={`object-contain object-center drop-shadow-sm transition-opacity duration-200 ${
                            hasHoverImage ? "opacity-100 group-hover:opacity-0 group-focus-within:opacity-0" : "opacity-100"
                          }`}
                          aria-hidden
                        />
                      ) : null}
                      {hasHoverImage ? (
                        <Image
                          src={cat.hoverImageUrl!}
                          alt=""
                          fill
                          sizes="(min-width:640px) 128px, 112px"
                          className={`pointer-events-none object-contain object-center drop-shadow-sm transition-opacity duration-200 ${
                            hasPrimaryImage ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" : "opacity-100"
                          }`}
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div className="w-20 h-16 rounded-full bg-amber-50 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-amber-200" strokeWidth={1.5} aria-hidden />
                    </div>
                  )}
                </div>
              </div>
            );

            if (onCategoryClick) {
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-label={cat.name}
                  onClick={() => handleSelectCategory(cat)}
                  onMouseEnter={() => onCategoryHover?.(cat)}
                  onFocus={() => onCategoryHover?.(cat)}
                  className={`group ${categoryButtonClass(cat)}`}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={cat.id}
                href={cat.link}
                prefetch={true}
                aria-label={cat.name}
                className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
