import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStoreSettings } from "@/app/actions/storeSettingsActions";
import { HeaderMember } from "@/app/components/HeaderMember";
import PaymentResultPrefetch from "@/app/components/PaymentResultPrefetch";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { EcpayResultAutoRefresh } from "./EcpayResultAutoRefresh";

export const dynamic = "force-dynamic";

type ResultStatus = "paid" | "unpaid" | "not_found";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

async function getBookingStatus(merchantTradeNo: string | null): Promise<ResultStatus> {
  if (!merchantTradeNo || merchantTradeNo.trim() === "") return "not_found";
  const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
  if (!merchantId) return "not_found";
  const supabase = createServerSupabase();
  const trimmed = merchantTradeNo.trim();

  // 一次依綠界訂單編號取回，再在程式內判斷是否為「本站／本站代銷」；避免分兩次 maybeSingle 在總站代銷情境漏單
  const { data: tradeRows, error: tradeErr } = await supabase
    .from("bookings")
    .select("status, merchant_id, sold_via_merchant_id")
    .eq("ecpay_merchant_trade_no", trimmed);

  if (tradeErr) {
    console.error("[ECPay result page] bookings by trade no error:", tradeErr.message);
  }

  let booking = (tradeRows ?? []).find(
    (r) =>
      (r as { merchant_id?: string }).merchant_id === merchantId ||
      (r as { sold_via_merchant_id?: string | null }).sold_via_merchant_id === merchantId
  ) as { status?: string } | undefined;

  // 全庫此綠界編號僅一筆時直接採用（避免欄位未寫入 sold_via 等邊界仍卡在處理中）
  if (!booking && tradeRows?.length === 1) {
    booking = tradeRows[0] as { status?: string };
  }

  if (booking) {
    const status = (booking as { status?: string }).status ?? "";
    if (status === "paid" || status === "completed") return "paid";
    return "unpaid";
  }

  // 使用者可能先到結果頁，callback 尚未建立/更新訂單；用 pending_payments 判斷是否為剛付款的單
  const { data: pending } = await supabase
    .from("pending_payments")
    .select("id")
    .eq("payment_method", "ecpay")
    .eq("gateway_key", trimmed)
    .eq("merchant_id", merchantId)
    .maybeSingle();

  if (pending) return "unpaid";
  return "not_found";
}

export default async function EcpayResultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, settings] = await Promise.all([searchParams, getStoreSettings()]);
  const merchantTradeNo = typeof params.MerchantTradeNo === "string" ? params.MerchantTradeNo : null;
  const ecpayErr = typeof params.ecpay_err === "string" ? params.ecpay_err : null;
  console.log("[ECPay result page] searchParams keys:", Object.keys(params), "MerchantTradeNo:", merchantTradeNo ?? "(empty)");
  const status = await getBookingStatus(merchantTradeNo);
  console.log("[ECPay result page] DB order status:", status);

  const syncOrCheckmacHint =
    ecpayErr === "sync"
      ? "訂單建立或更新未完成（常見原因：名額已滿）。若已扣款請聯絡客服並提供綠界訂單編號。"
      : ecpayErr === "checkmac"
        ? "付款資料驗證失敗，請勿重複操作並聯絡客服。"
        : null;

  return (
    <div className="min-h-screen flex flex-col bg-page">
      <PaymentResultPrefetch />
      <EcpayResultAutoRefresh active={status === "unpaid"} />
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm shrink-0">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between">
          <Link href="/" prefetch className="text-xl font-bold text-brand">
            {settings.siteName}
          </Link>
          <HeaderMember />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          {status === "paid" && (
            <>
              <CheckCircle className="w-16 h-16 mx-auto text-green-500" strokeWidth={1.5} />
              <h1 className="text-2xl font-bold mt-4 text-gray-800">付款成功</h1>
              <p className="text-gray-600 mt-2">您的訂單已完成付款，可至會員中心查看。</p>
            </>
          )}
          {status === "unpaid" && (
            <>
              <Loader2 className="w-16 h-16 mx-auto text-amber-500 animate-spin" strokeWidth={1.5} />
              <h1 className="text-2xl font-bold mt-4 text-gray-800">處理中</h1>
              <p className="text-gray-600 mt-2">付款結果處理中，請稍後至會員中心確認訂單狀態。</p>
              <p className="text-gray-500 text-sm mt-2">頁面將自動更新數次；若已扣款成功也可手動重新整理。</p>
              {syncOrCheckmacHint && (
                <p className="text-amber-800 text-sm mt-3 px-2 py-2 rounded-lg bg-amber-50 border border-amber-200">
                  {syncOrCheckmacHint}
                </p>
              )}
            </>
          )}
          {status === "not_found" && (
            <>
              <XCircle className="w-16 h-16 mx-auto text-gray-400" strokeWidth={1.5} />
              <h1 className="text-2xl font-bold mt-4 text-gray-800">無法辨識訂單</h1>
              <p className="text-gray-600 mt-2">請從會員中心或首頁重新查詢您的訂單。</p>
            </>
          )}
          <div className="mt-6 flex flex-col items-center gap-2">
            <Link href="/member" prefetch className="text-sm font-medium text-amber-600 hover:text-amber-700">
              前往會員中心
            </Link>
            <Link href="/" prefetch className="text-xs text-gray-400 underline hover:text-gray-600 touch-manipulation">
              返回首頁
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
