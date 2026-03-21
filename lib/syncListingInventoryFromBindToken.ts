import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 老師儲存課程時：依總站「列表課」的 `listing_bind_token` 找到該列，並更新：
 * - 列表課：`inventory_merchant_id` / `inventory_class_id` → 本老師課
 * - 本老師課：`hq_listing_merchant_id` / `hq_listing_class_id` → 該列表課
 *
 * 必須使用 {@link createServerSupabase}（`SUPABASE_SERVICE_ROLE_KEY`）呼叫，才能跨商家更新總站列表課並繞過 RLS。
 */
export async function syncListingInventoryFromBindToken(
  supabase: SupabaseClient,
  params: {
    teacherMerchantId: string;
    teacherClassId: string;
    bindToken: string | null | undefined;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = (params.bindToken ?? "").trim();
  if (!token) {
    return { ok: true };
  }

  const tid = params.teacherClassId.trim();
  const tmid = params.teacherMerchantId.trim();

  const { data: rows, error: findErr } = await supabase
    .from("classes")
    .select("id, merchant_id")
    .eq("listing_bind_token", token)
    .limit(2);

  if (findErr) {
    return { ok: false, error: findErr.message };
  }
  if (!rows?.length) {
    return {
      ok: false,
      error:
        "找不到與此配對碼相符的總站列表課（請向總部確認配對碼，且總站已設定 listing_bind_token）",
    };
  }
  if (rows.length > 1) {
    return { ok: false, error: "配對碼對應多筆列表課，請聯繫技術人員" };
  }

  const listing = rows[0] as { id: string; merchant_id: string };

  const { error: invErr } = await supabase
    .from("classes")
    .update({
      inventory_merchant_id: tmid,
      inventory_class_id: tid,
    })
    .eq("id", listing.id)
    .eq("merchant_id", listing.merchant_id);

  if (invErr) {
    return { ok: false, error: invErr.message };
  }

  const { data: teacherAfter, error: hqErr } = await supabase
    .from("classes")
    .update({
      hq_listing_merchant_id: listing.merchant_id,
      hq_listing_class_id: listing.id,
    })
    .eq("id", tid)
    .eq("merchant_id", tmid)
    .select("id")
    .maybeSingle();

  if (hqErr) {
    return { ok: false, error: hqErr.message };
  }
  if (!teacherAfter) {
    return {
      ok: false,
      error: "無法更新本課總站對應欄位（請確認課程已正確建立且屬於本商家）",
    };
  }

  return { ok: true };
}
