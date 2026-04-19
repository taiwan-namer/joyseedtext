import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import {
  HQ_ADMIN_SESSION_KEY_ENV,
  HQ_MINT_URL,
} from "@/lib/hqBranchApi";

/** 總站網域；mint 若回傳相對路徑，需補成絕對網址（NextResponse.redirect 只接受絕對 URL）。 */
const HQ_ORIGIN = new URL(HQ_MINT_URL).origin;

export const dynamic = "force-dynamic";

/**
 * 將總站回傳的 url 轉成絕對網址；相對路徑則以 {@link HQ_ORIGIN} 為基底。
 */
function toAbsoluteHqUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    if (/^https?:\/\//i.test(t)) {
      return new URL(t).toString();
    }
    const path = t.startsWith("/") ? t : `/${t}`;
    return new URL(path, HQ_ORIGIN).toString();
  } catch {
    return null;
  }
}

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * GET /api/admin/branch/vendor-registration-link
 * 已登入後台者：向總站換取一次性註冊連結，302 導向至帶 token 的總站供應商註冊頁。
 */
export async function GET(request: NextRequest) {
  try {
    try {
      await verifyAdminSession();
    } catch (e) {
      if (e instanceof Error && e.message === "Unauthorized admin access") {
        const login = new URL("/admin/login", request.url);
        login.searchParams.set("next", "/api/admin/branch/vendor-registration-link");
        return NextResponse.redirect(login);
      }
      throw e;
    }

    const branchSiteMerchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!branchSiteMerchantId) {
      return NextResponse.json({ error: "未設定店家代碼（NEXT_PUBLIC_CLIENT_ID）" }, { status: 500 });
    }

    const bearer = envTrim(HQ_ADMIN_SESSION_KEY_ENV);
    if (!bearer) {
      console.error(`[branch/vendor-registration-link] ${HQ_ADMIN_SESSION_KEY_ENV} is not set`);
      return NextResponse.json(
        { error: "分站尚未設定總站授權，請聯絡管理員" },
        { status: 503 }
      );
    }

    let res: Response;
    try {
      res = await fetch(HQ_MINT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branch_site_merchant_id: branchSiteMerchantId }),
        cache: "no-store",
      });
    } catch (err) {
      console.error("[branch/vendor-registration-link] fetch failed", err);
      return NextResponse.json({ error: "無法連線至總站，請稍後再試" }, { status: 502 });
    }

    if (!res.ok) {
      let bodySnippet = "";
      try {
        bodySnippet = (await res.text()).slice(0, 500);
      } catch {
        /* ignore */
      }
      console.error("[branch/vendor-registration-link] HQ error", res.status, bodySnippet);

      if (res.status === 401) {
        return NextResponse.json({ error: "總站授權失敗，請聯絡管理員" }, { status: 502 });
      }
      if (res.status === 400) {
        return NextResponse.json(
          { error: "店家代碼在總站查無資料或參數無效" },
          { status: 400 }
        );
      }
      if (res.status === 503) {
        return NextResponse.json({ error: "總站服務暫時無法使用，請稍後再試" }, { status: 503 });
      }
      return NextResponse.json({ error: "取得註冊連結失敗，請稍後再試" }, { status: 502 });
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      console.error("[branch/vendor-registration-link] invalid JSON from HQ");
      return NextResponse.json({ error: "總站回應異常" }, { status: 502 });
    }

    const rawUrl =
      typeof data === "object" &&
      data !== null &&
      "url" in data &&
      typeof (data as { url: unknown }).url === "string"
        ? (data as { url: string }).url
        : "";

    const absoluteUrl = toAbsoluteHqUrl(rawUrl);
    if (!absoluteUrl) {
      return NextResponse.json({ error: "未取得有效連結" }, { status: 502 });
    }

    return NextResponse.redirect(absoluteUrl, 302);
  } catch (err) {
    console.error("[branch/vendor-registration-link] unhandled", err);
    return NextResponse.json(
      { error: "處理請求時發生錯誤，請稍後再試或聯絡管理員" },
      { status: 500 }
    );
  }
}
