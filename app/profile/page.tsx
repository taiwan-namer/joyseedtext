"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getMyBookings, type BookingWithClass } from "@/app/actions/bookingActions";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { ChevronLeft, Calendar, Package, Loader2, LogOut } from "lucide-react";

type TabKey = "upcoming" | "history";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function BookingCard({ b }: { b: BookingWithClass }) {
  return (
    <div className="flex gap-4 p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden shrink-0">
        {b.class_image_url ? (
          <img src={b.class_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Package className="w-8 h-8" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium text-gray-900 truncate">{b.class_title || "未命名課程"}</h3>
        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
          <Calendar className="w-3.5 h-3.5" />
          {formatDate(b.created_at)}
        </p>
        <p className="text-xs text-gray-400 mt-1">訂單編號：{b.id.slice(0, 8)}…</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { siteName } = useStoreSettings();
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [bookings, setBookings] = useState<BookingWithClass[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        window.location.href = `/login?next=${encodeURIComponent("/profile")}`;
        return;
      }
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    setLoading(true);
    setError(null);
    getMyBookings()
      .then((res) => {
        if (res.success) setBookings(res.data);
        else setError(res.error);
      })
      .finally(() => setLoading(false));
  }, [authChecked]);

  const upcoming = bookings.filter((b) => b.status !== "completed" && b.status !== "cancelled");
  const history = bookings.filter((b) => b.status === "completed" || b.status === "cancelled");

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/"
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              aria-label="返回首頁"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-semibold text-gray-900 truncate">{siteName} 會員中心</h1>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-60"
          >
            <LogOut className="w-4 h-4" />
            登出
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex rounded-t-xl border border-b-0 border-gray-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setTab("upcoming")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              tab === "upcoming"
                ? "bg-amber-500 text-white"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            已購買／即將上課
            {upcoming.length > 0 && (
              <span className="ml-1.5 text-xs opacity-90">({upcoming.length})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              tab === "history"
                ? "bg-amber-500 text-white"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            歷史訂單
            {history.length > 0 && (
              <span className="ml-1.5 text-xs opacity-90">({history.length})</span>
            )}
          </button>
        </div>

        <div className="rounded-b-xl border border-gray-200 border-t-0 bg-white p-4 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : error ? (
            <p className="text-red-600 text-sm py-4">{error}</p>
          ) : tab === "upcoming" ? (
            upcoming.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">尚無即將上課的訂單</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((b) => (
                  <li key={b.id}>
                    <BookingCard b={b} />
                  </li>
                ))}
              </ul>
            )
          ) : (
            history.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">尚無歷史訂單</p>
            ) : (
              <ul className="space-y-3">
                {history.map((b) => (
                  <li key={b.id}>
                    <BookingCard b={b} />
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </main>
    </div>
  );
}
