import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  BRANCH_VENDOR_REGISTRATION_MINT_SECRET_ENV,
  getHqConsumeLineHandoffUrl,
} from "@/lib/hqBranchApi";

const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export const dynamic = "force-dynamic";

/**
 * 分站 consume route：將總站帶回的一次性 token 交由總站 consume 驗證，
 * 驗證成功後在分站寫入 admin_session，導向 /admin。
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t")?.trim() ?? "";
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login?error=missing_handoff_token", request.url));
  }

  const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
  const sessionKey = envTrim("ADMIN_SESSION_KEY");
  const mintSecret = envTrim(BRANCH_VENDOR_REGISTRATION_MINT_SECRET_ENV);
  if (!merchantId || !sessionKey || !mintSecret) {
    return NextResponse.redirect(new URL("/admin/login?error=handoff_env_missing", request.url));
  }

  let consumeRes: Response;
  try {
    consumeRes = await fetch(getHqConsumeLineHandoffUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mintSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        branch_site_merchant_id: merchantId,
        branch_origin: request.nextUrl.origin,
      }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.redirect(new URL("/admin/login?error=handoff_network_failed", request.url));
  }

  if (!consumeRes.ok) {
    return NextResponse.redirect(new URL("/admin/login?error=handoff_rejected", request.url));
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, sessionKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return NextResponse.redirect(new URL("/admin", request.url), 302);
}
