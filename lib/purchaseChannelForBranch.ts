import { MARKETPLACE_MERCHANT_ID } from "@/lib/constants";

export type PurchaseChannelBranch = "hq" | "local";

/**
 * 分站後台判斷「總站購買 vs 本站購買」：與 {@link buildReconciliationLines}／對帳 API 相同。
 *
 * - `sold_via_merchant_id === model`（總站）→ hq
 * - `sold_via_merchant_id === branchMerchantId` → local
 * - **未填 sold_via**：若庫存 `merchant_id === branchMerchantId` → local，否則視為 hq（舊資料／代銷情境）
 * - 其餘 sold 值 → local
 */
export function classifyPurchaseChannelForBranchAdmin(
  branchMerchantId: string,
  row: { sold_via_merchant_id?: string | null; merchant_id?: string | null }
): PurchaseChannelBranch {
  const hq = MARKETPLACE_MERCHANT_ID.trim();
  const sold = (row.sold_via_merchant_id ?? "").trim();
  const merchant = (row.merchant_id ?? "").trim();
  if (sold === hq) return "hq";
  if (sold === branchMerchantId) return "local";
  if (!sold) {
    return merchant === branchMerchantId ? "local" : "hq";
  }
  return "local";
}
