"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 付款／預約結果頁：進頁即預載首頁與會員中心，使用者點「返回首頁」或導覽時較快（含手機弱網）。
 */
export default function PaymentResultPrefetch() {
  const router = useRouter();
  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/member");
  }, [router]);
  return null;
}
