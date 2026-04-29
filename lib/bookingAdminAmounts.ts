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
 * 後台對帳用：將訂單拆成「課程金額」與「安心包（官網加購）」。
 * 依賴結帳寫入的 metadata.checkout_base_amount / checkout_peace_addon_amount；
 * 舊訂單或無拆項時整筆視為課程金額（可傳 classPriceFallback）。
 */
export type ParsedBookingAmounts = {
  courseAmount: number;
  peaceAddonAmount: number;
  orderTotal: number;
};

function coerceMetadataObject(metadata: unknown): Record<string, unknown> | null {
  if (metadata == null) return null;
  if (typeof metadata === "string") {
    try {
      const p = JSON.parse(metadata) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      return null;
    }
    return null;
  }
  if (typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return null;
}

function isPeaceAddonFlag(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

function metaInt(meta: Record<string, unknown>, key: string): number {
  const v = meta[key];
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function amountsClose(a: number, b: number, tol = 1): boolean {
  return Math.abs(a - b) <= tol;
}

/**
 * 是否為「有加購安心包」之訂單（供後台列表／匯出篩選）。
 */
export function bookingHasPeaceAddonPurchase(
  orderAmount: number | null | undefined,
  metadata: unknown,
  classPriceFallback: number | null | undefined
): boolean {
  const parsed = parseBookingAmountsForAdmin(orderAmount, metadata, classPriceFallback);
  if (parsed.peaceAddonAmount > 0) return true;
  const meta = coerceMetadataObject(metadata);
  if (!meta || !isPeaceAddonFlag(meta.has_peace_addon)) return false;
  const peaceRaw = meta.checkout_peace_addon_amount;
  const peace = typeof peaceRaw === "number" ? peaceRaw : Number(peaceRaw);
  return Number.isFinite(peace) && peace > 0;
}

export function parseBookingAmountsForAdmin(
  orderAmount: number | null | undefined,
  metadata: unknown,
  classPriceFallback: number | null | undefined
): ParsedBookingAmounts {
  const fallback =
    classPriceFallback != null && Number.isFinite(Number(classPriceFallback))
      ? Math.round(Number(classPriceFallback))
      : 0;
  const total =
    orderAmount != null &&
    Number.isFinite(Number(orderAmount)) &&
    Number(orderAmount) >= 0
      ? Math.round(Number(orderAmount))
      : fallback;

  const meta = coerceMetadataObject(metadata);
  if (meta && isPeaceAddonFlag(meta.has_peace_addon)) {
    const baseRaw = meta.checkout_base_amount;
    const peaceRaw = meta.checkout_peace_addon_amount;
    const base = typeof baseRaw === "number" ? baseRaw : Number(baseRaw);
    const peace = typeof peaceRaw === "number" ? peaceRaw : Number(peaceRaw);
    if (Number.isFinite(base) && Number.isFinite(peace) && peace > 0) {
      const b = Math.round(base);
      const p = Math.round(peace);
      const sum = b + p;
      if (sum === total || Math.abs(sum - total) <= 1) {
        return { courseAmount: b, peaceAddonAmount: p, orderTotal: total };
      }

      const trialD = metaInt(meta, "trial_discount_amount");
      const courseCD = metaInt(meta, "course_coupon_discount_amount");
      const peaceCD = metaInt(meta, "peace_coupon_discount_amount");
      const legacyCoupon = metaInt(meta, "coupon_discount_amount");
      const couponPair = courseCD + peaceCD;
      const couponTotal = couponPair > 0 ? couponPair : legacyCoupon;

      type Split = { course: number; peace: number };
      const candidates: Split[] = [];
      if (trialD > 0 && amountsClose(sum - trialD, total)) {
        candidates.push({ course: Math.max(0, b - trialD), peace: p });
      }
      if (couponTotal > 0 && amountsClose(sum - couponTotal, total)) {
        if (couponPair > 0) {
          candidates.push({ course: Math.max(0, b - courseCD), peace: Math.max(0, p - peaceCD) });
        } else {
          candidates.push({ course: Math.max(0, b - legacyCoupon), peace: p });
        }
      }
      if (trialD > 0 && couponTotal > 0 && amountsClose(sum - trialD - couponTotal, total)) {
        if (couponPair > 0) {
          candidates.push({
            course: Math.max(0, b - courseCD - trialD),
            peace: Math.max(0, p - peaceCD),
          });
        } else {
          candidates.push({ course: Math.max(0, b - legacyCoupon - trialD), peace: p });
        }
      }

      for (const c of candidates) {
        if (amountsClose(c.course + c.peace, total)) {
          return { courseAmount: c.course, peaceAddonAmount: c.peace, orderTotal: total };
        }
      }
    }
  }
  return { courseAmount: total, peaceAddonAmount: 0, orderTotal: total };
}
