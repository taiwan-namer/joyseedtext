"use client";

import { useParams, usePathname } from "next/navigation";
import { useMemo } from "react";

function decodeSeg(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * 課程動態路由的 slug：優先 useParams，並以網址路徑後備。
 * 避免部分環境（含部署／水合）下 params 短暫為空，導致 useEffect 早退而永遠「載入中」。
 */
export function useCourseSlugParam(): string | undefined {
  const params = useParams();
  const pathname = usePathname() ?? "";

  return useMemo(() => {
    const raw = params?.slug;
    if (typeof raw === "string" && raw.length > 0) return decodeSeg(raw);
    if (Array.isArray(raw) && raw[0] != null && String(raw[0]).length > 0) {
      return decodeSeg(String(raw[0]));
    }
    const m = pathname.match(/^\/course\/([^/]+)/);
    if (m?.[1]) return decodeSeg(m[1]);
    return undefined;
  }, [params, pathname]);
}
