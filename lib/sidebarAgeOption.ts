/**
 * 課程「適齡」存於 classes.sidebar_option（text[]）：
 * - 自訂區間：`__range:最小歲數:最大歲數`（例 __range:2:4 → 前台顯示 2-4歲）
 * - 可大人陪同：沿用舊代碼 `3`
 * - 舊版固定區間：`0`/`1`/`2` 仍支援顯示
 */

const LEGACY_SIDEBAR_LABELS: Record<string, string> = {
  "0": "0-3歲",
  "1": "3-6歲",
  "2": "6-9歲",
  "3": "可大人陪同",
};

/** 後台／前台顯示用標籤 */
export function sidebarOptionToDisplayLabels(options: string[] | null | undefined): string[] {
  const arr = options ?? [];
  const out: string[] = [];
  for (const v of arr) {
    const m = /^__range:(\d+):(\d+)$/.exec(v);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      out.push(`${lo}-${hi}歲`);
      continue;
    }
    if (LEGACY_SIDEBAR_LABELS[v]) {
      out.push(LEGACY_SIDEBAR_LABELS[v]);
    } else if (v && !v.startsWith("__")) {
      out.push(v);
    }
  }
  return out;
}

/** 表單初始值：從 sidebar_option 還原年齡欄與陪同勾選 */
export function parseInitialAgeFromSidebar(options: string[] | null | undefined): {
  min: string;
  max: string;
  adultAccompany: boolean;
} {
  let min = "";
  let max = "";
  let adultAccompany = false;
  for (const v of options ?? []) {
    const m = /^__range:(\d+):(\d+)$/.exec(v);
    if (m) {
      min = m[1];
      max = m[2];
    }
    if (v === "3") adultAccompany = true;
  }
  return { min, max, adultAccompany };
}

/**
 * 由表單數字組出要寫入 DB 的 sidebar_option。
 * 若 min/max 皆有效則一定寫入 __range；可另勾選陪同（3）。
 */
export function buildSidebarOptionFromForm(
  ageMin: number | null | undefined,
  ageMax: number | null | undefined,
  adultAccompany: boolean
): string[] {
  const out: string[] = [];
  if (ageMin != null && ageMax != null && Number.isFinite(ageMin) && Number.isFinite(ageMax)) {
    let lo = Math.floor(Number(ageMin));
    let hi = Math.floor(Number(ageMax));
    if (lo < 0) lo = 0;
    if (hi < 0) hi = 0;
    if (lo > 120) lo = 120;
    if (hi > 120) hi = 120;
    if (lo > hi) [lo, hi] = [hi, lo];
    out.push(`__range:${lo}:${hi}`);
  }
  if (adultAccompany) out.push("3");
  return out;
}
