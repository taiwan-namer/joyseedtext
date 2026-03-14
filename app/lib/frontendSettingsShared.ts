/** 前台設定共用型別與常數（供 actions 與 client 使用，不可放在 "use server" 檔案） */

export type CarouselItem = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  /** 是否顯示於前台輪播，預設 true */
  visible?: boolean;
};

export type FrontendSettings = {
  heroImageUrl: string | null;
  heroTitle: string | null;
  carouselItems: CarouselItem[];
  navAboutLabel: string;
  navCoursesLabel: string;
  navBookingLabel: string;
  navFaqLabel: string;
  memberIconGallery: string[];
  memberIconSelectedIndex: number;
  /** 關於我們區塊的富文本內容（HTML） */
  aboutContent: string | null;
  /** SEO：網頁標題（&lt;title&gt;） */
  seoTitle: string | null;
  /** SEO：關鍵字（逗號分隔） */
  seoKeywords: string | null;
  /** SEO：網頁描述（&lt;meta description&gt;） */
  seoDescription: string | null;
  /** SEO：分頁圖示（Favicon）網址，顯示於瀏覽器分頁左側 */
  seoFaviconUrl: string | null;
  /** 金流：Line Pay API（金鑰或設定） */
  linePayApi: string | null;
  /** 金流：第三方金流 API */
  thirdPartyApi: string | null;
  /** 金流 ATM：銀行單位（顯示名稱，如國泰銀行） */
  atmBankName: string | null;
  /** 金流 ATM：銀行代碼（例 013） */
  atmBankCode: string | null;
  /** 金流 ATM：銀行帳號 */
  atmBankAccount: string | null;
  /** 金流開關：藍新 NewebPay（結帳頁顯示/隱藏） */
  paymentNewebpayEnabled: boolean;
  /** 金流開關：綠界 ECPay */
  paymentEcpayEnabled: boolean;
  /** 金流開關：LINE Pay */
  paymentLinepayEnabled: boolean;
  /** 金流開關：ATM 銀行轉帳（開啟時需填寫銀行資訊） */
  paymentAtmEnabled: boolean;
};

/** 預設 10 個會員圖示（專案 public/member-icons/ 內建） */
export const DEFAULT_MEMBER_ICON_URLS: string[] = [
  "/member-icons/1.svg",
  "/member-icons/2.svg",
  "/member-icons/3.svg",
  "/member-icons/4.svg",
  "/member-icons/5.svg",
  "/member-icons/6.svg",
  "/member-icons/7.svg",
  "/member-icons/8.svg",
  "/member-icons/9.svg",
  "/member-icons/10.svg",
];

export const DEFAULT_CAROUSEL: CarouselItem[] = [
  { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
  { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
  { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
];

export const DEFAULT_HERO_TITLE = "探索孩子的無限潛能";
export const DEFAULT_NAV = { about: "關於我們", courses: "課程介紹", booking: "課程預約", faq: "常見問題" };
