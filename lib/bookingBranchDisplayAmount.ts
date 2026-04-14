/**
 * 分站後台／營收「顯示金額」：
 * 1) 優先使用 `bookings.metadata` 拆帳（checkout_peace_addon_amount 等）— 見 `bookingAdminAmounts.ts`
 * 2) 無 metadata 時：沿用 BOOKINGS_BRANCH_EXCLUDE_ADDON_NAMES_FROM_AMOUNT + 名稱加購（舊單相容）
 */

import {
  branchCourseAmountAfterPeaceFromMetadata,
  metadataHasPeaceForDisplay,
} from "@/lib/bookingAdminAmounts";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/** 舊單相容：名稱子字串，例：安心包 */
export function getBranchExcludeAddonNameSubstrings(): string[] {
  const raw = envTrim("BOOKINGS_BRANCH_EXCLUDE_ADDON_NAMES_FROM_AMOUNT");
  if (!raw) return [];
  return raw.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
}

function parseAddonIndicesFromDb(v: unknown): number[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v.map((x) => Number(x)).filter((n) => !Number.isNaN(n));
  if (typeof v === "string") {
    const s = v.replace(/^\{|\}$/g, "").trim();
    if (!s) return null;
    return s.split(",").map((x) => Number(x.trim())).filter((n) => !Number.isNaN(n));
  }
  return null;
}

export function parseClassAddonPricesFromRaw(addonRaw: unknown): { name: string; price: number }[] | null {
  if (addonRaw == null) return null;
  if (Array.isArray(addonRaw)) {
    return (addonRaw as { name?: string; price?: number }[]).map((a) => ({
      name: a?.name != null ? String(a.name) : "",
      price: a?.price != null ? Number(a.price) : 0,
    }));
  }
  if (typeof addonRaw === "string") {
    try {
      const parsed = JSON.parse(addonRaw) as unknown;
      if (Array.isArray(parsed)) {
        return (parsed as { name?: string; price?: number }[]).map((a) => ({
          name: a?.name != null ? String(a.name) : "",
          price: a?.price != null ? Number(a.price) : 0,
        }));
      }
    } catch {
      return null;
    }
  }
  return null;
}

/** 舊單：依環境變數排除名稱子字串 */
function branchDisplayOrderAmountLegacy(
  orderAmount: number | null | undefined,
  addonIndices: number[] | null,
  classAddonPrices: { name: string; price: number }[] | null
): number | null {
  if (orderAmount == null || orderAmount < 0) return orderAmount ?? null;
  const subs = getBranchExcludeAddonNameSubstrings();
  if (subs.length === 0) return orderAmount;
  if (!addonIndices?.length || !classAddonPrices?.length) return orderAmount;

  let cut = 0;
  for (const idx of addonIndices) {
    const a = classAddonPrices[idx];
    if (!a) continue;
    const n = (a.name ?? "").trim();
    if (subs.some((s) => n.includes(s))) {
      cut += Number.isFinite(a.price) ? Math.max(0, a.price) : 0;
    }
  }
  return Math.max(0, orderAmount - cut);
}

/**
 * 會員中心／後台訂單列：顯示給分站看的「課程端」金額（已扣 metadata 記載之安心包實付）。
 */
export function computeBookingDisplayClassPrice(
  orderAmount: number | null,
  metadata: unknown,
  addonIndices: number[] | null,
  classAddonPrices: { name: string; price: number }[] | null
): number | null {
  if (orderAmount == null) return null;
  if (metadataHasPeaceForDisplay(metadata)) {
    return branchCourseAmountAfterPeaceFromMetadata(orderAmount, metadata);
  }
  return branchDisplayOrderAmountLegacy(orderAmount, addonIndices, classAddonPrices) ?? orderAmount;
}

/**
 * 儀表板／匯出：與訂單列表一致。
 */
export function bookingRowDisplayAmountForBranch(row: {
  order_amount?: number | string | null;
  addon_indices?: unknown;
  metadata?: unknown;
  classes?: { price?: number | null; addon_prices?: unknown } | null;
}): number {
  const oa = (() => {
    const v = row.order_amount;
    if (v == null) return null;
    if (typeof v === "string" && v.trim() === "") return null;
    const n = Number(v);
    if (Number.isNaN(n) || n < 0) return null;
    return n;
  })();
  const fallback = row.classes?.price != null ? Number(row.classes.price) : 0;
  const addonPrices = parseClassAddonPricesFromRaw(row.classes?.addon_prices ?? null);
  const indices = parseAddonIndicesFromDb(row.addon_indices);
  if (oa != null && oa >= 0) {
    return computeBookingDisplayClassPrice(oa, row.metadata, indices, addonPrices) ?? fallback;
  }
  return fallback;
}
