import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

const AUTH_RETURN_TO_COOKIE = "auth_return_to";

/**
 * OAuth 登入回呼：交換 code 取得 session，並以 upsert 同步寫入 members 表。
 * 導向目標優先從 cookie auth_return_to 讀取（避免 OAuth 導回時 query 被 stripping 導致結帳頁遺失），
 * 其次 ?next=，否則為首頁。
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const cookieStore = await cookies();
  const cookieNext = cookieStore.get(AUTH_RETURN_TO_COOKIE)?.value;
  const decodedCookie = typeof cookieNext === "string" && cookieNext ? decodeURIComponent(cookieNext) : "";
  const paramNext = requestUrl.searchParams.get("next") ?? "";
  const nextRaw = decodedCookie || paramNext || "/";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", requestUrl.origin));
  }

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Route Handler 可寫入 cookie
          }
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabaseAuth.auth.exchangeCodeForSession(code);

  if (authError || !user) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", requestUrl.origin));
  }

  const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
  const email = user.email ?? "";
  const name =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    email.split("@")[0] ||
    "會員";

  if (merchantId && email) {
    const supabaseAdmin = createServerSupabase();
    await supabaseAdmin.from("members").upsert(
      {
        merchant_id: merchantId,
        name: name.trim() || null,
        phone: null,
        email: email.trim(),
      },
      { onConflict: "merchant_id,email" }
    );
  }

  const response = NextResponse.redirect(new URL(next, requestUrl.origin));
  response.cookies.set(AUTH_RETURN_TO_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
