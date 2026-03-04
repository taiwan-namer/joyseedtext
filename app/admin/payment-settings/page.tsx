"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { getPaymentSettings, updatePaymentSettings } from "@/app/actions/frontendSettingsActions";

export default function PaymentSettingsPage() {
  const router = useRouter();
  const [linePayApi, setLinePayApi] = useState("");
  const [thirdPartyApi, setThirdPartyApi] = useState("");
  const [atmBankName, setAtmBankName] = useState("");
  const [atmBankCode, setAtmBankCode] = useState("");
  const [atmBankAccount, setAtmBankAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getPaymentSettings()
      .then((data) => {
        setLinePayApi(data.linePayApi ?? "");
        setThirdPartyApi(data.thirdPartyApi ?? "");
        setAtmBankName(data.atmBankName ?? "");
        setAtmBankCode(data.atmBankCode ?? "");
        setAtmBankAccount(data.atmBankAccount ?? "");
      })
      .catch((err) => {
        setMessage({ type: "error", text: err?.message ?? "無法載入" });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData();
    formData.set("line_pay_api", linePayApi);
    formData.set("third_party_api", thirdPartyApi);
    formData.set("atm_bank_name", atmBankName);
    formData.set("atm_bank_code", atmBankCode);
    formData.set("atm_bank_account", atmBankAccount);
    startTransition(async () => {
      const result = await updatePaymentSettings(formData);
      if (result.success) {
        setMessage({ type: "success", text: result.message ?? "已儲存" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        載入中…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          返回後台
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900">金流設定</h1>
      <p className="text-sm text-gray-600">
        設定各金流管道之 API 金鑰或設定值，請依各廠商文件填寫。
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {message && (
          <div
            role="alert"
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <div>
            <label htmlFor="line_pay_api" className="mb-2 block text-sm font-medium text-gray-700">
              Line Pay
            </label>
            <textarea
              id="line_pay_api"
              name="line_pay_api"
              value={linePayApi}
              onChange={(e) => setLinePayApi(e.target.value)}
              placeholder="請貼上 Line Pay API 金鑰或設定（可多行）"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y"
              disabled={isPending}
            />
          </div>

          <div>
            <label htmlFor="third_party_api" className="mb-2 block text-sm font-medium text-gray-700">
              第三方金流
            </label>
            <textarea
              id="third_party_api"
              name="third_party_api"
              value={thirdPartyApi}
              onChange={(e) => setThirdPartyApi(e.target.value)}
              placeholder="請貼上第三方金流 API 金鑰或設定（可多行）"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y"
              disabled={isPending}
            />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">ATM 轉帳</h3>
            <p className="text-sm text-gray-500 mb-4">消費者選擇 ATM 付款時，結帳頁將顯示以下資訊供轉帳使用。</p>
            <div className="space-y-4">
              <div>
                <label htmlFor="atm_bank_name" className="mb-1 block text-sm font-medium text-gray-700">
                  1. 銀行單位
                </label>
                <input
                  id="atm_bank_name"
                  name="atm_bank_name"
                  type="text"
                  value={atmBankName}
                  onChange={(e) => setAtmBankName(e.target.value)}
                  placeholder="例：國泰世華銀行"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  disabled={isPending}
                />
              </div>
              <div>
                <label htmlFor="atm_bank_code" className="mb-1 block text-sm font-medium text-gray-700">
                  2. 銀行代碼
                </label>
                <input
                  id="atm_bank_code"
                  name="atm_bank_code"
                  type="text"
                  value={atmBankCode}
                  onChange={(e) => setAtmBankCode(e.target.value)}
                  placeholder="例：013"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  disabled={isPending}
                />
              </div>
              <div>
                <label htmlFor="atm_bank_account" className="mb-1 block text-sm font-medium text-gray-700">
                  3. 銀行帳號
                </label>
                <input
                  id="atm_bank_account"
                  name="atm_bank_account"
                  type="text"
                  value={atmBankAccount}
                  onChange={(e) => setAtmBankAccount(e.target.value)}
                  placeholder="請輸入轉帳用銀行帳號"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isPending ? "儲存中…" : "儲存"}
          </button>
        </div>
      </form>
    </div>
  );
}
