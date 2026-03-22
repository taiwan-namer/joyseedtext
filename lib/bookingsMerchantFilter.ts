import type { SupabaseClient } from "@supabase/supabase-js";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * 後台／會員中心：可見訂單 = 庫存擁有者為本商家，或經由本商家網站售出（總站代銷）。
 * 用於 Supabase .or() filter。
 */
export function bookingsVisibleToMerchantOrFilter(merchantId: string): string {
  return `merchant_id.eq.${merchantId},sold_via_merchant_id.eq.${merchantId}`;
}

/**
 * 若設定：後台訂單／匯出／待付款篩選**僅**顯示 `class_creator_merchant_id` 等於此值的訂單（開課商家 id），
 * 不再用 `BOOKINGS_ADMIN_VISIBLE_MERCHANT_IDS` 整包撈 MODEL 下所有訂單。
 */
export function getOrderAdminClassCreatorMerchantIdFilter(): string | null {
  const v = envTrim("BOOKINGS_ORDER_ADMIN_CLASS_CREATOR_MERCHANT_ID");
  return v.length > 0 ? v : null;
}

export type AdminBookingsAccessFilter =
  | { mode: "class_creator"; merchantId: string }
  | { mode: "merchant_scope"; orClause: string };

/**
 * 後台訂單列／變更所用篩選：優先「開課商家」精準篩選，否則沿用多 merchant OR（含列表課庫存）。
 */
export async function getAdminBookingsAccessFilter(
  supabase: SupabaseClient
): Promise<AdminBookingsAccessFilter | null> {
  const creator = getOrderAdminClassCreatorMerchantIdFilter();
  if (creator) return { mode: "class_creator", merchantId: creator };
  const orClause = await buildAdminBookingsOrClause(supabase);
  if (!orClause) return null;
  return { mode: "merchant_scope", orClause };
}

/**
 * 後台訂單／匯出：可見的商家 id 清單。
 * - 必含 `NEXT_PUBLIC_CLIENT_ID`
 * - 可選 `BOOKINGS_ADMIN_VISIBLE_MERCHANT_IDS`（逗號或換行分隔），用於同一 Supabase、多站台下單時合併顯示
 */
export function getAdminBookingMerchantScope(): string[] {
  const primary = envTrim("NEXT_PUBLIC_CLIENT_ID");
  const raw = envTrim("BOOKINGS_ADMIN_VISIBLE_MERCHANT_IDS");
  const extras = raw.length > 0 ? raw.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean) : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of [primary, ...extras]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * 後台訂單列表專用：合併
 * 1) 範圍內各商家的 merchant_id／sold_via
 * 2) 各商家「列表課 → 庫存課」綁定所對應之庫存訂單（補 sold_via 為 null 的舊資料）
 */
export async function buildAdminBookingsOrClause(supabase: SupabaseClient): Promise<string> {
  const scope = getAdminBookingMerchantScope();
  if (scope.length === 0) return "";

  const base = scope.map((id) => bookingsVisibleToMerchantOrFilter(id)).join(",");

  const seenPair = new Set<string>();
  const invFilters: string[] = [];
  for (const mid of scope) {
    const { data: listingRows } = await supabase
      .from("classes")
      .select("inventory_merchant_id, inventory_class_id")
      .eq("merchant_id", mid)
      .not("inventory_merchant_id", "is", null)
      .not("inventory_class_id", "is", null);

    for (const row of listingRows ?? []) {
      const r = row as { inventory_merchant_id?: string | null; inventory_class_id?: string | null };
      const m = typeof r.inventory_merchant_id === "string" ? r.inventory_merchant_id.trim() : "";
      const c = r.inventory_class_id != null ? String(r.inventory_class_id).trim() : "";
      if (!m || !c) continue;
      const key = `${m}|${c}`;
      if (seenPair.has(key)) continue;
      seenPair.add(key);
      invFilters.push(`and(merchant_id.eq.${m},class_id.eq.${c})`);
    }
  }

  return invFilters.length > 0 ? `${base},${invFilters.join(",")}` : base;
}

/**
 * 儀表板營收 API：將後台訂單可見範圍套到查詢上（與 `getAdminBookings` 一致）。
 * 必須為**同步**函式：Postgrest 查詢建構子帶 `then`，若從 `async function` `return` 會被當成 Promise 先執行，導致後續 `.in()` 報錯。
 *
 * 用法：`const access = await getAdminBookingsAccessFilter(supabase); if (!access) ...; const q = applyAdminBookingsAccessToQuery(supabase.from(...).select(...), access);`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyAdminBookingsAccessToQuery(query: any, access: AdminBookingsAccessFilter): any {
  if (access.mode === "class_creator") {
    return query.eq("class_creator_merchant_id", access.merchantId);
  }
  return query.or(access.orClause);
}
