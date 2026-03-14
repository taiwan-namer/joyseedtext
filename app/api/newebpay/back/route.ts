import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/appUrl";

/**
 * 藍新 ClientBackURL 專用：使用者取消或返回時藍新可能以 GET 或 POST 導向此 URL。
 * 不讓 POST 打到 /member page，避免 Server Actions 驗證 500。
 * 一律 302 導向 /member。
 */
export async function GET() {
  const appUrl = getAppUrl();
  const target = appUrl ? `${appUrl}/member` : "/member";
  return NextResponse.redirect(target, 302);
}

export async function POST() {
  const appUrl = getAppUrl();
  const target = appUrl ? `${appUrl}/member` : "/member";
  return NextResponse.redirect(target, 302);
}
