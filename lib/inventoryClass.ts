import type { SupabaseClient } from "@supabase/supabase-js";

/** 總站「列表課程」可指向老師端課程作為唯一庫存來源 */
export type InventoryResolution = {
  listingMerchantId: string;
  listingClassId: string;
  inventoryMerchantId: string;
  inventoryClassId: string;
  /** 非 null 表示訂單經由列表商家（例如總站）售出，庫存歸 inventory */
  soldViaMerchantId: string | null;
};

export function resolveInventoryFromClassRow(row: {
  id: string;
  merchant_id: string;
  inventory_merchant_id?: string | null;
  inventory_class_id?: string | null;
}): InventoryResolution {
  const invMid = typeof row.inventory_merchant_id === "string" ? row.inventory_merchant_id.trim() : "";
  const invCid = row.inventory_class_id;
  if (invMid && invCid) {
    return {
      listingMerchantId: row.merchant_id,
      listingClassId: row.id,
      inventoryMerchantId: invMid,
      inventoryClassId: String(invCid),
      soldViaMerchantId: row.merchant_id,
    };
  }
  return {
    listingMerchantId: row.merchant_id,
    listingClassId: row.id,
    inventoryMerchantId: row.merchant_id,
    inventoryClassId: row.id,
    soldViaMerchantId: null,
  };
}

/**
 * 依列表課程 id + 列表商家 id 解析庫存課程；查無列回傳 null。
 */
export async function fetchInventoryResolution(
  supabase: SupabaseClient,
  listingMerchantId: string,
  listingClassId: string
): Promise<InventoryResolution | null> {
  const { data, error } = await supabase
    .from("classes")
    .select("id, merchant_id, inventory_merchant_id, inventory_class_id")
    .eq("id", listingClassId)
    .eq("merchant_id", listingMerchantId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as {
    id: string;
    merchant_id: string;
    inventory_merchant_id?: string | null;
    inventory_class_id?: string | null;
  };
  return resolveInventoryFromClassRow(row);
}
