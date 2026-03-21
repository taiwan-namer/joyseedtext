import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 後台／會員中心：可見訂單 = 庫存擁有者為本商家，或經由本商家網站售出（總站代銷）。
 * 用於 Supabase .or() filter。
 */
export function bookingsVisibleToMerchantOrFilter(merchantId: string): string {
  return `merchant_id.eq.${merchantId},sold_via_merchant_id.eq.${merchantId}`;
}

/**
 * 後台訂單列表專用：在 {@link bookingsVisibleToMerchantOrFilter} 之外，再納入
 * 「本商家列表課程所綁定之庫存課程」上的訂單。
 * 用於 sold_via_merchant_id 為 null（舊資料或未套用跨店 RPC）時，總站後台仍能對應到實際成交的庫存訂單。
 */
export async function buildAdminBookingsOrClause(
  supabase: SupabaseClient,
  merchantId: string
): Promise<string> {
  const base = bookingsVisibleToMerchantOrFilter(merchantId);
  const { data: listingRows } = await supabase
    .from("classes")
    .select("inventory_merchant_id, inventory_class_id")
    .eq("merchant_id", merchantId)
    .not("inventory_merchant_id", "is", null)
    .not("inventory_class_id", "is", null);

  const extras: string[] = [];
  for (const row of listingRows ?? []) {
    const r = row as { inventory_merchant_id?: string | null; inventory_class_id?: string | null };
    const m = typeof r.inventory_merchant_id === "string" ? r.inventory_merchant_id.trim() : "";
    const c = r.inventory_class_id != null ? String(r.inventory_class_id).trim() : "";
    if (!m || !c) continue;
    extras.push(`and(merchant_id.eq.${m},class_id.eq.${c})`);
  }

  return extras.length > 0 ? `${base},${extras.join(",")}` : base;
}
