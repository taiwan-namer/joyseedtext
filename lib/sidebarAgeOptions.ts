/**
 * 後台「選項（可多選）」年齡：0~15 歲區間（value 存 DB sidebar_option）。
 * 舊版 "0"~"2" 仍會對應顯示；「可大人陪同」為 "3"，已下架，讀取時略過。
 */
export const SIDEBAR_OPTION_LABELS: Record<string, string> = {
  "0": "0-3歲",
  "1": "3-6歲",
  "2": "6-9歲",
  r0: "0~1歲",
  r1: "2~3歲",
  r2: "4~5歲",
  r3: "6~7歲",
  r4: "8~9歲",
  r5: "10~11歲",
  r6: "12~13歲",
  r7: "14~15歲",
};

/** 後台表單勾選清單（僅新版區間） */
export const SIDEBAR_AGE_CHECKLIST: readonly { value: string; label: string }[] = [
  { value: "r0", label: "0~1歲" },
  { value: "r1", label: "2~3歲" },
  { value: "r2", label: "4~5歲" },
  { value: "r3", label: "6~7歲" },
  { value: "r4", label: "8~9歲" },
  { value: "r5", label: "10~11歲" },
  { value: "r6", label: "12~13歲" },
  { value: "r7", label: "14~15歲" },
];

const DROPPED_SIDEBAR_KEYS = new Set(["3"]);

/** 與 DB `sidebar_option` 內年齡區間 token 前綴一致（無 age 欄位時用此儲存） */
export const SIDEBAR_AGE_RANGE_PREFIX = "__range:";

export function isSidebarAgeRangeToken(v: string): boolean {
  return typeof v === "string" && v.startsWith(SIDEBAR_AGE_RANGE_PREFIX);
}

/** 後台表單寫入：年齡區間存 sidebar_option */
export function encodeAgeRangeSidebarToken(min: number, max: number): string {
  return `${SIDEBAR_AGE_RANGE_PREFIX}${min}:${max}`;
}

export function mapSidebarOptionsToLabels(sidebarOption: string[] | null | undefined): string[] {
  const arr = Array.isArray(sidebarOption) ? sidebarOption : [];
  return arr
    .filter((v) => typeof v === "string" && !isSidebarAgeRangeToken(v))
    .filter((v) => !DROPPED_SIDEBAR_KEYS.has(v))
    .map((v) => SIDEBAR_OPTION_LABELS[v] ?? v)
    .filter((t) => typeof t === "string" && t.length > 0);
}
