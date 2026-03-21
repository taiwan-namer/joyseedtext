"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 綠界 OrderResultURL 有時比背景 ReturnURL 先抵達，訂單尚未寫入 DB 時短暫輪詢 refresh。
 */
export function EcpayResultAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let n = 0;
    const max = 24;
    const id = setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= max) clearInterval(id);
    }, 2500);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
