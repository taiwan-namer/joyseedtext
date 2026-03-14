"use client";

import { useState, useEffect } from "react";
import { Image } from "lucide-react";
import type { CarouselItem } from "@/app/lib/frontendSettingsShared";

const CAROUSEL_INTERVAL_MS = 4000;

type Props = { carouselList: CarouselItem[] };

export default function CarouselSection({ carouselList }: Props) {
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
    <section className="px-4 py-4 mx-auto w-full max-w-7xl">
      <div className="relative w-full aspect-[12/5] rounded-xl overflow-hidden">
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
        <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1.5">
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
