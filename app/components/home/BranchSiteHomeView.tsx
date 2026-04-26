"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Image as LucideImage, Facebook, Instagram } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { CourseForPublic } from "@/app/actions/productActions";
import { mapCourseToHomeActivity as mapCourseToHomePageActivity } from "@/lib/homePageActivity";
import FAQ from "@/app/components/FAQ";
import { HeaderMember } from "@/app/components/HeaderMember";
import HomeFeaturedCoursesOnePlusSix from "@/app/components/home/HomeFeaturedCoursesOnePlusSix";
import HomeCoursesGridListBlock from "@/app/components/home/HomeCoursesGridListBlock";
import HeroFloatingIconsLayer from "@/app/components/home/HeroFloatingIconsLayer";
import { getCoursesForHomepage } from "@/app/actions/productActions";
import { mapCourseToHomeActivity } from "@/app/lib/mapCourseToHomeActivity";
import type { Activity } from "@/app/lib/homeSectionTypes";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import type { AdminLayoutCanvasConfig } from "@/app/admin/(protected)/layout/adminLayoutCanvasTypes";
import type { CarouselItem, HeroFloatingIcon, LayoutBlock } from "@/app/lib/frontendSettingsShared";
import {
  DEFAULT_ABOUT_PAGE_URL,
  effectiveLayoutBlockMinHeightPx,
  LAYOUT_CONTENT_COLUMN_INSET_X_PX,
  LAYOUT_DESIGN_CANVAS_WIDTH_PX,
  LAYOUT_MOBILE_FLOATING_SCALE_WIDTH_PX,
  LAYOUT_SECTION_LABELS,
  layoutBlockForCanvasWrapper,
  normalizeAboutPageUrl,
  resolveLayoutBlockForStyle,
} from "@/app/lib/frontendSettingsShared";
import { JOYSEED_ISLAND_WEB_URL } from "@/lib/mainSiteCanonical";
import FullWidthImageSection from "@/app/components/home/FullWidthImageSection";

const BlockWrapper = dynamic(() => import("@/app/admin/(protected)/layout/BlockWrapper"));
const HeroFloatingIconsEditor = dynamic(
  () => import("@/app/admin/(protected)/layout/HeroFloatingIconsEditor")
);

const CAROUSEL_INTERVAL_MS = 4000;
/** 後台畫布：全頁裝飾層與前台垂直對齊微調（px，正數往下） */
const ADMIN_VIEWPORT_FLOATING_Y_OFFSET_PX = 0;
/** 後台畫布：全頁裝飾層與前台水平對齊微調（px，正數往右） */
const ADMIN_VIEWPORT_FLOATING_X_OFFSET_PX = 0;
/** 後台手機畫布與前台真機高度視覺微差補償（僅預覽，不影響儲存值） */
const ADMIN_MOBILE_HEIGHT_PREVIEW_COMPENSATION_PX =30;

function normalizeFloatingImageKey(raw: string | null | undefined): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  try {
    const u = new URL(t, typeof window !== "undefined" ? window.location.origin : "https://local");
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return t.split("#")[0].split("?")[0].toLowerCase();
  }
}

/** 分站首頁實際會畫出的區塊 id */
const BRANCH_LAYOUT_ID_LIST = [
  "header",
  "hero",
  "hero_carousel",
  "carousel",
  /** 畫布「單張大圖」：與 frontend_settings.fullWidthImageUrl 對應 */
  "full_width_image",
  "featured_categories",
  /** 舊版面 id，仍須可渲染（與 courses_grid 相同內容） */
  "courses",
  "courses_grid",
  "courses_list",
  "about",
  "faq",
  "contact",
  "footer",
] as const;

/**
 * 僅在後台畫布顯示佔位（前台首頁不渲染），讓點側欄可對應畫布與裝飾圖／高度／背景。
 */
const ADMIN_CANVAS_PLACEHOLDER_ID_LIST = ["new_courses", "popular_experiences"] as const;

/** 總站首頁有、分站畫布需預覽選取的積木（訪客分站頁未必渲染） */
const ADMIN_EXTRA_CANVAS_BLOCK_IDS = ["carousel_2", "full_width_image"] as const;

/** 依 layout_blocks 排序與 enabled，產生渲染順序；前台訪客：hero／hero_carousel 合併為一個 hero 槽；後台畫布：分開列出以便分別選取 */
function getVisibleOrderedBranchSectionIds(blocks: LayoutBlock[], forAdminCanvas: boolean): string[] {
  const allowedList = forAdminCanvas
    ? [...BRANCH_LAYOUT_ID_LIST, ...ADMIN_CANVAS_PLACEHOLDER_ID_LIST, ...ADMIN_EXTRA_CANVAS_BLOCK_IDS]
    : [...BRANCH_LAYOUT_ID_LIST];
  const allowed = new Set<string>(allowedList);
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  const out: string[] = [];
  let heroSlotPlaced = false;
  for (const b of sorted) {
    if (b.enabled === false) continue;
    if (!allowed.has(b.id)) continue;
    if (b.id === "hero" || b.id === "hero_carousel") {
      if (forAdminCanvas) {
        if (b.id === "hero") out.push("hero");
        else out.push("hero_carousel");
        continue;
      }
      if (!heroSlotPlaced) {
        out.push("hero");
        heroSlotPlaced = true;
      }
      continue;
    }
    out.push(b.id);
  }
  return out;
}

function LineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.127h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

/** 與 HeroFloatingIconsLayer 相同斷點：訪客首頁依此選擇區塊 `heightPxMobile` 或桌機 `heightPx` */
function useVisitorNarrowMaxMd(): boolean {
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 767px)");
    const apply = () => setNarrow(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);
  return narrow;
}

export type BranchSiteHomeViewProps = {
  layoutBlocks: LayoutBlock[];
  /**
   * 首頁大圖設定是否已從後台載入完成。false 時仍會佔住主圖區高度（避免下方區塊先出現再被主圖推開）。
   * 後台畫布預覽請維持 true（預設）。
   */
  heroSettingsLoaded?: boolean;
  heroImageUrl: string | null;
  heroImageMobileUrl?: string | null;
  /** 後台畫布：單張大圖區塊預覽用（與前台設定同步） */
  fullWidthImageUrl?: string | null;
  /**
   * 後台畫布：頁首 LOGO／背景預覽（與 store_settings 同步；訪客首頁未傳此值）
   */
  previewHeader?: {
    logoUrl: string | null;
    headerBackgroundUrl: string | null;
    headerBackgroundMobileUrl: string | null;
  } | null;
  carouselItems: CarouselItem[];
  aboutContent: string | null;
  navAboutLabel: string;
  navCoursesLabel: string;
  navBookingLabel: string;
  navFaqLabel: string;
  /** 導覽列「關於我們」連結（預設 `/about`）；可為站內路徑或 http(s) 外部網址 */
  aboutPageUrl?: string;
  /** 後台畫布：區塊選取、高度、裝飾圖編輯 */
  adminLayout?: AdminLayoutCanvasConfig | null;
  /** 後台畫布：與編輯頁同一批課程列表；訪客首頁會自行向 API 載入 */
  activities?: Activity[];
  /**
   * 伺服端已載入之首頁課程（訪客）；傳入時不呼叫 getCoursesForHomepage。
   * 後台畫布預覽勿傳，以維持由父層餵入的 activities。
   */
  serverHomeCourses?: { courses: CourseForPublic[]; error: string | null };
  /** 訪客首頁：全頁裝飾層（橫向為置中內容欄座標、可延伸至左右留白；垂直為根容器高度百分比；隨捲動）；後台畫布勿傳 */
  viewportFloatingIcons?: HeroFloatingIcon[] | null;
  /** 非 admin 互動模式下仍可指定以手機座標渲染（供後台手機「前台一致預覽」） */
  previewCoordinateViewport?: "desktop" | "mobile";
};

export default function BranchSiteHomeView({
  layoutBlocks,
  heroSettingsLoaded = true,
  heroImageUrl,
  heroImageMobileUrl = null,
  fullWidthImageUrl = null,
  previewHeader = null,
  carouselItems,
  aboutContent,
  navAboutLabel,
  navCoursesLabel,
  navBookingLabel,
  navFaqLabel,
  aboutPageUrl = DEFAULT_ABOUT_PAGE_URL,
  adminLayout = null,
  activities: activitiesFromParent,
  serverHomeCourses,
  viewportFloatingIcons = null,
  previewCoordinateViewport,
}: BranchSiteHomeViewProps) {
  const {
    siteName,
    primaryColor,
    aboutSectionBackgroundColor,
    socialFbUrl,
    socialIgUrl,
    socialLineUrl,
    contactEmail,
    contactPhone,
    contactAddress,
  } = useStoreSettings();

  const hasSocialLinks = !!(socialFbUrl || socialIgUrl || socialLineUrl);
  const hasContact = !!(contactPhone || contactEmail || contactAddress);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const organizerName = siteName?.trim() || "[主辦方/老師品牌名稱]";
  const termsModalContent = useMemo(
    () => `${organizerName} — 使用者服務條款
(系統與技術提供：童趣島 WONDER VOYAGE)

歡迎您預訂 ${organizerName}（以下簡稱「本單位」）之活動。本單位之報名系統與金流由「童趣島 WONDER VOYAGE」（以下簡稱「系統商」）提供技術支援。當您完成預訂，即視為您已閱讀並同意以下條款：

契約關係與平台角色
1.1 契約當事人
您所預訂之課程或體驗活動，其實際舉辦者與執行者為「本單位」。您與本單位之間成立服務契約。
1.2 系統商免責聲明
「系統商（童趣島）」僅提供報名網頁建置、訂單管理、金流代收代付及保險行政協作服務。活動之內容設計、現場安全管理、教學品質與履約責任，均由本單位全權負責，系統商不承擔連帶履約或損害賠償責任。

安心包、安全管理與保險聲明
2.1 安心包定義
「安心包」為本平台提供之活動風險管理，內容包含：
- 活動現場之風險管理規格建議。
- 活動內容重大變更或安全疑慮時之協作處理。
2.2 非保險銷售
活動相關之保險（包含但不限於公共意外責任險、旅行平安險或特定活動險），均由「實際舉辦活動之供應商」負責投保與提供。本平台不從事保險銷售、未向使用者收取保險費，亦不代為執行投保作業。各項保險之實際保障範圍、理賠條件與除外責任，悉依供應商所投保之保險公司保單條款為準。本平台僅居間提供行政與溝通協助。

預訂、付款與退費政策
3.1 契約成立
於本系統完成付款，並收到系統商發送之通知（Email／LINE）後，訂單即正式成立。
3.2 取消與退費標準
依據活動頁面標示為準；若無特別標示，適用以下標準：
- 活動日前 7 日（含）以上取消：退費 100%（得扣除行政匯費 15 元）。
- 活動日前 3–6 日取消：退費 50%。
- 活動日前 1–2 日及當日取消：不予退費。
3.3 不可抗力與主辦方取消
如遇天災、疫情等不可抗力，或本單位因故無法舉辦活動，本單位將負責通知您，並提供全額退款或改期之選項。退款作業由系統商協助執行。

活動現場規範與健康聲明
4.1 據實告知義務
您於報名時應確認參加者（含兒童）身心狀況良好。若有心臟病、氣喘、過敏或其他特殊疾病，必須於備註欄載明並於現場主動告知本單位講師。若因隱瞞致生意外，責任由您自行承擔。
4.2 風險承擔與安全規範
您承諾將遵守本單位之安全指導。若因參加者故意違反規定（如不當使用工具、奔跑推擠）導致受傷或造成設備損壞、第三人受傷，家長需自負法律與賠償責任。
4.3 緊急醫療授權
若發生意外且無法即時聯繫您，您同意授權本單位現場人員採取必要急救並送醫，相關費用由您負擔（或由保險理賠支付）。

個人資料與隱私權
您同意本單位及系統商（童趣島）依《個人資料保護法》，為處理訂單、聯繫、建立保險及後續服務之目的，蒐集、處理與利用您的個人資料。雙方均承諾不將您的資料出售予無關之第三方。

肖像權授權
活動期間本單位可能進行拍攝紀錄，作為行銷素材使用。若不願被拍攝，請於現場主動告知本單位人員；未告知者視為同意授權。

系統服務中斷
對於因不可抗力或第三方服務異常（如金流系統當機）導致之報名中斷，本單位與系統商不負損害賠償責任。

準據法與管轄法院
本條款依中華民國法律解釋。若發生爭議，雙方同意以臺灣新北地方法院為第一審管轄法院。`,
    [organizerName]
  );
  const privacyModalContent = useMemo(() => {
    const lines: string[] = [
      "隱私權政策",
      "(系統與技術提供：童趣島 WONDER VOYAGE)",
      "",
      `${organizerName}（以下簡稱「本單位」）非常重視您的個人資料與隱私保護。本單位之報名與管理系統由「童趣島 WONDER VOYAGE」（以下簡稱「系統商」）提供技術支援。本單位與系統商皆依照《個人資料保護法》蒐集、處理與利用您的個人資料。`,
      "當您使用本網站服務，即表示您已閱讀、理解並同意本隱私權政策全部內容。",
      "",
      "一、個人資料的蒐集項目",
      "本單位透過系統商之服務，將蒐集下列類別資料：",
      "- 基本識別資料：姓名、暱稱、電子郵件、聯絡電話、住址等。",
      "- 兒童活動必要資料：參加者姓名、性別、出生年月日、過敏或特殊健康需求。",
      "- 金流與交易資料：付款方式（信用卡由第三方金流處理，本單位僅接收交易結果代碼）、退款資料、發票資訊。",
      "- 使用與交易紀錄：預訂紀錄、取消紀錄、裝置資訊、IP 位址等。",
      "",
      "二、資料蒐集之目的",
      "本單位蒐集與利用資料之目的包含：",
      "- 課程／活動預訂、訂單管理與身分驗證。",
      "- 活動行前通知、緊急聯絡、客服詢問回覆。",
      "- 辦理活動必要之保險投保作業。",
      "- 透過系統商執行退費、改期或「安心包」爭議協調程序。",
      "- 法律義務（稅務、消費者保護等）。",
      "",
      "三、資料分享與第三方合作對象（資料受託者）",
      "為完成服務流程，本單位會將必要之個人資料提供予以下第三方：",
      "",
      "系統商（童趣島 WONDER VOYAGE）",
      "作為資料處理之受託者，用於：系統維運、訂單資料庫管理、發送 LINE 通知型訊息、金流代收付處理及安心包客服協調。",
      "",
      "保險公司或保險代理人",
      "用於：辦理活動相關保險（如旅平險、特定活動險）及事故理賠程序。",
      "",
      "第三方金流服務（如綠界、LINE Pay 等）",
      "用於付款授權處理及金流對帳。",
      "",
      "法律或政府機關",
      "依法令要求或公權力機關之合法調閱。",
      "本單位與系統商承諾，絕不任意販售、交換、租借您的資料予無關之第三方。",
      "",
      "四、資料保存與安全措施",
      "- 資料將依蒐集目的或法定保存期間保存，期間屆滿後將安全刪除或匿名化。",
      "- 系統商採用符合業界標準之安全措施（含 SSL 加密、權限控管、防火牆），以保護儲存於系統中之個人資料。但網路傳輸具不可控風險，請您妥善保管帳號密碼。",
      "",
      "五、LINE 通知型訊息",
      "為傳遞重要活動資訊（如行前通知、改期、緊急消息），本單位將透過系統商（童趣島）之 LINE 官方帳號或本單位綁定之帳號傳送「通知型訊息」。觸發條件：",
      "- 您在報名留下的電話號碼與 LINE 帳號電話相同。",
      "- LINE 設定已允許接收「通知型訊息」。",
      "- 未封鎖發送端之官方帳號。",
      "若您於 LINE 設定中關閉「通知型訊息」，將無法收到系統自動發送之重要通知，可能影響您的活動參與權益。",
      "",
      "六、兒童隱私權特別聲明",
      "本單位服務對象包含未成年人：",
      "- 當您填寫兒童之個人資料時，視為您已以法定代理人身分同意本單位蒐集該資料。",
      "- 兒童資料僅嚴格用於活動報名審核、保險辦理及現場安全照護（如過敏核對），絕不挪作行銷他用。",
      "",
      "七、活動攝影與肖像權使用",
      "活動期間本單位可能進行拍攝紀錄，用於品質管理或本單位之社群行銷宣傳。",
      "您的權利：若您不希望孩子被拍攝或公開影像，請於活動現場主動告知本單位工作人員，我們將避免拍攝或進行遮蔽處理。未事先告知者，視為同意授權。",
      "",
      "八、當事人依個資法享有之權利",
      "您可隨時向本單位或系統商請求：",
      "- 查詢或閱覽個人資料",
      "- 製給複製本",
      "- 補充或更正資料",
      "- 停止蒐集、處理或利用",
      "- 請求刪除資料",
      "注意：若要求刪除資料，可能導致無法辦理保險、無法查詢歷史訂單或無法繼續提供服務。",
      "",
      "九、Cookie 與追蹤技術",
      "本網站由系統商維護，將使用 Cookie 以維持登入狀態及優化預訂流程。您可於瀏覽器設定拒絕 Cookie，但可能導致無法正常結帳或登入。",
      "",
      "十、政策修訂",
      "本單位與系統商保留修訂本政策之權利，更新後將公告於網站。",
      "",
      "十一、聯絡方式",
      "如對本政策有任何問題、欲申請個資權利，或需進行退費與客服協調，請聯繫：",
      "",
      `單位名稱：${organizerName}`,
    ];
    if (contactEmail?.trim()) {
      lines.push(`聯絡信箱：${contactEmail.trim()}`);
    }
    if (socialLineUrl?.trim()) {
      lines.push(`官方 LINE：${socialLineUrl.trim()}`);
    }
    lines.push("系統客服支援：童趣島官方客服 (LINE ID: @joyseed2025)");
    return lines.join("\n");
  }, [organizerName, contactEmail, socialLineUrl]);
  const mapEmbedUrl = contactAddress?.trim()
    ? `https://www.google.com/maps?q=${encodeURIComponent(contactAddress.trim())}&output=embed`
    : "";

  const [wallIndex, setWallIndex] = useState(0);
  const defaultCarousel: CarouselItem[] = useMemo(
    () => [
      { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
      { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
      { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
    ],
    []
  );
  const carouselList = (carouselItems.length > 0 ? carouselItems : defaultCarousel).filter(
    (item) => item.visible !== false
  );
  const admin = adminLayout ?? null;
  const coordMode = previewCoordinateViewport ?? admin?.floatingIconsCoordinateMode ?? "desktop";
  const isAdminCanvas = admin != null;
  const visitorNarrowMaxMd = useVisitorNarrowMaxMd();
  /** 區塊 minHeight：後台依畫布桌機／手機；訪客依窄螢幕或預覽強制座標 */
  const layoutViewportForHeights = useMemo<"desktop" | "mobile">(() => {
    if (admin != null) return coordMode;
    if (previewCoordinateViewport === "mobile") return "mobile";
    if (previewCoordinateViewport === "desktop") return "desktop";
    return visitorNarrowMaxMd ? "mobile" : "desktop";
  }, [admin, coordMode, previewCoordinateViewport, visitorNarrowMaxMd]);
  /** 後台依分頁強制座標；訪客勿固定 desktop，否則窄螢幕仍用桌機欄位、手機專用座標／寬度全被忽略 */
  const floatingCoordinateViewport =
    admin != null ? coordMode : (previewCoordinateViewport ?? undefined);
  const floatingScaleReferenceWidthPx =
    isAdminCanvas && admin != null && coordMode === "mobile"
      ? admin.mobileFloatingScaleReferenceWidthPx ?? LAYOUT_MOBILE_FLOATING_SCALE_WIDTH_PX
      : LAYOUT_DESIGN_CANVAS_WIDTH_PX;
  const hasViewportFloatingIcons = (viewportFloatingIcons?.length ?? 0) > 0;
  const isEditingViewportFloatingInAdmin = !!(isAdminCanvas && admin?.selectedViewportFloatingIconId);
  const viewportRootRef = useRef<HTMLDivElement | null>(null);
  const viewportIconUrlSet = useMemo(() => {
    const s = new Set<string>();
    for (const ic of viewportFloatingIcons ?? []) {
      const u = normalizeFloatingImageKey(ic.imageUrl);
      if (u) s.add(u);
    }
    return s;
  }, [viewportFloatingIcons]);
  const hasAdminViewportFloatingIcons = !!(isAdminCanvas && (admin?.viewportFloatingIcons?.length ?? 0) > 0);
  const [viewportLayerReady, setViewportLayerReady] = useState(() => !hasViewportFloatingIcons);
  const [viewportLayerHeightPx, setViewportLayerHeightPx] = useState<number | null>(null);
  const [adminViewportLayerHeightPx, setAdminViewportLayerHeightPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!hasViewportFloatingIcons) {
      setViewportLayerReady(true);
      setViewportLayerHeightPx(null);
      return;
    }
    const host = viewportRootRef.current;
    if (!host) return;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setViewportLayerReady(false);
    const mark = () => {
      if (settled) return;
      settled = true;
      const h = Math.max(host.scrollHeight, Math.round(host.getBoundingClientRect().height));
      setViewportLayerHeightPx(h > 0 ? h : null);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setViewportLayerReady(true));
      });
    };
    const queue = () => {
      if (settled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(mark, 220);
    };
    const ro = new ResizeObserver(queue);
    ro.observe(host);
    const imgs = Array.from(host.querySelectorAll("img"));
    const onImgDone = () => queue();
    for (const img of imgs) {
      if (img.complete) continue;
      img.addEventListener("load", onImgDone, { once: true });
      img.addEventListener("error", onImgDone, { once: true });
    }
    queue();
    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
      for (const img of imgs) {
        img.removeEventListener("load", onImgDone);
        img.removeEventListener("error", onImgDone);
      }
    };
  }, [hasViewportFloatingIcons, layoutBlocks.length, carouselList.length]);

  useLayoutEffect(() => {
    if (!hasAdminViewportFloatingIcons) {
      setAdminViewportLayerHeightPx(null);
      return;
    }
    const host = viewportRootRef.current;
    if (!host) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const mark = () => {
      // 避免把絕對定位覆蓋層本身高度再算回去，造成畫布高度被循環撐大（灰底越來越高）
      const h = Math.round(host.getBoundingClientRect().height);
      setAdminViewportLayerHeightPx((prev) => {
        const next = h > 0 ? h : null;
        return prev === next ? prev : next;
      });
    };
    const queue = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(mark, 80);
    };
    const ro = new ResizeObserver(queue);
    ro.observe(host);
    const imgs = Array.from(host.querySelectorAll("img"));
    const onImgDone = () => queue();
    for (const img of imgs) {
      if (img.complete) continue;
      img.addEventListener("load", onImgDone, { once: true });
      img.addEventListener("error", onImgDone, { once: true });
    }
    window.addEventListener("resize", queue);
    queue();
    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("resize", queue);
      for (const img of imgs) {
        img.removeEventListener("load", onImgDone);
        img.removeEventListener("error", onImgDone);
      }
    };
  }, [hasAdminViewportFloatingIcons, layoutBlocks, carouselList, admin?.viewportFloatingIcons]);

  useEffect(() => {
    if (carouselList.length === 0) return;
    const timer = setInterval(() => {
      setWallIndex((i) => (i + 1) % carouselList.length);
    }, CAROUSEL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [carouselList.length]);

  useEffect(() => {
    if (isAdminCanvas || typeof window === "undefined") return;
    if (window.location.hash !== "#faq") return;

    // 使用者重新整理時若網址殘留 #faq，瀏覽器會自動跳到 FAQ；這裡改為回到頁首。
    const nextUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", nextUrl);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [isAdminCanvas]);

  useEffect(() => {
    setWallIndex((i) => (carouselList.length === 0 ? 0 : i % carouselList.length));
  }, [carouselList.length]);

  const getBlock = (id: string) => layoutBlocks.find((b) => b.id === id);
  const getBlockStyle = (id: string): CSSProperties => {
    const b = resolveLayoutBlockForStyle(layoutBlocks, id);
    if (!b) return {};
    const minH = effectiveLayoutBlockMinHeightPx(b, layoutViewportForHeights);
    const minHeightWithPreviewComp =
      admin != null && coordMode === "mobile" && minH != null
        ? minH + ADMIN_MOBILE_HEIGHT_PREVIEW_COMPENSATION_PX
        : minH;
    return {
      ...(minHeightWithPreviewComp != null ? { minHeight: minHeightWithPreviewComp } : {}),
      ...(b.backgroundImageUrl
        ? { backgroundImage: `url(${b.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
        : {}),
    };
  };

  /** 後台畫布：攔截預覽區內所有連結，避免點擊跳到前台／另開分頁；不阻擋區塊選取與裝飾圖編輯 */
  const suppressCanvasLinkNavigation = (e: React.MouseEvent) => {
    if (!isAdminCanvas) return;
    const el = e.target;
    if (!(el instanceof Element)) return;
    if (el.closest("[data-resize-handle]")) return;
    if (el.closest("[data-floating-icon-editor]")) return;
    if (el.closest("a[href]")) e.preventDefault();
  };
  const [homeCoursesRaw, setHomeCoursesRaw] = useState<CourseForPublic[]>(() => serverHomeCourses?.courses ?? []);
  const [homeFetchLoading, setHomeFetchLoading] = useState(
    () => !isAdminCanvas && serverHomeCourses === undefined
  );
  const [homeFetchError, setHomeFetchError] = useState<string | null>(() => serverHomeCourses?.error ?? null);

  const homeActivities = useMemo(() => {
    if (isAdminCanvas) return activitiesFromParent ?? [];
    return homeCoursesRaw.map(mapCourseToHomeActivity);
  }, [isAdminCanvas, activitiesFromParent, homeCoursesRaw]);

  const featuredHomePageActivities = useMemo(
    () => homeCoursesRaw.map(mapCourseToHomePageActivity),
    [homeCoursesRaw]
  );

  useEffect(() => {
    if (isAdminCanvas) return;
    if (serverHomeCourses !== undefined) return;
    let cancelled = false;
    (async () => {
      setHomeFetchLoading(true);
      setHomeFetchError(null);
      try {
        const res = await getCoursesForHomepage();
        if (cancelled) return;
        if (!res.success) {
          setHomeCoursesRaw([]);
          setHomeFetchError(res.error);
          return;
        }
        setHomeCoursesRaw(res.data);
      } catch (e) {
        if (!cancelled) {
          setHomeCoursesRaw([]);
          setHomeFetchError(e instanceof Error ? e.message : "載入課程失敗");
        }
      } finally {
        if (!cancelled) setHomeFetchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdminCanvas, serverHomeCourses]);
  const homeCoursesLoading = isAdminCanvas ? false : homeFetchLoading;
  const homeCoursesError = isAdminCanvas ? null : homeFetchError;

  const orderedSectionIds = useMemo(
    () => getVisibleOrderedBranchSectionIds(layoutBlocks, admin != null),
    [layoutBlocks, admin]
  );
  const visitorSectionIdSet = useMemo(
    () => new Set(getVisibleOrderedBranchSectionIds(layoutBlocks, false)),
    [layoutBlocks]
  );
  const visitorOrderedSectionIds = useMemo(
    () => orderedSectionIds.filter((id) => visitorSectionIdSet.has(id)),
    [orderedSectionIds, visitorSectionIdSet]
  );
  const adminOnlyOrderedSectionIds = useMemo(
    () => (isAdminCanvas ? orderedSectionIds.filter((id) => !visitorSectionIdSet.has(id)) : []),
    [isAdminCanvas, orderedSectionIds, visitorSectionIdSet]
  );

  /** adminId：與 layout_blocks 內積木 id 一致（選取／拖曳用）；blockOverride：實際套用樣式與高度的 LayoutBlock */
  const wrap = (
    adminId: string,
    children: React.ReactNode,
    opts?: { skipBackgroundImage?: boolean; blockOverride?: LayoutBlock | null }
  ): React.ReactNode => {
    const base = opts?.blockOverride ?? resolveLayoutBlockForStyle(layoutBlocks, adminId);
    const block = layoutBlockForCanvasWrapper(base, adminId);
    if (!admin || !block) return children;
    return (
      <BlockWrapper
        block={block}
        layoutViewport={admin.floatingIconsCoordinateMode ?? "desktop"}
        applyWrapperMinHeight={adminId === "header"}
        isSelected={admin.selectedBlockId === adminId}
        onSelect={() => admin.onSelectBlock(adminId)}
        onResizeHeight={(heightPx) =>
          admin.onBlockResizeHeight(adminId, heightPx, admin.floatingIconsCoordinateMode ?? "desktop")
        }
        blockLabel={LAYOUT_SECTION_LABELS[adminId] ?? adminId}
        skipBackgroundImage={opts?.skipBackgroundImage ?? true}
        previewScale={admin.canvasPreviewScale ?? 1}
      >
        {children}
      </BlockWrapper>
    );
  };

  /**
   * 訪客與後台皆顯示裝飾圖層；僅後台且選取該積木時顯示編輯器。
   * 橫向與主內容 `max-w-7xl px-4` 對齊：`content-column-in-viewport` + `columnContentInsetXPx`（與左右 padding 一致）；圖層 host 為區塊全寬。
   */
  const renderBlockFloatingIconsOverlay = (blockId: string): ReactNode => {
    if (isEditingViewportFloatingInAdmin && hasViewportFloatingIcons) {
      // 後台正在編輯「全頁裝飾」時，先隱藏 Hero 類區塊裝飾，避免同圖雙來源造成視覺誤判。
      if (blockId === "hero" || blockId === "hero_carousel") return null;
    }
    const b = getBlock(blockId);
    const sourceIcons = b?.floatingIcons ?? [];
    const dedupedIcons =
      !isAdminCanvas && viewportIconUrlSet.size > 0
        ? sourceIcons.filter((ic) => {
            const key = normalizeFloatingImageKey(ic.imageUrl);
            return !key || !viewportIconUrlSet.has(key);
          })
        : sourceIcons;
    if (dedupedIcons.length === 0) return null;
    return (
      <div className="pointer-events-none absolute inset-0 z-[15] w-full min-h-0">
        <div className="relative h-full w-full min-h-0">
          <HeroFloatingIconsLayer
            coordinateViewport={floatingCoordinateViewport}
            icons={dedupedIcons}
            scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
            horizontalLayout="content-column-in-viewport"
            columnContentInsetXPx={LAYOUT_CONTENT_COLUMN_INSET_X_PX}
          />
          {admin && admin.selectedBlockId === blockId ? (
            <div className="pointer-events-auto absolute inset-0 z-[16]" data-floating-icon-editor>
              <HeroFloatingIconsEditor
                overlayMode
                coordinateMode={coordMode}
                icons={sourceIcons}
                onChange={(next) => admin.onBlockFloatingIconsChange(blockId, next)}
                selectedIconId={admin.selectedFloatingIconId ?? null}
                onIconPointerDown={(id) => admin.onSelectFloatingIcon?.(blockId, id)}
                horizontalLayout="content-column-in-viewport"
                columnContentInsetXPx={LAYOUT_CONTENT_COLUMN_INSET_X_PX}
                scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                canvasPreviewScale={admin.canvasPreviewScale ?? 1}
                viewportInlineToolbar
                onRemoveIcon={(id) => {
                  admin.onBlockFloatingIconsChange(
                    blockId,
                    (sourceIcons ?? []).filter((x) => x.id !== id)
                  );
                  admin.onSelectFloatingIcon?.(blockId, "");
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const ph = previewHeader ?? null;
  const hasPreviewLogo = !!(ph?.logoUrl && ph.logoUrl.trim());
  const deskBg = ph?.headerBackgroundUrl?.trim() || null;
  const mobBg = ph?.headerBackgroundMobileUrl?.trim() || null;
  const hasPreviewHeaderBg = !!(deskBg || mobBg);
  const previewMobileBg = mobBg || deskBg;
  const previewDesktopBg = deskBg || mobBg;

  const aboutNavHref = normalizeAboutPageUrl(aboutPageUrl);
  const aboutNavIsExternal = /^https?:\/\//i.test(aboutNavHref);

  const headerInner = (
    <header
      className="sticky top-0 z-50 border-b border-gray-100 shadow-sm relative overflow-hidden"
      style={{ backgroundColor: aboutSectionBackgroundColor }}
    >
      {hasPreviewHeaderBg && previewMobileBg && previewDesktopBg && previewMobileBg !== previewDesktopBg ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat md:hidden"
            style={{ backgroundImage: `url(${previewMobileBg})` }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 z-0 hidden bg-cover bg-center bg-no-repeat md:block"
            style={{ backgroundImage: `url(${previewDesktopBg})` }}
            aria-hidden
          />
        </>
      ) : hasPreviewHeaderBg && previewDesktopBg ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${previewDesktopBg})` }}
          aria-hidden
        />
      ) : null}
      <div className="relative z-10 mx-auto max-w-7xl px-4 h-14 flex items-center justify-between gap-2">
        {hasPreviewLogo ? (
          <div className="shrink-0 flex items-center max-h-12">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ph!.logoUrl!.trim()}
              alt=""
              className="max-h-11 w-auto max-w-[200px] object-contain"
            />
          </div>
        ) : (
          <h1 className="text-xl font-bold text-brand shrink-0">{siteName}</h1>
        )}
        <div className="flex items-center gap-2 sm:gap-3 shrink min-w-0 overflow-x-auto scrollbar-hide">
          {aboutNavIsExternal ? (
            <a
              href={aboutNavHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-brand text-sm whitespace-nowrap touch-manipulation py-1.5 -my-1.5"
            >
              {navAboutLabel || "關於我們"}
            </a>
          ) : (
            <Link
              href={aboutNavHref}
              prefetch
              className="text-gray-600 hover:text-brand text-sm whitespace-nowrap touch-manipulation py-1.5 -my-1.5"
            >
              {navAboutLabel || "關於我們"}
            </Link>
          )}
          <Link
            href="/courses"
            prefetch
            className="text-gray-600 hover:text-brand text-sm whitespace-nowrap touch-manipulation py-1.5 -my-1.5"
          >
            {navCoursesLabel || "課程介紹"}
          </Link>
          <Link
            href="/course/booking"
            prefetch
            className="text-gray-600 hover:text-brand text-sm whitespace-nowrap"
          >
            {navBookingLabel || "課程預約"}
          </Link>
          <a href="#faq" className="text-gray-600 hover:text-brand text-sm whitespace-nowrap">
            {navFaqLabel || "常見問題"}
          </a>
          <HeaderMember />
        </div>
      </div>
    </header>
  );

  const heroBlock = getBlock("hero");
  const heroCarouselBlock = getBlock("hero_carousel");
  /**
   * 主圖合併槽：優先使用「首頁大圖」(hero) 的裝飾圖；若 hero 存在但尚未掛圖、圖在「首頁大圖（輪播）」(hero_carousel)，則改顯示後者。
   * 舊邏輯在兩區塊並存時只讀 hero，常導致前台完全沒有裝飾圖請求。
   */
  const iconsForMainHeroSectionRaw =
    (heroBlock?.floatingIcons?.length ?? 0) > 0
      ? heroBlock!.floatingIcons
      : heroCarouselBlock?.floatingIcons;
  const iconsForMainHeroSection = useMemo(() => {
    if (isAdminCanvas) return iconsForMainHeroSectionRaw;
    if (!iconsForMainHeroSectionRaw || viewportIconUrlSet.size === 0) return iconsForMainHeroSectionRaw;
    // 前台若同圖同時存在於 Hero 區塊裝飾與全頁裝飾，隱藏 Hero 上該圖（保留全頁層），其餘區塊裝飾仍顯示。
    return iconsForMainHeroSectionRaw.filter((ic) => {
      const key = normalizeFloatingImageKey(ic.imageUrl);
      return !key || !viewportIconUrlSet.has(key);
    });
  }, [iconsForMainHeroSectionRaw, isAdminCanvas, viewportIconUrlSet]);
  const heroEditBlockId =
    admin?.selectedBlockId === "hero" || admin?.selectedBlockId === "hero_carousel"
      ? admin.selectedBlockId
      : null;
  const heroIconsForEditor =
    heroEditBlockId === "hero"
      ? heroBlock?.floatingIcons
      : heroEditBlockId === "hero_carousel"
        ? heroCarouselBlock?.floatingIcons
        : undefined;
  const showFloatingEditorOnMainHero =
    admin &&
    heroEditBlockId &&
    ((heroEditBlockId === "hero" && (heroBlock?.floatingIcons?.length ?? 0) > 0) ||
      (heroEditBlockId === "hero_carousel" && !heroBlock && (heroCarouselBlock?.floatingIcons?.length ?? 0) > 0));

  /**
   * 有主圖或裝飾圖即顯示主圖區；僅裝飾、無主圖時仍畫出同比例底框。
   * 後台畫布（admin）即使無圖、無裝飾亦顯示佔位，以便預覽版面並在畫布上選檔；訪客首頁無 admin 時無圖無裝飾則不渲染。
   */
  const heroImageTrimmed = heroImageUrl?.trim() || null;
  const heroImageMobileTrimmed = heroImageMobileUrl?.trim() || null;
  const resolvedHeroImageMobile = heroImageMobileTrimmed || heroImageTrimmed;
  const hasSplitHeroByViewport =
    !!heroImageTrimmed &&
    !!resolvedHeroImageMobile &&
    heroImageTrimmed !== resolvedHeroImageMobile;
  const hasMainHeroVisual =
    !!heroImageTrimmed ||
    (iconsForMainHeroSection != null && iconsForMainHeroSection.length > 0) ||
    !!admin;

  const heroInner = hasMainHeroVisual ? (
    <section className="relative w-full pt-0 pb-4">
      {/* minHeight／背景在此層：裝飾圖 absolute 以此層為參考，勿只加在外層 section */}
      <div className="relative w-full min-h-0" style={getBlockStyle("hero")}>
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-4">
          <div className="relative w-full aspect-[4/5] sm:aspect-[3/2] md:aspect-auto md:h-[600px] rounded-xl overflow-hidden bg-amber-50">
          {heroImageTrimmed || resolvedHeroImageMobile ? (
            <>
              {hasSplitHeroByViewport ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolvedHeroImageMobile!} alt="" className="absolute inset-0 w-full h-full object-cover md:hidden" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroImageTrimmed!} alt="" className="absolute inset-0 hidden w-full h-full object-cover md:block" />
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(heroImageTrimmed ?? resolvedHeroImageMobile)!} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
            </>
          ) : (
            <div className="absolute inset-0 bg-amber-50" aria-hidden />
          )}
          {admin && admin.onHeroImagePickRequest ? (
            <button
              type="button"
              aria-label={heroImageTrimmed ? "更換首頁主圖" : "選擇首頁主圖"}
              className="absolute inset-0 z-[12] flex flex-col border-0 bg-black/0 hover:bg-black/[0.06] active:bg-black/10 cursor-pointer p-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset"
              onClick={(e) => {
                e.stopPropagation();
                admin.onHeroImagePickRequest?.();
              }}
            >
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-4">
                {!heroImageTrimmed ? (
                  <span className="pointer-events-none rounded-lg border-2 border-dashed border-amber-400/90 bg-white/90 px-4 py-3 text-sm font-medium text-amber-900 shadow-sm">
                    選擇首頁主圖
                  </span>
                ) : null}
              </div>
              {heroImageTrimmed ? (
                <div className="pointer-events-none flex shrink-0 justify-center pb-3 pt-1">
                  <span className="rounded-full bg-black/55 px-3 py-1.5 text-center text-xs font-medium text-white shadow-md">
                    點擊此區更換首頁主圖
                  </span>
                </div>
              ) : null}
            </button>
          ) : null}
          </div>
        </div>
        {(iconsForMainHeroSection?.length ?? 0) > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-[15] min-h-0">
            <div className="relative h-full w-full min-h-0">
              <HeroFloatingIconsLayer
                coordinateViewport={floatingCoordinateViewport}
                icons={iconsForMainHeroSection!}
                scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                horizontalLayout="content-column-in-viewport"
                columnContentInsetXPx={LAYOUT_CONTENT_COLUMN_INSET_X_PX}
              />
              {showFloatingEditorOnMainHero && heroIconsForEditor && heroIconsForEditor.length > 0 && heroEditBlockId ? (
                <div className="pointer-events-auto absolute inset-0 z-[16]" data-floating-icon-editor>
                  <HeroFloatingIconsEditor
                    overlayMode
                    coordinateMode={coordMode}
                    icons={heroIconsForEditor}
                    onChange={(next) => admin.onBlockFloatingIconsChange(heroEditBlockId, next)}
                    selectedIconId={admin.selectedFloatingIconId ?? null}
                    onIconPointerDown={(id) => admin.onSelectFloatingIcon?.(heroEditBlockId, id)}
                    horizontalLayout="content-column-in-viewport"
                    columnContentInsetXPx={LAYOUT_CONTENT_COLUMN_INSET_X_PX}
                    scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                    canvasPreviewScale={admin.canvasPreviewScale ?? 1}
                    viewportInlineToolbar
                    onRemoveIcon={(id) => {
                      admin.onBlockFloatingIconsChange(
                        heroEditBlockId,
                        (heroIconsForEditor ?? []).filter((x) => x.id !== id)
                      );
                      admin.onSelectFloatingIcon?.(heroEditBlockId, "");
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  ) : null;

  /** 與 heroInner 同高度，主圖 URL 尚未載入時佔位，避免下方精選／輪播先排版再被主圖推擠 */
  const heroPlaceholderInner = (
    <section className="w-full pt-0 pb-4">
      <div className="relative w-full min-h-0" style={getBlockStyle("hero")}>
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-4">
          <div
            className="relative w-full aspect-[4/5] sm:aspect-[3/2] md:aspect-auto md:h-[600px] rounded-xl overflow-hidden bg-amber-50 animate-pulse"
            aria-hidden
          />
        </div>
      </div>
    </section>
  );

  const heroCarouselStripInner =
    admin && (heroImageTrimmed || resolvedHeroImageMobile) && heroBlock && heroCarouselBlock ? (
      <section
        className="relative w-full border-t border-dashed border-amber-300/80 bg-amber-50/35"
        style={getBlockStyle("hero_carousel")}
      >
        <div className="relative mx-auto max-w-7xl px-4 py-4 min-h-[100px]">
          <p className="text-xs text-center text-gray-600 relative z-0">
            首頁大圖（輪播）裝飾圖層—與上方主圖共用同一張圖；此區編輯「首頁大圖（輪播）」積木的裝飾圖。
          </p>
        </div>
        {(heroCarouselBlock.floatingIcons?.length ?? 0) > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-[15] min-h-0 pt-10">
            <div className="relative h-full w-full min-h-0">
              <HeroFloatingIconsLayer
                coordinateViewport={floatingCoordinateViewport}
                icons={heroCarouselBlock.floatingIcons!}
                scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                horizontalLayout="content-column-in-viewport"
                columnContentInsetXPx={LAYOUT_CONTENT_COLUMN_INSET_X_PX}
              />
              {admin.selectedBlockId === "hero_carousel" ? (
                <div className="pointer-events-auto absolute inset-0 z-[16]" data-floating-icon-editor>
                  <HeroFloatingIconsEditor
                    overlayMode
                    coordinateMode={coordMode}
                    icons={heroCarouselBlock.floatingIcons!}
                    onChange={(next) => admin.onBlockFloatingIconsChange("hero_carousel", next)}
                    selectedIconId={admin.selectedFloatingIconId ?? null}
                    onIconPointerDown={(id) => admin.onSelectFloatingIcon?.("hero_carousel", id)}
                    horizontalLayout="content-column-in-viewport"
                    columnContentInsetXPx={LAYOUT_CONTENT_COLUMN_INSET_X_PX}
                    scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                    canvasPreviewScale={admin.canvasPreviewScale ?? 1}
                    viewportInlineToolbar
                    onRemoveIcon={(id) => {
                      admin.onBlockFloatingIconsChange(
                        "hero_carousel",
                        (heroCarouselBlock.floatingIcons ?? []).filter((x) => x.id !== id)
                      );
                      admin.onSelectFloatingIcon?.("hero_carousel", "");
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    ) : null;

  const carouselBlock = resolveLayoutBlockForStyle(layoutBlocks, "carousel");
  const carouselMinH = effectiveLayoutBlockMinHeightPx(carouselBlock, layoutViewportForHeights) ?? null;
  const carouselInner =
    carouselList.length > 0 ? (
      <section className="relative w-full py-4" style={getBlockStyle("carousel")}>
        <div className="mx-auto max-w-7xl px-4 sm:px-4">
          <div
            className={`relative w-full rounded-xl overflow-hidden ${carouselMinH == null ? "aspect-[12/5]" : ""}`}
            style={
              carouselMinH != null
                ? {
                    aspectRatio: "12 / 5",
                    minHeight: carouselMinH,
                    width: "100%",
                  }
                : undefined
            }
          >
            {carouselList.map((item, i) => (
              <div
                key={item.id}
                className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${
                  i === wallIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                } ${item.imageUrl ? "bg-gray-900" : "bg-amber-100"}`}
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <LucideImage className="w-12 h-12 text-gray-400 relative z-10" strokeWidth={1.5} />
                )}
              </div>
            ))}
            <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1.5">
              {carouselList.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setWallIndex(i)}
                  aria-label={`第 ${i + 1} 張`}
                  className={`h-2 rounded-full transition-all ${
                    i === wallIndex ? "w-6 bg-amber-500" : "w-2 bg-white/80 hover:bg-white"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
        {(carouselBlock?.floatingIcons?.length ?? 0) > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-[25] min-h-0">
            <div className="relative h-full w-full min-h-0">
              <HeroFloatingIconsLayer
                coordinateViewport={floatingCoordinateViewport}
                icons={carouselBlock!.floatingIcons!}
                scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                horizontalLayout="content-column-in-viewport"
                columnContentInsetXPx={LAYOUT_CONTENT_COLUMN_INSET_X_PX}
              />
              {admin &&
              admin.selectedBlockId === "carousel" &&
              (carouselBlock?.floatingIcons?.length ?? 0) > 0 ? (
                <div className="pointer-events-auto absolute inset-0 z-[26]" data-floating-icon-editor>
                  <HeroFloatingIconsEditor
                    overlayMode
                    coordinateMode={coordMode}
                    icons={carouselBlock!.floatingIcons!}
                    onChange={(next) => admin.onBlockFloatingIconsChange("carousel", next)}
                    selectedIconId={admin.selectedFloatingIconId ?? null}
                    onIconPointerDown={(id) => admin.onSelectFloatingIcon?.("carousel", id)}
                    horizontalLayout="content-column-in-viewport"
                    columnContentInsetXPx={LAYOUT_CONTENT_COLUMN_INSET_X_PX}
                    scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                    canvasPreviewScale={admin.canvasPreviewScale ?? 1}
                    viewportInlineToolbar
                    onRemoveIcon={(id) => {
                      admin.onBlockFloatingIconsChange(
                        "carousel",
                        (carouselBlock?.floatingIcons ?? []).filter((x) => x.id !== id)
                      );
                      admin.onSelectFloatingIcon?.("carousel", "");
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    ) : null;

  const featuredCoursesInner = (
    <div className="relative w-full">
      <HomeFeaturedCoursesOnePlusSix
        blockStyle={getBlockStyle("featured_categories")}
        prefetchedActivities={!isAdminCanvas ? featuredHomePageActivities : undefined}
        prefetchedLoading={!isAdminCanvas ? homeCoursesLoading : undefined}
      />
      {renderBlockFloatingIconsOverlay("featured_categories")}
    </div>
  );

  const aboutInner =
    aboutContent != null && aboutContent.trim() !== "" ? (
      <section
        id="about"
        className="relative py-12 scroll-mt-20 border-t border-gray-100"
        style={{ backgroundColor: aboutSectionBackgroundColor, ...getBlockStyle("about") }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-4">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">{navAboutLabel || "關於我們"}</h2>
          <div
            className="prose prose-gray max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: aboutContent }}
          />
        </div>
        {renderBlockFloatingIconsOverlay("about")}
      </section>
    ) : null;

  const faqInner = (
    <section
      id="faq"
      className="relative bg-white py-12 scroll-mt-20"
      style={getBlockStyle("faq")}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-4">
        <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">常見問題</h2>
        <FAQ />
      </div>
      {renderBlockFloatingIconsOverlay("faq")}
    </section>
  );

  const contactInner = (
    <section
      className="relative bg-page border-t border-gray-100 py-12"
      style={getBlockStyle("contact")}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            {(hasContact || hasSocialLinks) && (
              <>
                <p className="text-xl font-bold text-brand">{siteName}</p>
                {hasContact && (
                  <div className="text-gray-700 text-sm space-y-2">
                    {contactPhone && <p>聯絡電話：{contactPhone}</p>}
                    {contactEmail && (
                      <p>
                        信箱：{" "}
                        <a href={`mailto:${contactEmail}`} className="text-brand hover:underline">
                          {contactEmail}
                        </a>
                      </p>
                    )}
                    {contactAddress && <p>地址：{contactAddress}</p>}
                  </div>
                )}
                <div className="flex flex-wrap gap-6">
                  {socialFbUrl ? (
                    <a
                      href={socialFbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 text-gray-600 hover:opacity-80 transition-opacity"
                      aria-label="Facebook"
                    >
                      <span
                        className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm"
                        style={{ color: primaryColor }}
                      >
                        <Facebook className="w-5 h-5" strokeWidth={2} />
                      </span>
                      <span className="text-xs font-medium">Facebook</span>
                    </a>
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-gray-400" aria-hidden>
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm">
                        <Facebook className="w-5 h-5" strokeWidth={2} />
                      </span>
                      <span className="text-xs font-medium">Facebook</span>
                    </span>
                  )}
                  {socialIgUrl ? (
                    <a
                      href={socialIgUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 text-gray-600 hover:opacity-80 transition-opacity"
                      aria-label="Instagram"
                    >
                      <span
                        className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm"
                        style={{ color: primaryColor }}
                      >
                        <Instagram className="w-5 h-5" strokeWidth={2} />
                      </span>
                      <span className="text-xs font-medium">Instagram</span>
                    </a>
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-gray-400" aria-hidden>
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm">
                        <Instagram className="w-5 h-5" strokeWidth={2} />
                      </span>
                      <span className="text-xs font-medium">Instagram</span>
                    </span>
                  )}
                  {socialLineUrl ? (
                    <a
                      href={socialLineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 text-gray-600 hover:opacity-80 transition-opacity"
                      aria-label="LINE"
                    >
                      <span
                        className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm"
                        style={{ color: primaryColor }}
                      >
                        <LineIcon className="w-5 h-5" />
                      </span>
                      <span className="text-xs font-medium">LINE</span>
                    </a>
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-gray-400" aria-hidden>
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm">
                        <LineIcon className="w-5 h-5" />
                      </span>
                      <span className="text-xs font-medium">LINE</span>
                    </span>
                  )}
                </div>
              </>
            )}
            {!hasContact && !hasSocialLinks && (
              <p className="text-sm text-gray-500">請至後台「基本資料」填寫聯絡資訊與社群連結。</p>
            )}
          </div>
          {mapEmbedUrl && (
            <div className="w-full min-h-0 rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm flex flex-col max-h-[320px]">
              <iframe
                src={mapEmbedUrl}
                title="地圖"
                className="w-full h-full min-h-[240px] max-h-[320px] border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}
        </div>
        <div className="mt-8 pt-6 border-t border-gray-200 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-gray-600">
          <button
            type="button"
            className="hover:text-brand hover:underline"
            onClick={() => setPrivacyModalOpen(true)}
          >
            隱私權條款
          </button>
          <button
            type="button"
            className="hover:text-brand hover:underline"
            onClick={() => setTermsModalOpen(true)}
          >
            服務條款
          </button>
        </div>
      </div>
      {renderBlockFloatingIconsOverlay("contact")}
    </section>
  );

  const footerInner = (
    <footer className="relative bg-white border-t border-gray-100 mt-auto" style={getBlockStyle("footer")}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="text-center text-gray-400 text-sm">
          <p>
            <a
              href={JOYSEED_ISLAND_WEB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-brand hover:underline"
            >
              © 2026 {siteName} WonderVoyage 版權所有
            </a>
          </p>
        </div>
      </div>
      {renderBlockFloatingIconsOverlay("footer")}
    </footer>
  );
  const privacyModal = privacyModalOpen ? (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="關閉隱私權條款視窗"
        onClick={() => setPrivacyModalOpen(false)}
      />
      <div className="relative z-[121] w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-900">隱私權政策</h3>
          <button
            type="button"
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            onClick={() => setPrivacyModalOpen(false)}
          >
            關閉
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-4 py-4">
          <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{privacyModalContent}</pre>
        </div>
      </div>
    </div>
  ) : null;
  const termsModal = termsModalOpen ? (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="關閉服務條款視窗"
        onClick={() => setTermsModalOpen(false)}
      />
      <div className="relative z-[121] w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-900">使用者服務條款</h3>
          <button
            type="button"
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            onClick={() => setTermsModalOpen(false)}
          >
            關閉
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-4 py-4">
          <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{termsModalContent}</pre>
        </div>
      </div>
    </div>
  ) : null;

  const renderCoursesGridOrListSection = (
    blockId: "courses" | "courses_grid" | "courses_list"
  ): React.ReactNode => {
    const variant = blockId === "courses_list" ? "list" : "grid";
    const inner = (
      <section className="relative w-full py-6 pb-8 bg-page" style={getBlockStyle(blockId)}>
        {admin ? (
          <div className="max-w-7xl mx-auto px-4 mb-2">
            <p className="text-[11px] font-medium text-amber-900/90 bg-amber-100/60 border border-amber-200/80 rounded-lg px-2 py-1 inline-block">
              {variant === "list"
                ? "列表：橫向精簡卡（左圖右文、窄畫布亦穩定）"
                : "網格：多欄卡片"}
            </p>
          </div>
        ) : null}
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">熱門課程</h2>
          <HomeCoursesGridListBlock
            variant={variant}
            activities={homeActivities}
            loading={homeCoursesLoading}
            error={homeCoursesError}
            showPreviewHint={!!admin}
          />
        </div>
        {renderBlockFloatingIconsOverlay(blockId)}
      </section>
    );
    return admin ? wrap(blockId, inner) : inner;
  };

  /** 後台畫布專用：總站版型區塊在分站首頁不渲染，此處顯示佔位以利選取與編輯背景／高度／裝飾圖 */
  const renderAdminOnlyPlaceholder = (
    blockId:
      | "new_courses"
      | "popular_experiences"
      | "carousel_2",
    title: string,
    description: string
  ): React.ReactNode => {
    if (!admin) return null;
    const b = getBlock(blockId);
    const inner = (
      <section className="relative w-full border-t border-dashed border-amber-300/80 bg-amber-50/35" style={getBlockStyle(blockId)}>
        <div className="relative mx-auto max-w-7xl px-4 py-8 min-h-[140px]">
          <p className="text-sm font-semibold text-center text-amber-950">{title}</p>
          <p className="text-xs text-gray-600 text-center mt-2 max-w-lg mx-auto leading-relaxed">{description}</p>
        </div>
        {(b?.floatingIcons?.length ?? 0) > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-[15] min-h-0">
            <div className="relative h-full w-full min-h-0">
              <HeroFloatingIconsLayer
                coordinateViewport={floatingCoordinateViewport}
                icons={b!.floatingIcons!}
                scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                horizontalLayout="content-column-in-viewport"
                columnContentInsetXPx={LAYOUT_CONTENT_COLUMN_INSET_X_PX}
              />
              {admin.selectedBlockId === blockId ? (
                <div className="pointer-events-auto absolute inset-0 z-[16]" data-floating-icon-editor>
                  <HeroFloatingIconsEditor
                    overlayMode
                    coordinateMode={coordMode}
                    icons={b!.floatingIcons!}
                    onChange={(next) => admin.onBlockFloatingIconsChange(blockId, next)}
                    selectedIconId={admin.selectedFloatingIconId ?? null}
                    onIconPointerDown={(id) => admin.onSelectFloatingIcon?.(blockId, id)}
                    horizontalLayout="content-column-in-viewport"
                    columnContentInsetXPx={LAYOUT_CONTENT_COLUMN_INSET_X_PX}
                    scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                    canvasPreviewScale={admin.canvasPreviewScale ?? 1}
                    viewportInlineToolbar
                    onRemoveIcon={(id) => {
                      admin.onBlockFloatingIconsChange(
                        blockId,
                        (b?.floatingIcons ?? []).filter((x) => x.id !== id)
                      );
                      admin.onSelectFloatingIcon?.(blockId, "");
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    );
    return wrap(blockId, inner);
  };

  const renderSectionById = (id: string): React.ReactNode => {
    switch (id) {
      case "header":
        return wrap("header", headerInner, { skipBackgroundImage: true });
      case "hero": {
        if (!heroSettingsLoaded) {
          return wrap("hero", heroPlaceholderInner, { blockOverride: heroBlock ?? undefined });
        }
        if (!heroInner) return null;
        return wrap("hero", heroInner, { blockOverride: heroBlock ?? undefined });
      }
      case "hero_carousel": {
        if (!admin || (!heroImageTrimmed && !resolvedHeroImageMobile)) return null;
        if (heroBlock && heroCarouselBlock && heroCarouselStripInner) {
          return wrap("hero_carousel", heroCarouselStripInner);
        }
        if (!heroBlock && heroCarouselBlock) {
          return wrap("hero_carousel", heroInner, { blockOverride: heroCarouselBlock });
        }
        return null;
      }
      case "carousel":
        if (carouselList.length === 0) return null;
        return wrap("carousel", carouselInner);
      case "courses":
        return renderCoursesGridOrListSection("courses");
      case "featured_categories":
        return wrap("featured_categories", featuredCoursesInner);
      case "about":
        if (!aboutInner) return null;
        return wrap("about", aboutInner);
      case "faq":
        return wrap("faq", faqInner);
      case "contact":
        return wrap("contact", contactInner);
      case "footer":
        return wrap("footer", footerInner);
      case "new_courses":
        return renderAdminOnlyPlaceholder(
          "new_courses",
          "新上架課程",
          "後台畫布預覽區。可調整高度、背景圖、裝飾圖；目前分站首頁訪客畫面不顯示此區塊。"
        );
      case "popular_experiences":
        return renderAdminOnlyPlaceholder(
          "popular_experiences",
          "熱門體驗",
          "後台畫布預覽區。可調整高度、背景圖、裝飾圖；目前分站首頁訪客畫面不顯示此區塊。"
        );
      case "carousel_2":
        return renderAdminOnlyPlaceholder(
          "carousel_2",
          LAYOUT_SECTION_LABELS.carousel_2,
          "後台畫布預覽區。可調整高度、背景圖、裝飾圖；總站首頁輪播牆 2 於前台設定；分站訪客畫面是否顯示依版型而定。"
        );
      case "full_width_image": {
        const b = getBlock("full_width_image");
        if (admin) {
          const inner = (
            <section
              className="relative w-full border-t border-dashed border-amber-300/80 bg-amber-50/35"
              style={getBlockStyle("full_width_image")}
            >
              <div className="relative mx-auto max-w-7xl px-4 py-8 min-h-[120px]">
                {fullWidthImageUrl ? (
                  <div className="relative w-full max-h-[220px] rounded-lg overflow-hidden bg-gray-100 border border-amber-200/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fullWidthImageUrl} alt="" className="w-full h-full max-h-[220px] object-cover" />
                  </div>
                ) : null}
                <p className="text-sm font-semibold text-center text-amber-950 mt-4">{LAYOUT_SECTION_LABELS.full_width_image}</p>
                <p className="text-xs text-gray-600 text-center mt-2 max-w-lg mx-auto leading-relaxed">
                  後台畫布預覽；於此區上傳圖後按「儲存版面」寫入前台。可調整高度、背景圖、裝飾圖。
                </p>
              </div>
              {(b?.floatingIcons?.length ?? 0) > 0 ? (
                <div className="pointer-events-none absolute inset-0 z-[15] min-h-0">
                  <div className="relative h-full w-full min-h-0">
                    <HeroFloatingIconsLayer
                      coordinateViewport={floatingCoordinateViewport}
                      icons={b!.floatingIcons!}
                      scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                      horizontalLayout="content-column-in-viewport"
                      columnContentInsetXPx={LAYOUT_CONTENT_COLUMN_INSET_X_PX}
                    />
                    {admin.selectedBlockId === "full_width_image" ? (
                      <div className="pointer-events-auto absolute inset-0 z-[16]" data-floating-icon-editor>
                        <HeroFloatingIconsEditor
                          overlayMode
                          coordinateMode={coordMode}
                          icons={b!.floatingIcons!}
                          onChange={(next) => admin.onBlockFloatingIconsChange("full_width_image", next)}
                          selectedIconId={admin.selectedFloatingIconId ?? null}
                          onIconPointerDown={(id) => admin.onSelectFloatingIcon?.("full_width_image", id)}
                          horizontalLayout="content-column-in-viewport"
                          columnContentInsetXPx={LAYOUT_CONTENT_COLUMN_INSET_X_PX}
                          scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                          canvasPreviewScale={admin.canvasPreviewScale ?? 1}
                          viewportInlineToolbar
                          onRemoveIcon={(id) => {
                            admin.onBlockFloatingIconsChange(
                              "full_width_image",
                              (b?.floatingIcons ?? []).filter((x) => x.id !== id)
                            );
                            admin.onSelectFloatingIcon?.("full_width_image", "");
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          );
          return wrap("full_width_image", inner);
        }
        const fw = fullWidthImageUrl?.trim() ?? "";
        const hasFloat = (b?.floatingIcons?.length ?? 0) > 0;
        if (!fw && !hasFloat) return null;
        const innerVisitor = (
          <section className="relative w-full" style={getBlockStyle("full_width_image")}>
            {fw ? (
              <FullWidthImageSection imageUrl={fw} />
            ) : (
              <div className="relative w-full min-h-[120px] rounded-lg bg-gray-50" aria-hidden />
            )}
            {hasFloat ? (
              <div className="pointer-events-none absolute inset-0 z-[30] min-h-0">
                <div className="relative h-full min-h-[120px] w-full">
                  <HeroFloatingIconsLayer
                    coordinateViewport={floatingCoordinateViewport}
                    icons={b!.floatingIcons!}
                    scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                    horizontalLayout="content-column-in-viewport"
                    columnContentInsetXPx={LAYOUT_CONTENT_COLUMN_INSET_X_PX}
                  />
                </div>
              </div>
            ) : null}
          </section>
        );
        return wrap("full_width_image", innerVisitor);
      }
      case "courses_grid":
        return renderCoursesGridOrListSection("courses_grid");
      case "courses_list":
        return renderCoursesGridOrListSection("courses_list");
      default:
        return null;
    }
  };

  return (
    <div
      className={
        isAdminCanvas
          ? "relative min-h-min w-full min-w-0 bg-page flex flex-col overflow-x-visible"
          : "relative min-h-screen w-full min-w-0 bg-page flex flex-col overflow-x-visible"
      }
      {...(isAdminCanvas
        ? {
            onClickCapture: suppressCanvasLinkNavigation,
            onAuxClickCapture: suppressCanvasLinkNavigation,
          }
        : {})}
    >
      <div
        ref={viewportRootRef}
        className={isAdminCanvas && hasAdminViewportFloatingIcons ? "relative min-w-0" : "relative"}
      >
        {!isAdminCanvas && hasViewportFloatingIcons && viewportLayerReady ? (
          <div
            data-viewport-floating-shell
            className="pointer-events-none absolute inset-0 z-[32] w-full"
            style={viewportLayerHeightPx != null ? { height: viewportLayerHeightPx } : undefined}
            aria-hidden
          >
            <div className="relative h-full w-full min-w-0">
              <HeroFloatingIconsLayer
                icons={viewportFloatingIcons ?? undefined}
                coordinateViewport={floatingCoordinateViewport}
                scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                horizontalLayout="content-column-in-viewport"
              />
            </div>
          </div>
        ) : null}
        {isAdminCanvas &&
        admin?.onViewportFloatingIconsChange &&
        (admin.viewportFloatingIcons?.length ?? 0) > 0 ? (
          <div
            data-viewport-floating-shell
            className="pointer-events-none absolute inset-0 z-[32] w-full"
            style={adminViewportLayerHeightPx != null ? { height: adminViewportLayerHeightPx } : undefined}
          >
            <div
              className="relative h-full w-full min-w-0"
              style={{
                transform: `translate(${ADMIN_VIEWPORT_FLOATING_X_OFFSET_PX}px, ${ADMIN_VIEWPORT_FLOATING_Y_OFFSET_PX}px)`,
              }}
            >
              <HeroFloatingIconsLayer
                icons={admin.viewportFloatingIcons}
                coordinateViewport={floatingCoordinateViewport}
                scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                horizontalLayout="content-column-in-viewport"
              />
              <div className="absolute inset-0 z-[33]" data-floating-icon-editor data-viewport-floating-editor>
                <HeroFloatingIconsEditor
                  overlayMode
                  coordinateMode={coordMode}
                  icons={admin.viewportFloatingIcons!}
                  onChange={admin.onViewportFloatingIconsChange}
                  selectedIconId={admin.selectedViewportFloatingIconId ?? null}
                  onIconPointerDown={(id) => admin.onSelectViewportFloatingIcon?.(id)}
                  scaleReferenceWidthPx={floatingScaleReferenceWidthPx}
                  horizontalLayout="content-column-in-viewport"
                  /**
                   * 手機 iframe 預覽偶發底層 Layer 尚未就緒，若 overlay 不畫圖會出現「看不到裝飾圖」。
                   * 這裡維持 overlay 同步顯示，確保拖曳編輯時永遠可見。
                   */
                  showImageInOverlay
                  viewportInlineToolbar
                  canvasPreviewScale={admin.canvasPreviewScale ?? 1}
                  onRemoveIcon={(id) => {
                    const next = (admin.viewportFloatingIcons ?? []).filter((x) => x.id !== id);
                    admin.onViewportFloatingIconsChange!(next);
                    admin.onSelectViewportFloatingIcon?.(null);
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}
        {visitorOrderedSectionIds.map((id) => {
          const node = renderSectionById(id);
          if (node == null) return null;
          return <Fragment key={id}>{node}</Fragment>;
        })}
      </div>
      {adminOnlyOrderedSectionIds.map((id) => {
        const node = renderSectionById(id);
        if (node == null) return null;
        return <Fragment key={id}>{node}</Fragment>;
      })}
      {privacyModal}
      {termsModal}
    </div>
  );
}
