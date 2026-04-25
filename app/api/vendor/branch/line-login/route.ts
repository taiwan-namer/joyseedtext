import { NextRequest, NextResponse } from "next/server";
import { getHqVendorLineLoginUrl } from "@/lib/hqBranchApi";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export const dynamic = "force-dynamic";

/**
 * 分站 LINE 登入入口：導向總站 LINE 登入頁，並附上回分站 consume route。
 */
export async function GET(request: NextRequest) {
  const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
  if (!merchantId) {
    return NextResponse.json({ error: "未設定 NEXT_PUBLIC_CLIENT_ID" }, { status: 500 });
  }

  const branchOrigin = request.nextUrl.origin;
  const returnTo = new URL("/api/vendor/branch/line-handoff", branchOrigin).toString();
  const loginUrl = new URL(getHqVendorLineLoginUrl());
  loginUrl.searchParams.set("branch_site_merchant_id", merchantId);
  // 兼容不同總站實作可能採用的參數名稱
  loginUrl.searchParams.set("return_to", returnTo);
  loginUrl.searchParams.set("redirect_uri", returnTo);
  loginUrl.searchParams.set("next", returnTo);

  return NextResponse.redirect(loginUrl.toString(), 302);
}
