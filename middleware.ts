import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isIndexingAllowed } from "@/lib/siteIndexing";

const ADMIN_SESSION_COOKIE = "admin_session";

/** 與 lib/siteIndexing 相容：未允許索引或 Vercel 預設網域時一律 noindex。 */
function applyRobotsTag(response: NextResponse, request: NextRequest): NextResponse {
  const hostname = request.nextUrl.hostname;
  const isVercelDefaultHost = hostname.includes(".vercel.app");
  if (!isIndexingAllowed() || isVercelDefaultHost) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

function nextWithPathname(request: NextRequest, pathname: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return applyRobotsTag(NextResponse.next({ request: { headers: requestHeaders } }), request);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) {
    return nextWithPathname(request, pathname);
  }
  if (pathname === "/admin/logout") {
    return nextWithPathname(request, pathname);
  }
  if (pathname === "/admin/login") {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const sessionKey = process.env.ADMIN_SESSION_KEY?.trim();
    if (token && sessionKey && token === sessionKey) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return nextWithPathname(request, pathname);
  }
  // 其餘 /admin 由 app/admin/(protected)/layout.tsx 在 Node 環境驗證；傳 pathname 供 redirect 帶 next
  return nextWithPathname(request, pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
