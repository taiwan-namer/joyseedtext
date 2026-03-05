import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminEmailsSet } from "@/lib/auth/middleware";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  console.log("[admin-mw] path=", request.nextUrl.pathname);
  console.log("[admin-mw] user.email=", user?.email);
  console.log("[admin-mw] ADMIN_EMAILS raw=", process.env.ADMIN_EMAILS);

  if (error || !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", "/admin");
    return NextResponse.redirect(url);
  }

  const email = (user.email ?? "").trim().toLowerCase();
  const adminEmails = getAdminEmailsSet();
  if (!email || !adminEmails.has(email)) {
    console.log("[admin-mw] NOT ADMIN -> redirect /");
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
