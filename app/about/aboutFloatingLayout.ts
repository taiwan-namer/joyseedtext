import type { HeroFloatingIcon } from "@/app/lib/frontendSettingsShared";

/**
 * 關於區塊裝飾圖：與後台列表「編號」（1-based）對齊。
 * 桌機：編號 1、2、5 強制水平置中（left 50%，拖曳僅改上下）。
 */
export const ABOUT_FLOATING_ICONS_HORIZONTAL_CENTER_SLOTS_1_BASED: readonly number[] = [1, 2, 5];

/**
 * 桌機：橫向排列群組（同一列；top 取該組各圖 topPct 之最大者，拖曳時整列同步上下）。
 * 編號 3–4 一列；編號 6–10 一列。
 */
export const ABOUT_FLOATING_ICON_HORIZONTAL_ROW_GROUPS_1_BASED: readonly (readonly number[])[] = [
  [3, 4],
  [6, 7, 8, 9, 10],
];

/** 編號 3、4 兩圖之間距（px，相鄰邊界） */
export const ABOUT_FLOATING_ROW_GAP_PX_SLOTS_3_4 = 15;

/** 編號 6～10 相鄰圖之間距（px） */
export const ABOUT_FLOATING_ROW_GAP_PX_SLOTS_6_10 = 10;

/** 關於頁裝飾圖垂直微調（px，負值＝上移）。編號 13 預設 -8，白縫仍在可改 -10～-14 */
export const ABOUT_FLOATING_ICON_VERTICAL_NUDGE_PX_BY_SLOT_1_BASED: Readonly<Record<number, number>> = {
  13: -8,
};

export function isAboutFloatingSlotHorizontalCenter1Based(
  icons: readonly { id: string }[],
  iconId: string,
  slots1Based: readonly number[] = ABOUT_FLOATING_ICONS_HORIZONTAL_CENTER_SLOTS_1_BASED
): boolean {
  const idx = icons.findIndex((x) => x.id === iconId);
  if (idx < 0) return false;
  return slots1Based.includes(idx + 1);
}

export function findRowGroupContainingSlot1Based(
  slot1Based: number,
  rowGroups: readonly (readonly number[])[]
): readonly number[] | null {
  for (const g of rowGroups) {
    if (g.includes(slot1Based)) return g;
  }
  return null;
}

function rowDisplayWidthPx(ic: HeroFloatingIcon, iconScale: number): number {
  const wPx = Number.isFinite(ic.widthPx) && ic.widthPx > 0 ? ic.widthPx : 64;
  return wPx * iconScale;
}

function gapPxForRowGroup(group: readonly number[]): number {
  if (group.length === 2 && group.includes(3) && group.includes(4)) {
    return ABOUT_FLOATING_ROW_GAP_PX_SLOTS_3_4;
  }
  if (group.length >= 2 && group[0] === 6) {
    return ABOUT_FLOATING_ROW_GAP_PX_SLOTS_6_10;
  }
  return ABOUT_FLOATING_ROW_GAP_PX_SLOTS_6_10;
}

/** 橫列內第 idx 個（0-based）的 left%，於 15%～85% 間均分（無 host 寬時後備） */
function rowGroupLeftPctFallback(groupSize: number, idxInGroup: number): number {
  if (groupSize <= 1) return 50;
  return 15 + (70 * idxInGroup) / (groupSize - 1);
}

/**
 * 依容器寬度與圖寬，將橫列置中並套用固定 px 間距，回傳中心點之 left%。
 */
function rowLeftPctFromPixelGap(
  group: readonly number[],
  slot1Based: number,
  full: readonly HeroFloatingIcon[],
  hostWidthPx: number,
  iconScale: number
): number | null {
  if (hostWidthPx < 1) return null;
  const idxInGroup = group.indexOf(slot1Based);
  if (idxInGroup < 0) return null;

  const widths = group.map((s) => {
    const i = s - 1;
    if (i < 0 || i >= full.length) return 0;
    return rowDisplayWidthPx(full[i], iconScale);
  });
  if (widths.some((w) => w <= 0)) return null;

  const gap = gapPxForRowGroup(group);
  const n = group.length;
  const totalW = widths.reduce((a, b) => a + b, 0) + (n - 1) * gap;
  const leftEdge0 = Math.max(0, (hostWidthPx - totalW) / 2);

  let leftEdge = leftEdge0;
  for (let k = 0; k < idxInGroup; k++) {
    leftEdge += widths[k] + gap;
  }
  const centerX = leftEdge + widths[idxInGroup] / 2;
  return (centerX / hostWidthPx) * 100;
}

export type AboutFloatingLayoutOpts = {
  horizontalCenterSlots1Based: readonly number[];
  horizontalRowGroups1Based: readonly (readonly number[])[];
  /** 有值且橫列排版時，依像素間距計算 left% */
  hostWidthPx?: number;
  iconScale?: number;
};

/**
 * 關於區：結合置中／橫列規則後的顯示座標（與 HeroFloatingIconsLayer／Editor 共用）。
 */
export function getAboutFloatingIconComputedPct(
  icon: HeroFloatingIcon,
  slot1Based: number,
  full: readonly HeroFloatingIcon[],
  opts: AboutFloatingLayoutOpts
): { leftPct: number; topPct: number } {
  const { horizontalCenterSlots1Based: centerSlots, horizontalRowGroups1Based: rowGroups } = opts;
  if (centerSlots.includes(slot1Based)) {
    return { leftPct: 50, topPct: icon.topPct };
  }
  const group = findRowGroupContainingSlot1Based(slot1Based, rowGroups);
  if (group && group.length > 0) {
    const idxInGroup = group.indexOf(slot1Based);
    const tops = group
      .map((s) => {
        const i = s - 1;
        if (i < 0 || i >= full.length) return null;
        const t = full[i]?.topPct;
        return typeof t === "number" && Number.isFinite(t) ? t : null;
      })
      .filter((t): t is number => t != null);
    const topPct = tops.length > 0 ? Math.max(...tops) : icon.topPct;

    const hw = opts.hostWidthPx;
    const sc = opts.iconScale;
    if (hw != null && hw > 0 && sc != null && sc > 0) {
      const fromPx = rowLeftPctFromPixelGap(group, slot1Based, full, hw, sc);
      if (fromPx != null) {
        return { leftPct: fromPx, topPct };
      }
    }
    const leftPct = rowGroupLeftPctFallback(group.length, Math.max(0, idxInGroup));
    return { leftPct, topPct };
  }
  return { leftPct: icon.leftPct, topPct: icon.topPct };
}
