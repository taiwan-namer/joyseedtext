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
 * 課程內文圖在 lg 的寬度上限，與課程詳情頁主圖格同寬：
 * 左欄 `lg:max-w-[760px]` − 主圖列 `gap-3` (12px) − 縮圖欄 `w-20` (80px) = 668px。
 * 改動主圖列排版時須一併檢查此數值。
 */
export const COURSE_POST_BODY_IMAGE_MAX_LG = 668 as const;

/**
 * 內文／圖文編輯外層與課程詳情左欄同寬（lg）。
 * 靜態字串，供 Tailwind 掃到。
 */
export const COURSE_POST_BODY_COLUMN_MAX_W_CLASS = "w-full max-w-full lg:max-w-[760px]";

/**
 * 內文圖在 prose 內的寬度工具類（靜態字串，供 Tailwind 掃到）。
 * 可與 {@link COURSE_SLOT_IMAGE_DISPLAY_CLASS} 搭配，避免重複寫 668。
 */
export const COURSE_POST_BODY_IMAGE_WIDTH_TW = "max-w-full lg:max-w-[668px] lg:mx-auto";

/**
 * 課程內文 `prose` 內針對 `img` 的寬高覆寫（與主圖格 668px 對齊；靜態字串供 Tailwind 掃到）。
 * 外層自行組 `prose …` 後再接此常數。
 */
export const COURSE_PROSE_POST_BODY_IMG_OVERRIDES =
  "[&_img]:!my-4 [&_img]:!block [&_img]:!h-auto [&_img]:!w-full [&_img]:!max-w-full lg:[&_img]:!max-w-[668px] lg:[&_img]:!mx-auto";

/**
 * 與 `PortraitAwareHtml` 搭配：根元素加上 `is-portrait-image` 的直圖以 1:1 方格、object-cover 顯示（靜態字串）。
 */
export const COURSE_PROSE_PORTRAIT_AWARE_IMAGE_CLASS =
  "[&_img.is-portrait-image]:!aspect-square [&_img.is-portrait-image]:!object-cover";

/**
 * 內文 `[圖片n]` 槽位圖：不超出內文欄、高度依圖片比例、不裁切（與課程頁主圖 1:1 cover 分開）。
 * 桌機寬與主圖格一致（`lg:max-w-[668px]` 勿改動態字串）。
 */
export const COURSE_SLOT_IMAGE_DISPLAY_CLASS =
  "my-4 mx-auto block h-auto w-full max-w-full rounded-xl lg:max-w-[668px]";

/**
 * 內文槽位圖的 `data-*` 屬性名稱，值為槽位 1～n，與自訂內嵌圖區分。
 * 舊內容可能仍為 {@link COURSE_SLOT_IMAGE_DATA_ATTR_LEGACY}，序列化時兩者皆讀取。
 */
export const COURSE_SLOT_IMAGE_DATA_ATTR = "data-course-slot-image";
export const COURSE_SLOT_IMAGE_DATA_ATTR_LEGACY = "data-course-image-slot";

/**
 * 課程「頁面」主圖／輪播槽位：1:1、邊長上限 900px、以 cover 裁切（內文圖不套用此常數；靜態字串供 Tailwind 掃到）
 */
export const COURSE_SLOT_IMAGE_SIZE_CLASS = "w-full max-w-[min(100%,900px)] aspect-square";

/** 主圖單格（裁切＋圓角；內層圖用 absolute inset-0 鋪滿時需 `relative`） */
export const COURSE_SLOT_IMAGE_FRAME_CLASS = [
  "relative",
  COURSE_SLOT_IMAGE_SIZE_CLASS,
  "overflow-hidden rounded-xl bg-gray-200",
].join(" ");

/**
 * 內文「插入其他圖片」：與槽位內文圖同寬度策略、無槽位 data 屬性（`lg:max-w-[668px]` 靜態字串）
 */
export const COURSE_INLINE_EDITOR_IMG_CLASS =
  "my-3 block h-auto w-full max-w-full rounded-lg border border-gray-200 mx-auto lg:max-w-[668px]";
