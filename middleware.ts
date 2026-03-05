import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_SESSION_COOKIE = "admin_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }
  if (pathname === "/admin/login") {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const sessionKey = process.env.ADMIN_SESSION_KEY?.trim();
    if (token && sessionKey && token === sessionKey) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const sessionKey = process.env.ADMIN_SESSION_KEY?.trim();
  if (!sessionKey || token !== sessionKey) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/(.*)"],
};
