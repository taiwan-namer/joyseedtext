import { redirect } from "next/navigation";

/** 已併入「對帳明細」/admin/reconciliation */
export default function AdminRevenueRedirectPage() {
  redirect("/admin/reconciliation");
}
