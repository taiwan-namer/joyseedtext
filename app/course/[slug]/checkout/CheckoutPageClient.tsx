"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { useSearchParams } from "next/navigation";
import { CreditCard, Building, Smartphone, Loader2 } from "lucide-react";
import { HeaderMember } from "@/app/components/HeaderMember";
import LoginModal from "@/app/components/LoginModal";
import { createClient } from "@/lib/supabase/client";
import { createBooking } from "@/app/actions/bookingActions";
import type { CourseForPublic } from "@/app/actions/productActions";
import type { CourseDetail } from "../../course-data";

type CourseForDisplay = CourseForPublic | CourseDetail;

/** 與 {@link getPaymentSettings} 回傳一致（供伺服端注入，避免結帳頁進場後再打一次） */
export type InitialPaymentSettings = {
  linePayApi: string | null;
  thirdPartyApi: string | null;
  atmBankName: string | null;
  atmBankCode: string | null;
  atmBankAccount: string | null;
  paymentNewebpayEnabled: boolean;
  paymentEcpayEnabled: boolean;
  paymentLinepayEnabled: boolean;
  paymentAtmEnabled: boolean;
  invoiceProvider: "ecpay" | "ezpay";
};

type PaymentMethod = "card" | "linepay" | "transfer" | "ecpay" | "newebpay";

const CHECKOUT_PENDING_KEY = "checkout_pending";

type PendingCheckoutData = {
  slug: string;
  date: string | null;
  time: string | null;
  total: number;
  addonIndices: number[];
  parentName: string;
  parentPhone: string;
  memberEmail: string;
  childName: string;
  hasAllergyOrGenetic: boolean;
  childAllergyDetail: string;
  childAge: string;
  paymentMethod: PaymentMethod;
};

function pickDefaultPaymentMethod(data: InitialPaymentSettings): PaymentMethod {
  if (data.paymentEcpayEnabled) return "ecpay";
  if (data.paymentNewebpayEnabled) return "newebpay";
  if (data.paymentLinepayEnabled) return "linepay";
  if (data.paymentAtmEnabled) return "transfer";
  return "ecpay";
}

export type CheckoutPageClientProps = {
  slug: string;
  initialCourse: CourseForDisplay;
  initialPaymentSettings: InitialPaymentSettings;
  /** 由 cookie session 解析；與 client getSession 同步後可能更新 */
  initialSessionEmail: string | null;
};

export default function CheckoutPageClient({
  slug,
  initialCourse,
  initialPaymentSettings,
  initialSessionEmail,
}: CheckoutPageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { siteName } = useStoreSettings();
  const [course, setCourse] = useState<CourseForDisplay>(initialCourse);

  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [memberEmail, setMemberEmail] = useState(() => initialSessionEmail ?? "");
  const [childName, setChildName] = useState("");
  const [hasAllergyOrGenetic, setHasAllergyOrGenetic] = useState<boolean>(true);
  const [childAllergyDetail, setChildAllergyDetail] = useState("");
  const [childAge, setChildAge] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() =>
    pickDefaultPaymentMethod(initialPaymentSettings)
  );
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const atmBankName = initialPaymentSettings.atmBankName ?? "";
  const atmBankAccount = initialPaymentSettings.atmBankAccount ?? "";
  const paymentEnabled = useMemo(
    () => ({
      newebpay: initialPaymentSettings.paymentNewebpayEnabled ?? false,
      ecpay: initialPaymentSettings.paymentEcpayEnabled ?? false,
      linepay: initialPaymentSettings.paymentLinepayEnabled ?? false,
      atm: initialPaymentSettings.paymentAtmEnabled ?? false,
    }),
    [initialPaymentSettings]
  );
  const [hasSession, setHasSession] = useState<boolean>(() => initialSessionEmail !== null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [completingPending, setCompletingPending] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);
  const hasHandledPendingRef = useRef(false);

  useEffect(() => {
    setCourse(initialCourse);
  }, [initialCourse]);

  /** 成功建立訂單後常導向此頁，預先載入以縮短等待（含手機） */
  useEffect(() => {
    router.prefetch("/booking/success");
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session?.user);
      if (session?.user?.email) setMemberEmail(session.user.email.trim());
    });
  }, []);

  useEffect(() => {
    const err = searchParams.get("error");
    const msg = searchParams.get("message");
    if (err === "payment_cancelled") {
      setSubmitError("您已取消 LINE Pay 付款，可重新選擇付款方式或稍後再試。");
    } else if (err === "linepay_confirm") {
      if (!msg) {
        setSubmitError("支付失敗，請重新嘗試。");
      } else {
        try {
          setSubmitError(decodeURIComponent(msg));
        } catch {
          setSubmitError(msg);
        }
      }
    }
  }, [searchParams]);

  /** 登入返回後：若有暫存的報名資料且與目前網址一致，自動完成報名（無痛註冊購買） */
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      hasSession !== true ||
      !("id" in course) ||
      !slug ||
      hasHandledPendingRef.current
    ) {
      return;
    }
    try {
      const raw = sessionStorage.getItem(CHECKOUT_PENDING_KEY);
      if (!raw) return;
      const pending: PendingCheckoutData = JSON.parse(raw);
      const currentDate = searchParams.get("date") ?? null;
      const currentTime = searchParams.get("time") ?? null;
      if (
        pending.slug !== slug ||
        pending.date !== currentDate ||
        pending.time !== currentTime
      ) {
        return;
      }
      hasHandledPendingRef.current = true;
      sessionStorage.removeItem(CHECKOUT_PENDING_KEY);
      setCompletingPending(true);
      (async () => {
        try {
          const allergyNote = pending.hasAllergyOrGenetic
            ? (pending.childAllergyDetail.trim() || "有（未填寫說明）")
            : "無";
          /** 信箱以伺服端 session 為準（見 createBooking 內 getCurrentMemberEmail）；此處傳表單值供訪客 */
          const bookRes = await createBooking(
            course.id,
            pending.memberEmail.trim(),
            pending.parentName.trim(),
            pending.parentPhone.trim(),
            pending.date,
            pending.time,
            allergyNote,
            pending.childName.trim() || null,
            pending.childAge.trim() || null,
            Array.isArray(pending.addonIndices) && pending.addonIndices.length > 0 ? pending.addonIndices : undefined,
            pending.paymentMethod,
            pending.total,
            course.title ?? null,
            slug ?? null
          );
          if (!bookRes.success) {
            setSubmitError(bookRes.error);
            setCompletingPending(false);
            return;
          }
          if (bookRes.paymentUrl) {
            console.log("跳轉至 LINE Pay:", bookRes.paymentUrl);
            window.location.href = bookRes.paymentUrl;
            return;
          }
          setSuccessBookingId(bookRes.bookingId);
          setIsSuccessModalOpen(true);
          setCompletingPending(false);
        } catch (e) {
          setSubmitError(e instanceof Error ? e.message : "完成報名時發生錯誤");
          setCompletingPending(false);
        }
      })();
    } catch {
      sessionStorage.removeItem(CHECKOUT_PENDING_KEY);
    }
  }, [hasSession, course, slug, searchParams, router]);

  const dateTimeFromUrl = useMemo(() => {
    const date = searchParams.get("date");
    const time = searchParams.get("time");
    if (date && time) return `${date} ${time}`;
    return "";
  }, [searchParams]);

  /** 所選場次是否在課程的開課清單內（防呆：網址被改或場次已異動） */
  const slotInvalid = useMemo(() => {
    const date = searchParams.get("date");
    const time = searchParams.get("time");
    if (!date || !time || !("scheduledSlots" in course) || !course.scheduledSlots?.length) return false;
    const dateStr = date.replace(/T.*$/, "").slice(0, 10);
    const timeStr = decodeURIComponent(time).replace(/.*(\d{2}:\d{2}).*/, "$1").slice(0, 5);
    const allowed = course.scheduledSlots.some(
      (s) => String(s.date).slice(0, 10) === dateStr && String(s.time).slice(0, 5) === timeStr
    );
    return !allowed;
  }, [searchParams, course]);

  const totalFromUrl = useMemo(() => {
    const t = searchParams.get("total");
    if (t != null && t !== "") {
      const n = Number(t);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
    const base =
      "price" in course
        ? (course.salePrice != null && course.price != null && course.salePrice < course.price
            ? course.salePrice
            : course.price ?? 0)
        : 0;
    return base;
  }, [searchParams, course]);

  /** URL 加購參數 addon=0,1 → [0, 1]，結帳與下單時傳給後端 */
  const addonIndicesFromUrl = useMemo(() => {
    const addonParam = searchParams.get("addon");
    if (addonParam == null || addonParam === "") return [];
    return addonParam
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n >= 0);
  }, [searchParams]);

  const orderSummary = {
    courseName: course.title ?? "—",
    dateTime: dateTimeFromUrl,
    totalAmount: totalFromUrl,
  };

  const loginNext = `/course/${slug}/checkout?${searchParams.toString()}`;

  if (completingPending) {
    return (
      <div className="min-h-screen bg-page flex flex-col">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" prefetch className="text-xl font-bold text-brand touch-manipulation">
              {siteName}
            </Link>
            <HeaderMember />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500 shrink-0" />
          <span className="text-gray-600">正在完成報名…</span>
        </div>
      </div>
    );
  }

  /** 僅寫入暫存，不導向（給 LoginModal 內 Google 登入前呼叫） */
  const savePendingOnly = () => {
    const pending: PendingCheckoutData = {
      slug: slug ?? "",
      date: searchParams.get("date") ?? null,
      time: searchParams.get("time") ?? null,
      total: totalFromUrl,
      addonIndices: addonIndicesFromUrl,
      parentName: parentName.trim(),
      parentPhone: parentPhone.trim(),
      memberEmail: memberEmail.trim(),
      childName: childName.trim(),
      hasAllergyOrGenetic: hasAllergyOrGenetic,
      childAllergyDetail: childAllergyDetail.trim(),
      childAge: childAge.trim(),
      paymentMethod,
    };
    sessionStorage.setItem(CHECKOUT_PENDING_KEY, JSON.stringify(pending));
  };

  const hasPaymentOption = paymentEnabled.ecpay || paymentEnabled.newebpay || paymentEnabled.linepay || paymentEnabled.atm;
  const buttonText =
    paymentMethod === "ecpay"
      ? "前往付款"
      : paymentMethod === "linepay"
        ? "使用 Line Pay 付款"
        : paymentMethod === "newebpay"
          ? "前往 ATM 付款"
          : paymentMethod === "transfer"
            ? "確認預約並取得帳號"
            : "前往付款";

  const handleSubmit = async (opts?: { sessionEmail?: string }) => {
    setSubmitError(null);
    const emailResolved = (opts?.sessionEmail ?? memberEmail).trim();
    if (hasSession !== true && !emailResolved) {
      setSubmitError("請填寫報名信箱");
      return;
    }
    if (!parentName.trim()) {
      setSubmitError("請填寫家長姓名");
      return;
    }
    if (!parentPhone.trim()) {
      setSubmitError("請填寫家長手機");
      return;
    }
    if (!childName.trim()) {
      setSubmitError("請填寫小孩暱稱");
      return;
    }
    if (hasAllergyOrGenetic && !childAllergyDetail.trim()) {
      setSubmitError("請填寫過敏或遺傳疾病說明");
      return;
    }
    if (!childAge.trim()) {
      setSubmitError("請填寫小孩年齡");
      return;
    }
    if (!course || !("id" in course) || !course.id) {
      setSubmitError("課程資料不完整，請重新選擇");
      return;
    }
    if (slotInvalid) {
      setSubmitError("所選日期或時段不在本課程的開課場次中，請回到課程頁重新選擇場次。");
      return;
    }
    if (hasSession === false && !opts?.sessionEmail) {
      setShowLoginPrompt(true);
      return;
    }
    if (!paymentEnabled.ecpay && !paymentEnabled.newebpay && !paymentEnabled.linepay && !paymentEnabled.atm) {
      setSubmitError("目前沒有可用的付款方式，請聯絡店家。");
      return;
    }
    setSubmitLoading(true);
    try {
      const slotDate = searchParams.get("date") ?? undefined;
      const slotTime = searchParams.get("time") ?? undefined;
      const allergyNote = hasAllergyOrGenetic
        ? (childAllergyDetail.trim() || "有（未填寫說明）")
        : "無";
      const bookRes = await createBooking(
        course.id,
        emailResolved,
        parentName.trim(),
        parentPhone.trim(),
        slotDate || null,
        slotTime || null,
        allergyNote || null,
        childName.trim() || null,
        childAge.trim() || null,
        addonIndicesFromUrl.length > 0 ? addonIndicesFromUrl : undefined,
        paymentMethod,
        totalFromUrl,
        course.title ?? null,
        slug ?? null
      );
      if (!bookRes.success) {
        setSubmitError(bookRes.error);
        setSubmitLoading(false);
        return;
      }
      if (bookRes.paymentUrl) {
        window.location.href = bookRes.paymentUrl;
        return;
      }
      setSuccessBookingId(bookRes.bookingId);
      setIsSuccessModalOpen(true);
      setSubmitLoading(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "送出失敗，請稍後再試");
      setSubmitLoading(false);
    }
  };

  const handleSetHasAllergy = (value: boolean) => {
    setHasAllergyOrGenetic(value);
    if (!value) setChildAllergyDetail("");
  };

  const inputBase =
    "w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors";

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" prefetch className="text-xl font-bold text-brand touch-manipulation">
              {siteName}
            </Link>
            <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">填寫報名資料</span>
            <HeaderMember />
          </div>
        </div>
      </header>

      {/* 填完報名資料後送出時未登入：使用與首頁相同的登入／註冊彈窗，完成後自動送出報名 */}
      <LoginModal
        isOpen={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        returnTo={loginNext}
        onBeforeGoogleRedirect={savePendingOnly}
        onSuccess={(session) => {
          setShowLoginPrompt(false);
          const em = session?.user?.email?.trim() ?? "";
          if (em) setMemberEmail(em);
          setHasSession(true);
          void handleSubmit({ sessionEmail: em });
        }}
      />

      {/* 預約已送出彈窗：僅在無支付網址（ATM／現場等）時顯示，有 paymentUrl 時直接跳轉 LINE Pay 不顯示 */}
      {isSuccessModalOpen && successBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="success-modal-title">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <h2 id="success-modal-title" className="text-lg font-bold text-gray-900 mb-2">預約已送出</h2>
            <p className="text-gray-600 text-sm mb-6">請依所選付款方式完成付款，或至會員中心查看訂單。</p>
            <button
              type="button"
              onClick={() => {
                setIsSuccessModalOpen(false);
                setSuccessBookingId(null);
                router.push(`/booking/success?bookingId=${encodeURIComponent(successBookingId)}`);
              }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 rounded-lg transition-colors"
            >
              查看訂單
            </button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {slotInvalid && (
          <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm" role="alert">
            所選日期或時段不在本課程的開課場次中，請回到課程頁重新選擇場次再結帳。
          </div>
        )}
        {submitError && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm" role="alert">
            {submitError}
          </div>
        )}
        {/* 手機版：訂單明細在上 */}
        <div className="lg:hidden mb-8">
          <OrderSummaryCard
            orderSummary={orderSummary}
            paymentMethod={paymentMethod}
            buttonText={buttonText}
            onSubmit={handleSubmit}
            loading={submitLoading}
            atmBankName={atmBankName}
            atmBankAccount={atmBankAccount}
            submitDisabled={!hasPaymentOption}
          />
        </div>

        <div className="lg:grid lg:grid-cols-[1fr_1fr] lg:gap-10 lg:grid-cols-5">
          {/* 左側 60%：表單 + 付款方式 */}
          <div className="lg:col-span-3 space-y-6">
            {/* 1. 填寫報名資料 */}
            <section className="bg-white p-6 rounded-xl shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                填寫報名資料
              </h2>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="parentName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    家長姓名 <span className="text-amber-600">（必填）</span>
                  </label>
                  <input
                    id="parentName"
                    type="text"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder="請輸入家長姓名"
                    className={inputBase}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="parentPhone"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    家長手機 <span className="text-amber-600">（必填）</span>
                  </label>
                  <input
                    id="parentPhone"
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="請輸入手機號碼"
                    className={inputBase}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="memberEmail"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    報名信箱 <span className="text-amber-600">（必填）</span>
                  </label>
                  <input
                    id="memberEmail"
                    type="email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    placeholder="請輸入常用 E-mail"
                    className={inputBase}
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="childName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    小孩暱稱 <span className="text-amber-600">（必填）</span>
                  </label>
                  <input
                    id="childName"
                    type="text"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="請輸入小孩暱稱（例：小米）"
                    className={inputBase}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    小孩有無過敏或其他遺傳疾病 <span className="text-amber-600">（必填）</span>
                  </label>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasAllergy"
                        checked={hasAllergyOrGenetic === true}
                        onChange={() => handleSetHasAllergy(true)}
                        className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-500"
                      />
                      <span className="text-gray-700">有</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasAllergy"
                        checked={hasAllergyOrGenetic === false}
                        onChange={() => handleSetHasAllergy(false)}
                        className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-500"
                      />
                      <span className="text-gray-700">無</span>
                    </label>
                  </div>
                  {hasAllergyOrGenetic && (
                    <input
                      type="text"
                      value={childAllergyDetail}
                      onChange={(e) => setChildAllergyDetail(e.target.value)}
                      placeholder="例：蠶豆症（必填）"
                      className={inputBase}
                      aria-label="過敏或遺傳疾病說明"
                      required
                    />
                  )}
                </div>
                <div>
                  <label
                    htmlFor="childAge"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    小孩年齡 <span className="text-amber-600">（必填）</span>
                  </label>
                  <input
                    id="childAge"
                    type="text"
                    value={childAge}
                    onChange={(e) => setChildAge(e.target.value)}
                    placeholder="請填寫小孩年齡，例：5 歲"
                    className={inputBase}
                    required
                  />
                </div>
              </div>
            </section>

            {/* 2. 選擇付款方式（僅顯示後台已開啟的選項） */}
            <section className="bg-white p-6 rounded-xl shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-6">
                選擇付款方式
              </h2>
              {!paymentEnabled.ecpay && !paymentEnabled.newebpay && !paymentEnabled.linepay && !paymentEnabled.atm ? (
                <p className="text-gray-500 text-sm">目前沒有可用的付款方式，請稍後再試或聯絡店家。</p>
              ) : (
                <div className="space-y-3">
                  {paymentEnabled.ecpay && (
                    <label
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                        paymentMethod === "ecpay"
                          ? "border-orange-500 bg-orange-50/50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value="ecpay"
                        checked={paymentMethod === "ecpay"}
                        onChange={() => setPaymentMethod("ecpay")}
                        className="sr-only"
                      />
                      <CreditCard className={`w-6 h-6 shrink-0 ${paymentMethod === "ecpay" ? "text-orange-500" : "text-gray-400"}`} />
                      <span className="font-medium text-gray-900">信用卡 (綠界)</span>
                    </label>
                  )}
                  {paymentEnabled.newebpay && (
                    <label
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                        paymentMethod === "newebpay"
                          ? "border-orange-500 bg-orange-50/50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value="newebpay"
                        checked={paymentMethod === "newebpay"}
                        onChange={() => setPaymentMethod("newebpay")}
                        className="sr-only"
                      />
                      <Building className={`w-6 h-6 shrink-0 ${paymentMethod === "newebpay" ? "text-orange-500" : "text-gray-400"}`} />
                      <span className="font-medium text-gray-900">ATM (藍新)</span>
                    </label>
                  )}
                  {paymentEnabled.linepay && (
                    <label
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                        paymentMethod === "linepay"
                          ? "border-orange-500 bg-orange-50/50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value="linepay"
                        checked={paymentMethod === "linepay"}
                        onChange={() => setPaymentMethod("linepay")}
                        className="sr-only"
                      />
                      <Smartphone className={`w-6 h-6 shrink-0 ${paymentMethod === "linepay" ? "text-orange-500" : "text-gray-400"}`} />
                      <span className="font-medium text-gray-900">Line Pay</span>
                    </label>
                  )}
                  {paymentEnabled.atm && (
                    <label
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                        paymentMethod === "transfer"
                          ? "border-orange-500 bg-orange-50/50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value="transfer"
                        checked={paymentMethod === "transfer"}
                        onChange={() => setPaymentMethod("transfer")}
                        className="sr-only"
                      />
                      <Building className={`w-6 h-6 shrink-0 ${paymentMethod === "transfer" ? "text-orange-500" : "text-gray-400"}`} />
                      <span className="font-medium text-gray-900">ATM 銀行轉帳</span>
                    </label>
                  )}
                </div>
              )}
              {/* ATM 轉帳資訊：選 ATM 時顯示 */}
              {paymentMethod === "transfer" && (atmBankName || atmBankAccount) && (
                <div className="mt-4 p-5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-sm font-medium text-slate-700 mb-4">請依以下資訊完成 ATM 轉帳</p>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-slate-500">銀行單位</dt>
                      <dd className="font-medium text-gray-900 mt-0.5">{atmBankName || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">銀行帳號</dt>
                      <dd className="font-mono font-medium text-gray-900 mt-0.5">{atmBankAccount || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">訂單金額</dt>
                      <dd className="font-bold text-lg text-gray-900 mt-0.5">NT$ {totalFromUrl.toLocaleString()}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </section>
          </div>

          {/* 右側 40%：訂單明細（桌面版 sticky，手機版已在上方顯示） */}
          <div className="hidden lg:block lg:col-span-2">
            <div className="sticky top-24">
              <OrderSummaryCard
                orderSummary={orderSummary}
                paymentMethod={paymentMethod}
                buttonText={buttonText}
                onSubmit={handleSubmit}
                loading={submitLoading}
                atmBankName={atmBankName}
                atmBankAccount={atmBankAccount}
                submitDisabled={!hasPaymentOption}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderSummaryCard({
  orderSummary,
  paymentMethod,
  buttonText,
  onSubmit,
  loading = false,
  atmBankName = "",
  atmBankAccount = "",
  submitDisabled = false,
}: {
  orderSummary: { courseName: string; dateTime: string; totalAmount: number };
  paymentMethod: PaymentMethod;
  buttonText: string;
  onSubmit: () => void;
  loading?: boolean;
  atmBankName?: string;
  atmBankAccount?: string;
  submitDisabled?: boolean;
}) {
  const showAtmBlock = paymentMethod === "transfer" && (atmBankName || atmBankAccount);
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-4">訂單明細</h2>
      <dl className="space-y-3 text-sm mb-6">
        <div>
          <dt className="text-gray-500">課程名稱</dt>
          <dd className="font-medium text-gray-900 mt-0.5">
            {orderSummary.courseName}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">時間</dt>
          <dd className="font-medium text-gray-900 mt-0.5">
            {orderSummary.dateTime}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">總金額</dt>
          <dd className="font-bold text-lg text-gray-900 mt-0.5">
            NT$ {orderSummary.totalAmount.toLocaleString()}
          </dd>
        </div>
      </dl>
      {showAtmBlock && (
        <div className="mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-xs font-medium text-slate-600 mb-3">ATM 轉帳資訊</p>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">銀行單位</dt>
              <dd className="font-medium text-gray-900">{atmBankName || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">銀行帳號</dt>
              <dd className="font-mono font-medium text-gray-900">{atmBankAccount || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">訂單金額</dt>
              <dd className="font-bold text-gray-900">NT$ {orderSummary.totalAmount.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          void onSubmit();
        }}
        disabled={loading || submitDisabled}
        className="w-full touch-manipulation select-none bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-70 disabled:cursor-not-allowed text-white py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center gap-2 min-h-[48px]"
      >
        {loading && <Loader2 className="w-5 h-5 animate-spin shrink-0" />}
        {buttonText}
      </button>
    </div>
  );
}
