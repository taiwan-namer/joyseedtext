"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, X } from "lucide-react";
import { getPaymentSettings, updatePaymentSettings } from "@/app/actions/frontendSettingsActions";

type InvoiceProvider = "ecpay" | "ezpay";

export default function PaymentSettingsPage() {
  const router = useRouter();
  const [paymentNewebpayEnabled, setPaymentNewebpayEnabled] = useState(false);
  const [paymentEcpayEnabled, setPaymentEcpayEnabled] = useState(false);
  const [paymentLinepayEnabled, setPaymentLinepayEnabled] = useState(false);
  const [paymentAtmEnabled, setPaymentAtmEnabled] = useState(false);
  const [atmBankName, setAtmBankName] = useState("");
  const [atmBankCode, setAtmBankCode] = useState("");
  const [atmBankAccount, setAtmBankAccount] = useState("");
  const [invoiceProvider, setInvoiceProvider] = useState<InvoiceProvider>("ecpay");
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceProvider>("ecpay");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPaymentSettings()
      .then((data) => {
        if (cancelled) return;
        setPaymentNewebpayEnabled(data.paymentNewebpayEnabled ?? false);
        setPaymentEcpayEnabled(data.paymentEcpayEnabled ?? false);
        setPaymentLinepayEnabled(data.paymentLinepayEnabled ?? false);
        setPaymentAtmEnabled(data.paymentAtmEnabled ?? false);
        setAtmBankName(data.atmBankName ?? "");
        setAtmBankCode(data.atmBankCode ?? "");
        setAtmBankAccount(data.atmBankAccount ?? "");
        setInvoiceProvider(data.invoiceProvider === "ezpay" ? "ezpay" : "ecpay");
      })
      .catch((err) => {
        if (cancelled) return;
        setMessage({ type: "error", text: err?.message ?? "無法載入" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData();
    formData.set("payment_newebpay_enabled", paymentNewebpayEnabled ? "1" : "0");
    formData.set("payment_ecpay_enabled", paymentEcpayEnabled ? "1" : "0");
    formData.set("payment_linepay_enabled", paymentLinepayEnabled ? "1" : "0");
    formData.set("payment_atm_enabled", paymentAtmEnabled ? "1" : "0");
    formData.set("atm_bank_name", atmBankName);
    formData.set("atm_bank_code", atmBankCode);
    formData.set("atm_bank_account", atmBankAccount);
    formData.set("invoice_provider", invoiceProvider);
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

  const invoiceProviderLabel = (p: InvoiceProvider) =>
    p === "ezpay" ? "藍新 ezPay" : "綠界 ECPay";

  const openInvoiceModal = () => {
    setInvoiceDraft(invoiceProvider);
    setInvoiceModalOpen(true);
  };

  const confirmInvoiceProvider = () => {
    setInvoiceProvider(invoiceDraft);
    setInvoiceModalOpen(false);
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
      <h1 className="text-xl font-bold text-gray-900">金流／發票設定</h1>
      <p className="text-sm text-gray-600">
        開啟／關閉各付款方式，結帳頁將只顯示已開啟的選項；並選擇付款成功後由哪一廠商開立電子發票。API 由系統環境變數設定，此處不需填寫。ATM
        轉帳開啟時請填寫銀行資訊，結帳頁會顯示給消費者。
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
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <h3 className="text-base font-semibold text-gray-900">藍新 NewebPay</h3>
              <p className="text-sm text-gray-500 mt-0.5">結帳頁顯示「ATM (藍新)」選項</p>
            </div>
            <Toggle
              checked={paymentNewebpayEnabled}
              onChange={setPaymentNewebpayEnabled}
              disabled={isPending}
            />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <h3 className="text-base font-semibold text-gray-900">綠界 ECPay</h3>
              <p className="text-sm text-gray-500 mt-0.5">結帳頁顯示「信用卡 (綠界)」選項</p>
            </div>
            <Toggle
              checked={paymentEcpayEnabled}
              onChange={setPaymentEcpayEnabled}
              disabled={isPending}
            />
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <h3 className="text-base font-semibold text-gray-900">LINE Pay</h3>
              <p className="text-sm text-gray-500 mt-0.5">結帳頁顯示「Line Pay」選項</p>
            </div>
            <Toggle
              checked={paymentLinepayEnabled}
              onChange={setPaymentLinepayEnabled}
              disabled={isPending}
            />
          </div>
          <div className="py-2 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">ATM 銀行轉帳</h3>
                <p className="text-sm text-gray-500 mt-0.5">結帳頁顯示「ATM 銀行轉帳」；開啟時需填寫銀行資訊</p>
              </div>
              <Toggle
                checked={paymentAtmEnabled}
                onChange={setPaymentAtmEnabled}
                disabled={isPending}
              />
            </div>
            {paymentAtmEnabled && (
              <div className="mt-4 pl-0 space-y-4 rounded-lg bg-gray-50 p-4">
                <div>
                  <label htmlFor="atm_bank_name" className="mb-1 block text-sm font-medium text-gray-700">
                    銀行單位
                  </label>
                  <input
                    id="atm_bank_name"
                    name="atm_bank_name"
                    type="text"
                    value={atmBankName}
                    onChange={(e) => setAtmBankName(e.target.value)}
                    placeholder="例：國泰世華銀行"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    disabled={isPending}
                  />
                </div>
                <div>
                  <label htmlFor="atm_bank_code" className="mb-1 block text-sm font-medium text-gray-700">
                    銀行代碼
                  </label>
                  <input
                    id="atm_bank_code"
                    name="atm_bank_code"
                    type="text"
                    value={atmBankCode}
                    onChange={(e) => setAtmBankCode(e.target.value)}
                    placeholder="例：013"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    disabled={isPending}
                  />
                </div>
                <div>
                  <label htmlFor="atm_bank_account" className="mb-1 block text-sm font-medium text-gray-700">
                    銀行帳號
                  </label>
                  <input
                    id="atm_bank_account"
                    name="atm_bank_account"
                    type="text"
                    value={atmBankAccount}
                    onChange={(e) => setAtmBankAccount(e.target.value)}
                    placeholder="請輸入轉帳用銀行帳號"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    disabled={isPending}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900">發票開立廠商</h2>
          <p className="text-xs text-gray-500">
            付款成功後依此廠商開立電子發票。品項固定為單筆「課程預約」（單位：堂），金額依訂單金額。
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray-700">
              目前：<span className="font-semibold text-gray-900">{invoiceProviderLabel(invoiceProvider)}</span>
            </p>
            <button
              type="button"
              onClick={openInvoiceModal}
              disabled={isPending}
              className="inline-flex items-center rounded-lg border border-amber-500 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              選擇發票廠商
            </button>
          </div>
        </section>

        {invoiceModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-provider-dialog-title"
            onClick={() => setInvoiceModalOpen(false)}
          >
            <div
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 id="invoice-provider-dialog-title" className="text-lg font-semibold text-gray-900">
                  選擇發票開立廠商
                </h3>
                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                  aria-label="關閉"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600">請選擇付款成功後由哪一廠商開立電子發票。</p>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50/50">
                  <input
                    type="radio"
                    name="invoice_provider_choice"
                    className="mt-1 text-amber-600 focus:ring-amber-500"
                    checked={invoiceDraft === "ecpay"}
                    onChange={() => setInvoiceDraft("ecpay")}
                  />
                  <span>
                    <span className="font-medium text-gray-900">綠界 ECPay</span>
                    <span className="block text-xs text-gray-500 mt-0.5">常見於已串接綠界金流之站點</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50/50">
                  <input
                    type="radio"
                    name="invoice_provider_choice"
                    className="mt-1 text-amber-600 focus:ring-amber-500"
                    checked={invoiceDraft === "ezpay"}
                    onChange={() => setInvoiceDraft("ezpay")}
                  />
                  <span>
                    <span className="font-medium text-gray-900">藍新 ezPay</span>
                    <span className="block text-xs text-gray-500 mt-0.5">常見於已串接藍新之站點</span>
                  </span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={confirmInvoiceProvider}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600"
                >
                  確定
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-60 touch-manipulation min-h-[44px] min-w-[120px]"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isPending ? "儲存中…" : "儲存"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 ${
        checked ? "bg-amber-500" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}
