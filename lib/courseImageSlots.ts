import { COURSE_FORM_GALLERY_SLOT_COUNT, COURSE_FORM_IMAGE_SLOT_COUNT } from "@/lib/constants";

/** 圖庫格數（主圖以外附圖張數上線） */
export const COURSE_GALLERY_MAX = COURSE_FORM_GALLERY_SLOT_COUNT;
/** 主圖 1 ＋ 圖庫，合計槽位 */
export const COURSE_IMAGE_SLOT_TOTAL = COURSE_FORM_IMAGE_SLOT_COUNT;

/** 與表單／編輯器標籤一致：主圖、圖1… */
export const COURSE_IMAGE_SLOT_LABELS = [
  "主圖",
  ...Array.from({ length: COURSE_FORM_GALLERY_SLOT_COUNT }, (_, j) => `圖${j + 1}`),
] as const;

/**
 * 內文 `[圖片n]` 槽位圖：寬度最多 1200px（不超出容器）、高度依圖片比例、不裁切（與課程頁主圖／輪播 1:1 cover 分開）
 */
export const COURSE_SLOT_IMAGE_DISPLAY_CLASS =
  "my-4 block w-full max-w-[min(100%,1200px)] h-auto rounded-xl mx-auto";

/**
 * 內文槽位圖的 `data-*` 屬性名稱，值為槽位 1～n，與自訂內嵌圖區分。
 * 舊內容可能仍為 {@link COURSE_SLOT_IMAGE_DATA_ATTR_LEGACY}，序列化時兩者皆讀取。
 */
export const COURSE_SLOT_IMAGE_DATA_ATTR = "data-course-slot-image";
export const COURSE_SLOT_IMAGE_DATA_ATTR_LEGACY = "data-course-image-slot";

/**
 * 課程「頁面」主圖／輪播槽位：1:1、寬度上限 1200px、以 cover 裁切（內文圖不套用此常數）
 */
export const COURSE_SLOT_IMAGE_SIZE_CLASS = "w-full max-w-[min(100%,1200px)] aspect-square";

/** 主圖單格（裁切＋圓角；內層圖用 absolute inset-0 鋪滿時需 `relative`） */
export const COURSE_SLOT_IMAGE_FRAME_CLASS = [
  "relative",
  COURSE_SLOT_IMAGE_SIZE_CLASS,
  "overflow-hidden rounded-xl bg-gray-200",
].join(" ");

/**
 * 內文「插入其他圖片」：寬度上限 1200px、高度依比例（與槽位內文圖寬高策略一致，無槽位 data 屬性）
 */
export const COURSE_INLINE_EDITOR_IMG_CLASS =
  "my-3 block w-full max-w-[min(100%,1200px)] h-auto rounded-lg border border-gray-200 mx-auto";
