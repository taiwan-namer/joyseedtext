import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 老師儲存課程時：將總站「列表課」的 inventory 指向本課（本商家 + 本課 id）。
 * 兩個 HQ 欄位需同時有值才會執行。
 */
export async function pushInventoryBindToHqListing(
  supabase: SupabaseClient,
  params: {
    teacherMerchantId: string;
    teacherClassId: string;
    hqListingMerchantId: string | null | undefined;
    hqListingClassId: string | null | undefined;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const hqMid = (params.hqListingMerchantId ?? "").trim();
  const hqCidRaw = (params.hqListingClassId ?? "").trim();
  if (!hqMid || !hqCidRaw) {
    return { ok: true };
  }
  if (!UUID_RE.test(hqCidRaw)) {
    return { ok: false, error: "總站列表課 UUID 格式不正確" };
  }

  const { data, error } = await supabase
    .from("classes")
    .update({
      inventory_merchant_id: params.teacherMerchantId.trim(),
      inventory_class_id: params.teacherClassId.trim(),
    })
    .eq("id", hqCidRaw)
    .eq("merchant_id", hqMid)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return {
      ok: false,
      error:
        "找不到對應的總站列表課程（請向總部確認「總站商家 ID」與「列表課 UUID」是否正確，且 migration 已套用）",
    };
  }
  return { ok: true };
}
