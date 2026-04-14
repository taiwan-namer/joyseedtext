import type { SupabaseClient } from "@supabase/supabase-js";

/** 與 DB `bookings.metadata`（jsonb）對齊的拆帳欄位 */
export type BookingCheckoutMetadata = {
  has_peace_addon?: boolean;
  checkout_base_amount?: number;
  checkout_peace_addon_amount?: number;
};

export async function getPeaceAddonPriceForMerchant(
  supabase: SupabaseClient,
  merchantId: string
): Promise<number | null> {
  const { data } = await supabase
    .from("store_settings")
    .select("peace_addon_price")
    .eq("merchant_id", merchantId)
    .maybeSingle();
  const r = data as { peace_addon_price?: number | null } | null;
  if (r?.peace_addon_price == null) return null;
  const n = Number(r.peace_addon_price);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

/** 名稱含「安心包」即視為安心包加購（可搭配 store 單價補 0 元標價） */
const PEACE_ADDON_NAME_RE = /安心包/;

function sumPeaceAddonFromSelection(
  addonIndices: number[] | null,
  classAddonPrices: { name: string; price: number }[] | null,
  storePeaceUnitPrice: number | null
): number {
  if (!addonIndices?.length || !classAddonPrices?.length) return 0;
  let sum = 0;
  for (const i of addonIndices) {
    const a = classAddonPrices[i];
    if (!a || !PEACE_ADDON_NAME_RE.test(String(a.name ?? ""))) continue;
    let p = Number(a.price);
    if (Number.isNaN(p) || p < 0) p = 0;
    if (p === 0 && storePeaceUnitPrice != null && storePeaceUnitPrice > 0) {
      p = storePeaceUnitPrice;
    }
    sum += p;
  }
  return sum;
}

/**
 * 建立寫入 pending／RPC 的 metadata（結帳當下快照）。
 */
export function buildCheckoutMetadataFromOrder(
  orderAmount: number | null,
  addonIndices: number[] | null,
  classAddonPrices: { name: string; price: number }[] | null,
  storePeaceUnitPrice: number | null
): Record<string, unknown> {
  if (orderAmount == null || orderAmount < 0) {
    return { has_peace_addon: false, checkout_base_amount: 0, checkout_peace_addon_amount: 0 };
  }
  const peace = sumPeaceAddonFromSelection(addonIndices, classAddonPrices, storePeaceUnitPrice);
  if (peace <= 0) {
    return {
      has_peace_addon: false,
      checkout_base_amount: orderAmount,
      checkout_peace_addon_amount: 0,
    };
  }
  return {
    has_peace_addon: true,
    checkout_peace_addon_amount: peace,
    checkout_base_amount: Math.max(0, orderAmount - peace),
  };
}

function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

export function metadataHasPeaceForDisplay(m: unknown): boolean {
  if (m == null || typeof m !== "object") return false;
  const o = m as Record<string, unknown>;
  if (o.has_peace_addon === true) return true;
  const p = num(o.checkout_peace_addon_amount);
  return p != null && p > 0;
}

/**
 * 後台「分站應看到」的課程端金額：客付總額扣除 metadata 記載之安心包實付。
 */
export function branchCourseAmountAfterPeaceFromMetadata(
  orderAmount: number,
  metadata: unknown
): number {
  const m = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const peace = num(m.checkout_peace_addon_amount) ?? 0;
  const base = num(m.checkout_base_amount);
  if (peace > 0) return Math.max(0, orderAmount - peace);
  if (base != null && base >= 0 && m.has_peace_addon === true) return base;
  return orderAmount;
}

/**
 * 解析單筆訂單拆帳（後台對帳／顯示）。
 */
export function parseBookingAmountsForAdmin(
  orderAmount: number | null,
  metadata: unknown
): {
  orderAmount: number | null;
  baseAmount: number | null;
  peaceAddonAmount: number;
  hasPeaceAddon: boolean;
} {
  const oa = orderAmount != null && !Number.isNaN(Number(orderAmount)) ? Number(orderAmount) : null;
  const m = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const peace = num(m.checkout_peace_addon_amount) ?? 0;
  const has = m.has_peace_addon === true || peace > 0;
  const base =
    num(m.checkout_base_amount) ?? (oa != null && peace >= 0 ? Math.max(0, oa - peace) : null);
  return {
    orderAmount: oa,
    baseAmount: base,
    peaceAddonAmount: Math.max(0, peace),
    hasPeaceAddon: has,
  };
}
