"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * 非首頁路由載入時預先載入 `/`，點導覽列 Logo／返回首頁時較快（含手機）。
 */
export default function HomeRoutePrefetch() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") {
      router.prefetch("/");
    }
  }, [router, pathname]);

  return null;
}
