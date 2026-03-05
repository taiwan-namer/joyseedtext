import { NextResponse } from "next/server";
import svgCaptcha from "svg-captcha";

const CAPTCHA_COOKIE_NAME = "captcha_answer";
const CAPTCHA_MAX_AGE = 120; // 2 分鐘

/**
 * GET /api/captcha
 * 產生一組驗證碼 SVG，並將答案存於 httpOnly cookie，供後端驗證使用。
 */
export async function GET() {
  const captcha = svgCaptcha.create({
    size: 4,
    ignoreChars: "0oO1ilI",
    noise: 2,
    color: true,
    background: "#f3f4f6",
  });

  const response = new NextResponse(captcha.data, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });

  const cookieValue = encodeURIComponent(captcha.text);
  response.cookies.set(CAPTCHA_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CAPTCHA_MAX_AGE,
    path: "/",
  });

  return response;
}
