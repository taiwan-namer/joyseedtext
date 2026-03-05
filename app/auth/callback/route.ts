import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * OAuth 登入回呼：交換 code 取得 session，並以 upsert 同步寫入 members 表。
 * merchant_id 強制使用 process.env.NEXT_PUBLIC_CLIENT_ID。
 * 使用 upsert 避免重複登入／註冊觸發 UNIQUE 錯誤，僅保留一筆最新紀錄。
 * 完成後導向首頁 (/) 或會員中心 (/profile)，可透過 ?next=/profile 指定。
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextRaw = requestUrl.searchParams.get("next") ?? "/";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", requestUrl.origin));
  }

  const cookieStore = await cookies();

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

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
