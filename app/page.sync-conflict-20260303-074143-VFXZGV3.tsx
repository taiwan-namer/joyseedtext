"use client";

import Link from "next/link";
import { User, Image, ChevronLeft, ChevronRight } from "lucide-react";
import FAQ from "./components/FAQ";
import LoginModal from "./components/LoginModal";
import { useState, useEffect, useRef } from "react";
import { getCoursesForHomepage } from "./actions/productActions";

// ========== 課程卡片型別（首頁可預訂行程） ==========
type Activity = {
  id: string;
  title: string;
  price: number;
  stock: number; // 0 = 已售完
  imageUrl?: string | null;
  detailHref: string;
  ageTags: string[];
  category?: string;
  description?: string;
};

// 輪播牆用假資料（可替換為真實圖片與連結）
const CAROUSEL_WALL_ITEMS = [
  { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", bg: "bg-amber-100" },
  { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", bg: "bg-blue-100" },
  { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", bg: "bg-amber-50" },
];

const CAROUSEL_INTERVAL_MS = 4000;
const ACTIVITY_CARD_WIDTH = 280;
const ACTIVITY_GAP = 16;
const ACTIVITY_AUTO_SCROLL_MS = 4500;

export default function WonderVoyageHomePage() {
  const [wallIndex, setWallIndex] = useState(0);
  const [activityIndex, setActivityIndex] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const activityScrollRef = useRef<HTMLDivElement>(null);

  // 從資料庫取得課程列表（與後台同步）
  useEffect(() => {
    getCoursesForHomepage().then((res) => {
      if (res.success && res.data.length > 0) {
        setActivities(
          res.data.map((c) => ({
            id: c.id,
            title: c.title,
            price: c.salePrice != null && c.price != null && c.salePrice < c.price ? c.salePrice : c.price ?? 0,
            stock: 10,
            imageUrl: c.imageUrl ?? null,
            detailHref: `/course/${c.id}`,
            ageTags: c.sidebarOptionLabels ?? c.ageTags ?? [],
            category: "課程",
            description: c.courseIntro ? (c.courseIntro.slice(0, 80) + (c.courseIntro.length > 80 ? "…" : "")) : undefined,
          }))
        );
      }
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setWallIndex((i) => (i + 1) % CAROUSEL_WALL_ITEMS.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // 可預訂行程：自動輪播捲動
  useEffect(() => {
    if (activities.length === 0) return;
    const timer = setInterval(() => {
      setActivityIndex((i) => (i + 1) % activities.length);
    }, ACTIVITY_AUTO_SCROLL_MS);
    return () => clearInterval(timer);
  }, [activities.length]);

  useEffect(() => {
    const el = activityScrollRef.current;
    if (!el || activities.length === 0) return;
    const step = ACTIVITY_CARD_WIDTH + ACTIVITY_GAP;
    el.scrollTo({ left: Math.min(activityIndex, activities.length - 1) * step, behavior: "smooth" });
  }, [activityIndex, activities.length]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 1. Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-amber-600 shrink-0">童趣島</h1>
          <div className="flex items-center gap-2 sm:gap-3 shrink min-w-0 overflow-x-auto scrollbar-hide">
            <a href="#about" className="text-gray-600 hover:text-amber-600 text-sm whitespace-nowrap">關於我們</a>
            <Link href="/courses" className="text-gray-600 hover:text-amber-600 text-sm whitespace-nowrap">課程介紹</Link>
            <Link href="/course/booking" className="text-gray-600 hover:text-amber-600 text-sm whitespace-nowrap">課程預約</Link>
            <a href="#faq" className="text-gray-600 hover:text-amber-600 text-sm whitespace-nowrap">常見問題</a>
            <button
              type="button"
              onClick={() => setLoginModalOpen(true)}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
              aria-label="會員登入"
            >
              <User size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl">
        {/* 2. Hero 主圖（單一橫幅） */}
        <section className="px-4 pt-6 pb-4">
          <div className="relative w-full aspect-[16/9] rounded-xl bg-gray-200 overflow-hidden flex items-center justify-center">
            <Image className="w-16 h-16 text-gray-400" strokeWidth={1.5} />
            <div className="absolute inset-0 flex items-end justify-center pb-4 bg-gradient-to-t from-black/30 to-transparent">
              <p className="text-white text-lg font-medium drop-shadow-md">
                探索孩子的無限潛能
              </p>
            </div>
          </div>
        </section>

        {/* 3. 輪播牆（寬度與上方 Hero 相同） */}
        <section className="px-4 py-4">
          <div className="relative w-full aspect-[2/1] max-h-48 rounded-xl overflow-hidden">
            {CAROUSEL_WALL_ITEMS.map((item, i) => (
              <div
                key={item.id}
                className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${
                  i === wallIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                } ${item.bg}`}
              >
                <Image
                  className="w-12 h-12 text-gray-400 mb-2"
                  strokeWidth={1.5}
                />
                <p className="text-gray-800 font-semibold">{item.title}</p>
                <p className="text-gray-600 text-sm">{item.subtitle}</p>
              </div>
            ))}
            <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1.5">
              {CAROUSEL_WALL_ITEMS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setWallIndex(i)}
                  aria-label={`第 ${i + 1} 張`}
                  className={`h-2 rounded-full transition-all ${
                    i === wallIndex
                      ? "w-6 bg-amber-500"
                      : "w-2 bg-white/80 hover:bg-white"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* 4. 可預訂行程 - 全寬區塊，不跟隨上方 max-w，7-8 門課程也不會被吃圖 */}
      <section className="w-full py-6 pb-8 relative bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">可預訂行程</h2>
        </div>
        <div className="relative w-full">
          {/* 左箭頭 */}
          <button
            type="button"
            onClick={() =>
              setActivityIndex((i) =>
                i === 0 ? Math.max(0, activities.length - 1) : i - 1
              )
            }
            aria-label="上一則課程"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-amber-500 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          {/* 右箭頭 */}
          <button
            type="button"
            onClick={() =>
              setActivityIndex((i) =>
                i >= Math.max(0, activities.length - 1) ? 0 : i + 1
              )
            }
            aria-label="下一則課程"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-md border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-amber-500 hover:text-white transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div
            ref={activityScrollRef}
            className="w-full overflow-x-auto scrollbar-hide px-4 sm:px-12 snap-x snap-mandatory scroll-smooth"
          >
            <div className="flex gap-4 min-w-max py-2">
              {activities.length === 0 ? (
                <div className="shrink-0 w-[280px] snap-start bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
                  尚無課程，請至後台新增課程
                </div>
              ) : (
                activities.map((activity) => {
                const isSoldOut = activity.stock === 0;
                return (
                  <article
                    key={activity.id}
                    className="shrink-0 w-[280px] snap-start bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                  >
                    <div className="aspect-square bg-gray-200 flex items-center justify-center overflow-hidden">
                      {activity.imageUrl ? (
                        <img src={activity.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Image className="w-14 h-14 text-gray-400" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="p-3 flex-1 flex flex-col min-h-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        {activity.category && (
                          <span className="text-xs text-gray-500 truncate">{activity.category}</span>
                        )}
                        {activity.ageTags && activity.ageTags.length > 0 && (
                          <span className="text-xs text-gray-600 shrink-0">
                            {activity.ageTags.join("、")}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-800 line-clamp-2 mb-2 text-sm">
                        {activity.title}
                      </h3>
                      {activity.description && (
                        <p className="text-xs text-gray-600 line-clamp-2 mb-2 leading-relaxed">
                          {activity.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className="text-amber-600 font-semibold text-sm">
                          NT$ {activity.price.toLocaleString()} 起
                        </p>
                        <p
                          className={`text-xs shrink-0 ${
                            isSoldOut ? "text-gray-400" : "text-red-500"
                          }`}
                        >
                          {isSoldOut ? "已售完" : `剩餘人數 ${activity.stock}`}
                        </p>
                      </div>
                      <Link
                        href={activity.detailHref}
                        className={`mt-auto w-full py-2.5 rounded-lg text-sm font-medium text-center transition-colors block ${
                          isSoldOut ? "bg-gray-200 text-gray-500 cursor-not-allowed pointer-events-none" : "bg-amber-500 text-white hover:bg-amber-600"
                        }`}
                      >
                        立即報名
                      </Link>
                    </div>
                  </article>
                );
              })
              )}
            </div>
          </div>
        </div>
        {/* 輪播指示點：點擊可跳至該課程 */}
        <div className="max-w-6xl mx-auto px-4 flex justify-center gap-2 mt-4">
          {activities.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActivityIndex(i)}
              aria-label={`第 ${i + 1} 個課程`}
              className={`h-2 rounded-full transition-all ${
                i === activityIndex ? "w-6 bg-amber-500" : "w-2 bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
        </section>

      {/* 5. 常見問題 */}
      <section id="faq" className="bg-white py-12 px-4 scroll-mt-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">常見問題</h2>
          <FAQ />
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="bg-white border-t border-gray-100 mt-auto">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="text-center text-gray-600 text-sm space-y-2">
            <p>聯絡電話：02-1234-5678</p>
            <p>客服信箱：service@wondervoyage.tw</p>
            <p className="pt-4 text-gray-400">
              © 2026 童趣島 WonderVoyage 版權所有
            </p>
          </div>
        </div>
      </footer>

      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </div>
  );
}
