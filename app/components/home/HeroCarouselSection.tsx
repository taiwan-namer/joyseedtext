"use client";

import { useState, useEffect } from "react";
import { Image } from "lucide-react";
import type { CarouselItem } from "@/app/lib/frontendSettingsShared";

const CAROUSEL_INTERVAL_MS = 4000;

type Props = { carouselList: CarouselItem[] };

/** 首頁大圖輪播版：與輪播牆相同資料，使用較大比例（類 Hero） */
export default function HeroCarouselSection({ carouselList }: Props) {
  const [wallIndex, setWallIndex] = useState(0);

  useEffect(() => {
    if (carouselList.length === 0) return;
    const timer = setInterval(() => {
      setWallIndex((i) => (i + 1) % carouselList.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [carouselList.length]);

  if (carouselList.length === 0) return null;

  return (
    <section className="px-4 pt-0 pb-4 mx-auto w-full max-w-7xl">
      <div className="relative w-full aspect-[4/5] sm:aspect-[3/2] md:aspect-auto md:h-[600px] rounded-xl overflow-hidden bg-amber-50">
        {carouselList.map((item, i) => (
          <div
            key={item.id}
            className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${
              i === wallIndex ? "opacity-100 z-10" : "opacity-0 z-0"
            } ${item.imageUrl ? "bg-gray-900" : "bg-amber-100"}`}
          >
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <Image className="w-12 h-12 text-gray-400 relative z-10" strokeWidth={1.5} />
            )}
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none z-10" aria-hidden />
        <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-1.5">
          {carouselList.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setWallIndex(i)}
              aria-label={`第 ${i + 1} 張`}
              className={`h-2 rounded-full transition-all ${
                i === wallIndex ? "w-6 bg-amber-500" : "w-2 bg-white/80 hover:bg-white"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
