import { redirect } from "next/navigation";

/** 發票開立廠商已併入「金流／發票設定」；保留路徑以免書籤失效 */
export default function InvoiceSettingsRedirectPage() {
  redirect("/admin/payment-settings");
}
