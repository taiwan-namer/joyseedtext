"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Menu,
  Store,
  Users,
  FileText,
  Package,
  ShoppingCart,
  MoreHorizontal,
  Zap,
  Megaphone,
  MessageCircle,
  LayoutDashboard,
} from "lucide-react";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";

const SIDEBAR_MENU = [
  { label: "查看前台", href: "/", icon: ExternalLink, newTab: true },
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  {
    label: "我的賣場",
    icon: Store,
    open: true,
    children: [
      { label: "基本資料", href: "/admin/settings", active: false },
      { label: "首頁版面", href: "/admin/layout", active: false },
    ],
  },
  {
    label: "會員項",
    icon: Users,
    open: false,
    children: [{ label: "會員功能管理", href: "/admin/members" }],
  },
  {
    label: "介紹項",
    icon: FileText,
    open: false,
    children: [
      { label: "課程介紹", href: "/admin/intro/courses" },
      { label: "關於我們", href: "/admin/about" },
    ],
  },
  {
    label: "功能項",
    icon: Package,
    open: true,
    children: [
      { label: "商品管理區", href: "/admin", active: true, sub: ["新增課程"] },
    ],
  },
  {
    label: "功能應用項目",
    icon: Zap,
    open: false,
    children: [
      { label: "常見問題", href: "/admin/faq" },
    ],
  },
  {
    label: "行銷項目",
    icon: Megaphone,
    open: false,
    children: [
      { label: "SEO設定", href: "/admin/seo" },
    ],
  },
  {
    label: "訂單綜合項",
    icon: ShoppingCart,
    open: false,
    children: [
      { label: "訂單管理", href: "/admin/bookings" },
      { label: "對帳明細", href: "/admin/reconciliation" },
      { label: "報名進度查詢", href: "/admin/enrollment" },
    ],
  },
  {
    label: "AI客服",
    icon: MessageCircle,
    open: false,
    children: [{ label: "AI客服", href: "/admin/ai-support" }],
  },
  {
    label: "其他功能",
    icon: MoreHorizontal,
    open: false,
    children: [
      { label: "金流／發票設定", href: "/admin/payment-settings" },
      {
        label: "分站供應商綁定",
        href: "/api/admin/branch/vendor-registration-link",
        useNativeAnchor: true,
      },
    ],
  },
];

function Sidebar({
  isOpen,
  onClose,
  isMobile,
}: {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}) {
  const pathname = usePathname();
  const { siteName } = useStoreSettings();
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({
    我的賣場: true,
    會員項: false,
    介紹項: false,
    功能項: true,
    功能應用項目: false,
    行銷項目: false,
    訂單綜合項: false,
    AI客服: false,
    其他功能: false,
  });

  const toggle = (key: string) => {
    setOpenKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!isMobile || !isOpen) return;
    const handler = () => onClose();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [isMobile, isOpen, onClose]);

  const navContent = (
    <>
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <Link href="/admin" prefetch={false} className="text-lg font-bold text-white" onClick={isMobile ? onClose : undefined}>
          {siteName}後台
        </Link>
        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="關閉側欄"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {SIDEBAR_MENU.map((item) => {
          if ("href" in item && item.href && !("children" in item)) {
            const newTab = "newTab" in item && item.newTab;
            const prefetchThis =
              !item.href.startsWith("/admin") || item.href === "/admin/dashboard";
            return (
              <Link
                key={item.label}
                href={item.href}
                prefetch={prefetchThis}
                target={newTab ? "_blank" : undefined}
                rel={newTab ? "noopener noreferrer" : undefined}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-white transition-colors touch-manipulation"
                onClick={isMobile ? onClose : undefined}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          }
          const isOpen = openKeys[item.label] ?? (item as { open?: boolean }).open;
          const children = (item as { children?: { label: string; href?: string; active?: boolean; sub?: string[] }[] }).children || [];
          return (
            <div key={item.label}>
              <button
                type="button"
                onClick={() => toggle(item.label)}
                className="flex items-center justify-between w-full px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
              </button>
              {isOpen && children.length > 0 && (
                <div className="bg-slate-800/50">
                  {children.map((child) => {
                    const href = (child as { href?: string }).href ?? "/admin";
                    const useNativeAnchor = Boolean(
                      (child as { useNativeAnchor?: boolean }).useNativeAnchor
                    );
                    const isActive = pathname === href || (child as { active?: boolean }).active;
                    const itemClass = `flex items-center gap-2 py-2 pl-8 pr-4 text-sm transition-colors touch-manipulation ${
                      isActive
                        ? "bg-amber-600/20 text-amber-400 font-medium"
                        : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                    }`;
                    return (
                    <div key={child.label}>
                      {useNativeAnchor ? (
                        <a
                          href={href}
                          className={itemClass}
                          onClick={isMobile ? onClose : undefined}
                        >
                          <span>{(child as { label: string }).label}</span>
                        </a>
                      ) : (
                      <Link
                        href={href}
                        prefetch={
                          href === "/admin/settings" ||
                          href === "/admin/layout" ||
                          href === "/admin/members" ||
                          href === "/admin/intro/courses" ||
                          href === "/admin/about" ||
                          href === "/admin" ||
                          href === "/admin/faq" ||
                          href === "/admin/seo" ||
                          href === "/admin/bookings" ||
                          href === "/admin/reconciliation" ||
                          href === "/admin/enrollment" ||
                          href === "/admin/payment-settings"
                        }
                        className={itemClass}
                        onClick={isMobile ? onClose : undefined}
                      >
                        <span>{(child as { label: string }).label}</span>
                      </Link>
                      )}
                      {((child as { sub?: string[] }).sub?.length ?? 0) > 0 &&
                        (child as { sub?: string[] }).sub!.map((subLabel) => {
                          const subHref =
                            subLabel === "新增課程"
                              ? "/admin/classes/new"
                              : subLabel === "常見問題"
                                ? "/admin/faq"
                                : "/admin";
                          return (
                          <Link
                            key={subLabel}
                            href={subHref}
                            prefetch={subHref === "/admin/classes/new" || subHref === "/admin/faq"}
                            className="flex items-center gap-2 py-1.5 pl-12 pr-4 text-xs text-slate-400 hover:text-slate-200"
                            onClick={isMobile ? onClose : undefined}
                          >
                            {subLabel}
                          </Link>
                          );
                        })}
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          aria-hidden
          onClick={onClose}
        />
      )}
      <aside
        className={`
          shrink-0 bg-slate-900 text-white flex flex-col min-h-screen
          md:relative md:translate-x-0 md:w-64
          fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-out
          ${isMobile ? (isOpen ? "translate-x-0" : "-translate-x-full") : ""}
        `}
      >
        {navContent}
      </aside>
    </>
  );
}

function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const now = new Date();
  const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 週${["日", "一", "二", "三", "四", "五", "六"][now.getDay()]} ${now.getHours() < 12 ? "上午" : "下午"}${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <header className="h-14 shrink-0 border-b border-gray-200 bg-white flex items-center justify-between gap-4 px-4 md:px-6">
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 md:hidden touch-manipulation"
          aria-label="開啟選單"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}
      <div className="flex-1 flex items-center justify-end gap-2 md:gap-4 min-w-0">
      <span className="text-sm text-gray-500 hidden sm:inline">{dateStr}</span>
      <span className="text-sm text-gray-700">
        歡迎 <strong>管理員</strong> 您好
      </span>
      <Link
        href="/admin/logout"
        prefetch={false}
        className="text-sm text-gray-600 hover:text-amber-600 transition-colors shrink-0"
      >
        登出
      </Link>
      </div>
    </header>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    if (pathname !== "/admin/dashboard") router.prefetch("/admin/dashboard");
    if (pathname !== "/admin/settings") router.prefetch("/admin/settings");
    if (pathname !== "/admin/layout") router.prefetch("/admin/layout");
    if (pathname !== "/admin/members") router.prefetch("/admin/members");
    if (pathname !== "/admin/intro/courses") router.prefetch("/admin/intro/courses");
    if (pathname !== "/admin/about") router.prefetch("/admin/about");
    if (pathname !== "/admin") router.prefetch("/admin");
    if (pathname !== "/admin/classes/new") router.prefetch("/admin/classes/new");
    if (pathname !== "/admin/faq") router.prefetch("/admin/faq");
    if (pathname !== "/admin/seo") router.prefetch("/admin/seo");
    if (pathname !== "/admin/bookings") router.prefetch("/admin/bookings");
    if (pathname !== "/admin/reconciliation") router.prefetch("/admin/reconciliation");
    if (pathname !== "/admin/enrollment") router.prefetch("/admin/enrollment");
    if (pathname !== "/admin/payment-settings") router.prefetch("/admin/payment-settings");
  }, [pathname, router]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar
        isOpen={isMobile ? sidebarOpen : true}
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={isMobile ? () => setSidebarOpen(true) : undefined} />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
