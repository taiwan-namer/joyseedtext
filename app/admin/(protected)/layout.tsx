import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_SESSION_COOKIE = "admin_session";

/**
 * 後台保護區：在 Node 環境驗證 admin session，避免 Edge middleware 讀不到 env 導致重複跳出登入。
 */
export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const sessionKey = process.env.ADMIN_SESSION_KEY?.trim();
  if (!sessionKey || token !== sessionKey) {
    const pathname = (await headers()).get("x-pathname") ?? "/admin";
    const next = pathname.startsWith("/admin") && !pathname.startsWith("//") ? pathname : "/admin";
    redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  }
  return <>{children}</>;
}
