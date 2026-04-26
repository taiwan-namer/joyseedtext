"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { X, Eye, EyeOff, Mail } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { sendRegistrationOtp, syncAuthUserToMembers } from "@/app/actions/memberActions";
import { mapSupabaseAuthErrorToZh } from "@/lib/auth/supabaseAuthErrorZh";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";

const REGISTER_OTP_COOLDOWN_SEC = 60;

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export type LoginModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** 從網址 ?openLogin=email 進來時傳 2，直接顯示 E-mail 登入表單 */
  initialStep?: 1 | 2 | 3;
  /** 登入／註冊成功後呼叫（例如結帳頁用來立即送出報名）；傳入 Supabase session 可省一次 getSession */
  onSuccess?: (session: Session | null) => void;
  /** OAuth 導向時帶上的 next，回站時導回此網址 */
  returnTo?: string;
  /** 使用 Google 登入、即將導出前呼叫（例如結帳頁寫入暫存） */
  onBeforeGoogleRedirect?: () => void;
};

type Step = 1 | 2 | 3 | 4;

function translateAuthErrorMessage(message: string | null | undefined): string {
  const raw = String(message ?? "").trim();
  if (!raw) return "登入失敗，請稍後再試";

  const normalized = raw.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "帳號或密碼錯誤";
  if (normalized.includes("email not confirmed")) return "信箱尚未驗證，請先完成驗證";
  if (normalized.includes("user already registered")) return "此電子郵件已註冊";
  if (normalized.includes("password should be at least")) return "密碼長度不足，請至少輸入 6 碼";
  if (normalized.includes("invalid email")) return "電子郵件格式不正確";
  if (normalized.includes("too many requests")) return "嘗試次數過多，請稍後再試";
  if (normalized.includes("network") || normalized.includes("fetch")) return "網路連線異常，請稍後再試";
  return "登入失敗，請確認帳號密碼或稍後再試";
}

export default function LoginModal({
  isOpen,
  onClose,
  initialStep,
  onSuccess,
  returnTo,
  onBeforeGoogleRedirect,
}: LoginModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerOtpSending, setRegisterOtpSending] = useState(false);
  const [registerOtpCooldown, setRegisterOtpCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (registerOtpCooldown <= 0) return;
    const t = setInterval(() => {
      setRegisterOtpCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [registerOtpCooldown]);

  useEffect(() => {
    if (isOpen) {
      setStep(initialStep ?? 1);
      setFormError(null);
      setForgotEmail("");
      setRegisterOtpCooldown(0);
    }
  }, [isOpen, initialStep]);

  const handleGoogleLogin = useCallback(async () => {
    setFormError(null);
    setOauthLoading(true);
    try {
      onBeforeGoogleRedirect?.();
      const origin = typeof location !== "undefined" ? location.origin : "";
      if (returnTo && typeof document !== "undefined") {
        document.cookie = `auth_return_to=${encodeURIComponent(returnTo)}; path=/; max-age=600; SameSite=Lax`;
      }
      const supabase = createClient();
      const redirectTo = `${origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setFormError(translateAuthErrorMessage(error.message));
      }
    } catch (e) {
      setFormError(e instanceof Error ? translateAuthErrorMessage(e.message) : "登入失敗，請稍後再試");
    } finally {
      setOauthLoading(false);
    }
  }, [returnTo, onBeforeGoogleRedirect]);

  const handleLoginSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const form = e.currentTarget;
    const email = (form.querySelector<HTMLInputElement>('[name="email"]')?.value ?? "").trim();
    const password = form.querySelector<HTMLInputElement>('[name="password"]')?.value ?? "";
    if (!email || !password) {
      setFormError("請輸入電子郵件與密碼");
      return;
    }
    setLoginLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setFormError(translateAuthErrorMessage(error.message));
        return;
      }
      onSuccess?.(data.session ?? null);
      onClose();
      void syncAuthUserToMembers().catch(() => {});
    } finally {
      setLoginLoading(false);
    }
  }, [onClose, onSuccess]);

  const handleSendRegisterOtp = useCallback(async () => {
    setFormError(null);
    const input = typeof document !== "undefined" ? (document.getElementById("reg-email") as HTMLInputElement | null) : null;
    const email = (input?.value ?? "").trim().toLowerCase();
    if (!email) {
      setFormError("請先輸入電子郵件，再傳送認證碼");
      return;
    }
    setRegisterOtpSending(true);
    try {
      const res = await sendRegistrationOtp(email);
      if (!res.success) {
        setFormError(res.error);
        return;
      }
      setRegisterOtpCooldown(REGISTER_OTP_COOLDOWN_SEC);
      setFormError("已傳送認證碼到您的信箱，請查收後輸入。");
    } finally {
      setRegisterOtpSending(false);
    }
  }, []);

  const handleRegisterSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const form = e.currentTarget;
    const email = (form.querySelector<HTMLInputElement>('[name="email"]')?.value ?? "").trim().toLowerCase();
    const otp = (form.querySelector<HTMLInputElement>('[name="otp"]')?.value ?? "").trim();
    const password = form.querySelector<HTMLInputElement>('[name="password"]')?.value ?? "";
    const confirm = form.querySelector<HTMLInputElement>('[name="confirmPassword"]')?.value ?? "";
    if (!email || !password) {
      setFormError("請填寫電子郵件與密碼");
      return;
    }
    if (!otp) {
      setFormError("請填寫信箱認證碼");
      return;
    }
    if (password !== confirm) {
      setFormError("兩次密碼輸入不一致");
      return;
    }
    if (password.length < 6) {
      setFormError("密碼至少 6 碼");
      return;
    }
    setRegisterLoading(true);
    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });
      if (otpError) {
        const msg = (otpError.message ?? "").toLowerCase();
        if (msg.includes("already") && msg.includes("registered")) {
          setStep(2);
          setFormError("此信箱已註冊，請直接登入；登入後會自動綁定到目前分站會員資料。");
          return;
        }
        setFormError(mapSupabaseAuthErrorToZh(otpError.message));
        return;
      }
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) {
        setFormError(mapSupabaseAuthErrorToZh(passwordError.message));
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      onSuccess?.(session ?? null);
      onClose();
      void syncAuthUserToMembers().catch(() => {});
    } finally {
      setRegisterLoading(false);
    }
  }, [onClose, onSuccess]);

  const handleForgotPasswordSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    const email = forgotEmail.trim().toLowerCase();
    if (!email) {
      setFormError("請先輸入註冊時的電子信箱");
      return;
    }
    setForgotLoading(true);
    try {
      const supabase = createClient();
      const origin = typeof location !== "undefined" ? location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      });
      if (error) {
        setFormError(translateAuthErrorMessage(error.message));
        return;
      }
      setFormError("已寄出重設密碼信，請前往信箱點擊連結。");
    } finally {
      setForgotLoading(false);
    }
  }, [forgotEmail]);

  const { siteName, contactEmail, socialLineUrl } = useStoreSettings();
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
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
      "",
      "基本識別資料：姓名、暱稱、電子郵件、聯絡電話、住址等。",
      "",
      "兒童活動必要資料：參加者姓名、性別、出生年月日、過敏或特殊健康需求。",
      "",
      "金流與交易資料：付款方式（信用卡由第三方金流處理，本單位僅接收交易結果代碼）、退款資料、發票資訊。",
      "",
      "使用與交易紀錄：預訂紀錄、取消紀錄、裝置資訊、IP 位址等。",
      "",
      "二、資料蒐集之目的",
      "本單位蒐集與利用資料之目的包含：",
      "",
      "課程／活動預訂、訂單管理與身分驗證。",
      "",
      "活動行前通知、緊急聯絡、客服詢問回覆。",
      "",
      "辦理活動必要之保險投保作業。",
      "",
      "透過系統商執行退費、改期或「安心包」爭議協調程序。",
      "",
      "法律義務（稅務、消費者保護等）。",
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
      "",
      "資料將依蒐集目的或法定保存期間保存，期間屆滿後將安全刪除或匿名化。",
      "",
      "系統商採用符合業界標準之安全措施（含 SSL 加密、權限控管、防火牆），以保護儲存於系統中之個人資料。但網路傳輸具不可控風險，請您妥善保管帳號密碼。",
      "",
      "五、LINE 通知型訊息",
      "為傳遞重要活動資訊（如行前通知、改期、緊急消息），本單位將透過系統商（童趣島）之 LINE 官方帳號或本單位綁定之帳號傳送「通知型訊息」。觸發條件：",
      "",
      "您在報名留下的電話號碼與 LINE 帳號電話相同。",
      "",
      "LINE 設定已允許接收「通知型訊息」。",
      "",
      "未封鎖發送端之官方帳號。",
      "若您於 LINE 設定中關閉「通知型訊息」，將無法收到系統自動發送之重要通知，可能影響您的活動參與權益。",
      "",
      "六、兒童隱私權特別聲明",
      "本單位服務對象包含未成年人：",
      "",
      "當您填寫兒童之個人資料時，視為您已以法定代理人身分同意本單位蒐集該資料。",
      "",
      "兒童資料僅嚴格用於活動報名審核、保險辦理及現場安全照護（如過敏核對），絕不挪作行銷他用。",
      "",
      "七、活動攝影與肖像權使用",
      "活動期間本單位可能進行拍攝紀錄，用於品質管理或本單位之社群行銷宣傳。",
      "",
      "您的權利：若您不希望孩子被拍攝或公開影像，請於活動現場主動告知本單位工作人員，我們將避免拍攝或進行遮蔽處理。未事先告知者，視為同意授權。",
      "",
      "八、當事人依個資法享有之權利",
      "您可隨時向本單位或系統商請求：",
      "",
      "查詢或閱覽個人資料",
      "",
      "製給複製本",
      "",
      "補充或更正資料",
      "",
      "停止蒐集、處理或利用",
      "",
      "請求刪除資料",
      "注意：若要求刪除資料，可能導致無法辦理保險、無法查詢歷史訂單或無法繼續提供服務。",
      "",
      "九、Cookie 與追蹤技術",
      "本網站由系統商維護，將使用 Cookie 以維持登入狀態及優化預訂流程。您可於瀏覽器設定拒絕 Cookie，但可能導致無法正常結帳或登入。",
      "",
      "十、政策修訂",
      "本單位與系統商保留修訂本政策之權利，更新後將公告於網站。",
      "",
      "聯絡方式",
      `單位名稱：${organizerName}`,
      ...(contactEmail?.trim() ? [`聯絡信箱：${contactEmail.trim()}`] : []),
      ...(socialLineUrl?.trim() ? [`官方 LINE：${socialLineUrl.trim()}`] : []),
      "系統客服支援：童趣島官方客服 (LINE ID: @joyseed2025)",
    ];
    return lines.join("\n");
  }, [organizerName, contactEmail, socialLineUrl]);
  function ModalHeader({ title }: { title?: string }) {
    return (
      <div className="text-center pt-6 pb-2">
        <p className="text-xl font-bold text-brand">{siteName}</p>
        <p className="text-xs text-gray-500 mt-0.5">全台親子體驗第一預訂平台</p>
        {title && <h2 className="text-lg font-bold text-gray-900 mt-4">{title}</h2>}
      </div>
    );
  }

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="relative w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 z-10"
          aria-label="關閉"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 圖1：選擇 Google 或 E-mail（無跳轉，全在彈窗內完成） */}
        {step === 1 && (
          <>
            <div className="px-6 pt-6 pb-2">
              <ModalHeader />
            </div>
            <div className="px-6 pb-6 space-y-4">
              {formError && (
                <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-100" role="alert">
                  {formError}
                </div>
              )}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={oauthLoading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-gray-200 bg-white text-gray-800 font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors touch-manipulation min-h-[48px]"
              >
                <GoogleIcon className="w-5 h-5 shrink-0" />
                {oauthLoading ? "處理中…" : "使用 Google 登入"}
              </button>
              <button
                type="button"
                onClick={() => { setFormError(null); setStep(2); }}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-gray-200 bg-white text-gray-800 font-medium hover:bg-gray-50 transition-colors touch-manipulation min-h-[48px]"
              >
                <Mail className="w-5 h-5 shrink-0 text-gray-500" />
                使用 E-mail 登入或註冊
              </button>
            </div>
            <div className="px-6 pb-6 text-center text-sm text-gray-500 space-y-1">
              {contactEmail?.trim() ? (
                <p>
                  <a
                    href={`mailto:${contactEmail.trim()}`}
                    className="text-amber-600 hover:underline touch-manipulation"
                  >
                    聯絡我們
                  </a>
                </p>
              ) : null}
              <p>
                註冊或登入即表示您瞭解並同意
                <button
                  type="button"
                  className="text-amber-600 hover:underline touch-manipulation"
                  onClick={() => setTermsModalOpen(true)}
                >
                  {" "}服務條款{" "}
                </button>
                及
                <button
                  type="button"
                  className="text-amber-600 hover:underline touch-manipulation"
                  onClick={() => setPrivacyModalOpen(true)}
                >
                  {" "}隱私政策
                </button>。
              </p>
            </div>
          </>
        )}

        {/* 圖2：登入（無驗證碼） */}
        {step === 2 && (
          <>
            <div className="px-6 pt-4">
              <ModalHeader title="登入" />
            </div>
            <div className="px-6 pb-6">
              {formError && (
                <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-100 mb-4" role="alert">
                  {formError}
                </div>
              )}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-gray-900 mb-1">帳號</label>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="請輸入電子郵件"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="login-password" className="block text-sm font-medium text-gray-900">密碼</label>
                    <button
                      type="button"
                      className="text-sm text-gray-500 hover:text-amber-600"
                      onClick={() => {
                        setFormError(null);
                        setForgotEmail("");
                        setStep(4);
                      }}
                    >
                      忘記密碼?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="請輸入密碼"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-2.5 rounded-lg font-medium text-gray-800 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-60 transition-colors touch-manipulation min-h-[48px]"
                >
                  {loginLoading ? "登入中…" : "登入"}
                </button>
              </form>
              <p className="text-center text-sm text-gray-600 mt-4">
                是新朋友嗎?{" "}
                <button type="button" className="text-amber-600 font-medium hover:underline" onClick={() => { setFormError(null); setStep(3); }}>
                  建立新帳號
                </button>
              </p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  className="w-full text-center text-sm text-amber-600 hover:underline"
                  onClick={() => { setFormError(null); setStep(1); }}
                >
                  使用其他方式
                </button>
              </div>
            </div>
          </>
        )}

        {/* 圖3：註冊 */}
        {step === 3 && (
          <>
            <div className="px-6 pt-4">
              <ModalHeader title="註冊" />
            </div>
            <div className="px-6 pb-6">
              {formError && (
                <div
                  className={`rounded-lg px-3 py-2 text-sm mb-4 border ${
                    formError.includes("已傳送") || formError.includes("已寄出")
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : "bg-red-50 text-red-700 border-red-100"
                  }`}
                  role="alert"
                >
                  {formError}
                </div>
              )}
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label htmlFor="reg-email" className="block text-sm font-medium text-gray-900 mb-1">帳號</label>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    placeholder="請輸入電子郵件"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label htmlFor="reg-otp" className="block text-sm font-medium text-gray-900 mb-1">認證碼</label>
                  <div className="flex items-stretch gap-2">
                    <input
                      id="reg-otp"
                      name="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="請輸入信箱認證碼"
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSendRegisterOtp()}
                      disabled={registerLoading || registerOtpSending || registerOtpCooldown > 0}
                      className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {registerOtpSending
                        ? "傳送中…"
                        : registerOtpCooldown > 0
                          ? `${registerOtpCooldown} 秒後可重送`
                          : "傳送認證碼"}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-password" className="block text-sm font-medium text-gray-900 mb-1">密碼</label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="請輸入密碼"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-confirm" className="block text-sm font-medium text-gray-900 mb-1">請確認密碼</label>
                  <div className="relative">
                    <input
                      id="reg-confirm"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="請確認密碼"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? "隱藏密碼" : "顯示密碼"}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">密碼強度</span>
                  <div className="flex gap-1">
                    <span className="w-8 h-1.5 rounded bg-gray-200" />
                    <span className="w-8 h-1.5 rounded bg-gray-200" />
                    <span className="w-8 h-1.5 rounded bg-gray-200" />
                  </div>
                  <span className="text-sm text-gray-500">無</span>
                </div>
                <button
                  type="submit"
                  disabled={registerLoading || registerOtpSending}
                  className="w-full py-2.5 rounded-lg font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-60 transition-colors touch-manipulation min-h-[48px]"
                >
                  {registerLoading ? "註冊中…" : "註冊"}
                </button>
              </form>
              <p className="text-center text-sm text-gray-600 mt-4">
                已經是會員嗎?{" "}
                <button type="button" className="text-amber-600 font-medium hover:underline" onClick={() => { setFormError(null); setStep(2); }}>
                  登入
                </button>
              </p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  className="w-full text-center text-sm text-amber-600 hover:underline"
                  onClick={() => { setFormError(null); setStep(1); }}
                >
                  使用其他方式
                </button>
              </div>
            </div>
          </>
        )}

        {/* 圖4：忘記密碼（寄送 Supabase Reset Password 信） */}
        {step === 4 && (
          <>
            <div className="px-6 pt-4">
              <ModalHeader title="忘記密碼" />
            </div>
            <div className="px-6 pb-6">
              {formError && (
                <div
                  className={`rounded-lg px-3 py-2 text-sm mb-4 border ${
                    formError.includes("已寄出")
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : "bg-red-50 text-red-700 border-red-100"
                  }`}
                  role="alert"
                >
                  {formError}
                </div>
              )}
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-900 mb-1">
                    註冊信箱
                  </label>
                  <input
                    id="forgot-email"
                    name="forgotEmail"
                    type="email"
                    placeholder="請輸入註冊時的電子郵件"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full py-2.5 rounded-lg font-medium text-gray-800 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-60 transition-colors touch-manipulation min-h-[48px]"
                >
                  {forgotLoading ? "傳送中…" : "寄送重設密碼連結"}
                </button>
              </form>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  className="w-full text-center text-sm text-amber-600 hover:underline"
                  onClick={() => {
                    setFormError(null);
                    setStep(2);
                  }}
                >
                  返回登入
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {termsModalOpen ? (
        <div className="fixed inset-0 z-[1010] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            onClick={() => setTermsModalOpen(false)}
            aria-label="關閉服務條款"
          />
          <div className="relative z-[1011] w-full max-w-3xl rounded-xl bg-white shadow-2xl">
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
            <div
              className="max-h-[80vh] overflow-y-scroll overscroll-contain px-4 py-4 touch-pan-y"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{termsModalContent}</pre>
            </div>
          </div>
        </div>
      ) : null}
      {privacyModalOpen ? (
        <div className="fixed inset-0 z-[1010] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            onClick={() => setPrivacyModalOpen(false)}
            aria-label="關閉隱私政策"
          />
          <div className="relative z-[1011] w-full max-w-3xl rounded-xl bg-white shadow-2xl">
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
            <div
              className="max-h-[80vh] overflow-y-scroll overscroll-contain px-4 py-4 touch-pan-y"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{privacyModalContent}</pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
