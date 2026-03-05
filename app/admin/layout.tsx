"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  ExternalLink,
  Store,
  Users,
  FileText,
  Package,
  ShoppingCart,
  MoreHorizontal,
  Zap,
  Megaphone,
} from "lucide-react";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";

const SIDEBAR_MENU = [
  { label: "查看前台", href: "/", icon: ExternalLink, newTab: true },
  {
    label: "我的賣場",
    icon: Store,
    open: true,
    children: [
      { label: "基本資料", href: "/admin/settings", active: false },
      { label: "前台設定", href: "/admin/frontend-settings", active: false },
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
      { label: "商品管理區", href: "/admin", active: true, sub: ["新增課程", "價格組合設定"] },
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
      { label: "報名進度查詢", href: "/admin/enrollment" },
    ],
  },
  {
    label: "其他功能",
    icon: MoreHorizontal,
    open: false,
    children: [
      { label: "金流設定", href: "/admin/payment-settings" },
    ],
  },
];

function Sidebar() {
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
    其他功能: false,
  });

  const toggle = (key: string) => {
    setOpenKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside className="w-64 shrink-0 bg-slate-900 text-white flex flex-col min-h-screen">
      <div className="p-4 border-b border-slate-700">
        <Link href="/admin" className="text-lg font-bold text-white">
          {siteName}後台
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {SIDEBAR_MENU.map((item) => {
          if ("href" in item && item.href && !("children" in item)) {
            const newTab = "newTab" in item && item.newTab;
            return (
              <Link
                key={item.label}
                href={item.href}
                target={newTab ? "_blank" : undefined}
                rel={newTab ? "noopener noreferrer" : undefined}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 hover:text-white transition-colors"
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
                    const isActive = pathname === href || (child as { active?: boolean }).active;
                    return (
                    <div key={child.label}>
                      <Link
                        href={href}
                        className={`flex items-center gap-2 py-2 pl-8 pr-4 text-sm transition-colors ${
                          isActive
                            ? "bg-amber-600/20 text-amber-400 font-medium"
                            : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                        }`}
                      >
                        <span>{(child as { label: string }).label}</span>
                      </Link>
                      {((child as { sub?: string[] }).sub?.length ?? 0) > 0 &&
                        (child as { sub?: string[] }).sub!.map((subLabel) => (
                          <Link
                            key={subLabel}
                            href={subLabel === "新增課程" ? "/admin/classes/new" : subLabel === "常見問題" ? "/admin/faq" : "#"}
                            className="flex items-center gap-2 py-1.5 pl-12 pr-4 text-xs text-slate-400 hover:text-slate-200"
                          >
                            {subLabel}
                          </Link>
                        ))}
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function TopBar() {
  const now = new Date();
  const dateStr = `${now.getMonth() + 1}月${now.getDate()}日 週${["日", "一", "二", "三", "四", "五", "六"][now.getDay()]} ${now.getHours() < 12 ? "上午" : "下午"}${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <header className="h-14 shrink-0 border-b border-gray-200 bg-white flex items-center justify-end gap-4 px-6">
      <span className="text-sm text-gray-500">{dateStr}</span>
      <span className="text-sm text-gray-700">
        歡迎 <strong>管理員</strong> 您好
      </span>
      <Link
        href="/admin/logout"
        className="text-sm text-gray-600 hover:text-amber-600 transition-colors"
      >
        登出
      </Link>
    </header>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
