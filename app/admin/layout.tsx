import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminShell from "./AdminShell";

const ADMIN_SESSION_COOKIE = "admin_session";

/**
 * 後台 layout：未登入時先於此 redirect 至登入頁，避免先渲染後台殼再跳轉。
 * /admin/login、/admin/logout 不驗證，直接渲染 children。
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "/admin";

  if (pathname === "/admin/login" || pathname === "/admin/logout") {
    return <>{children}</>;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const sessionKey = process.env.ADMIN_SESSION_KEY?.trim();
  if (!sessionKey || token !== sessionKey) {
    const next = pathname.startsWith("/admin") && !pathname.startsWith("//") ? pathname : "/admin";
    redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  }

  return <AdminShell>{children}</AdminShell>;
}
