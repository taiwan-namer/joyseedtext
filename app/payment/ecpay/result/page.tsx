import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStoreSettings } from "@/app/actions/storeSettingsActions";
import { HeaderMember } from "@/app/components/HeaderMember";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

type ResultStatus = "paid" | "unpaid" | "not_found";

async function getBookingStatus(merchantTradeNo: string | null): Promise<ResultStatus> {
  if (!merchantTradeNo || merchantTradeNo.trim() === "") return "not_found";
  const supabase = createServerSupabase();
  const trimmed = merchantTradeNo.trim();

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("status")
    .eq("ecpay_merchant_trade_no", trimmed)
    .maybeSingle();

  if (!error && booking) {
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
  console.log("[ECPay result page] searchParams keys:", Object.keys(params), "MerchantTradeNo:", merchantTradeNo ?? "(empty)");
  const status = await getBookingStatus(merchantTradeNo);
  console.log("[ECPay result page] DB order status:", status);

  return (
    <div className="min-h-screen flex flex-col bg-page">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm shrink-0">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-brand">
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
            <Link href="/member" className="text-sm font-medium text-amber-600 hover:text-amber-700">
              前往會員中心
            </Link>
            <Link href="/" className="text-xs text-gray-400 underline hover:text-gray-600">
              返回首頁
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
