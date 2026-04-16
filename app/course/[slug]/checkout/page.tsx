import { notFound } from "next/navigation";
import { getCourseById } from "@/app/actions/productActions";
import { getPaymentSettings } from "@/app/actions/frontendSettingsActions";
import { getCurrentMemberEmail } from "@/app/actions/bookingActions";
import { getCourseBySlug } from "../../course-data";
import CheckoutPageClient from "./CheckoutPageClient";
import type { CourseDetail } from "../../course-data";
import type { CourseForPublic } from "@/app/actions/productActions";

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * 結帳頁：伺服端並行載入課程、付款設定與登入信箱，首屏即可填寫（避免進頁後多段 client fetch）。
 */
export default async function CheckoutPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = decodeSlug(params.slug);

  const [courseFromDb, paymentSettings, sessionEmail] = await Promise.all([
    getCourseById(slug),
    getPaymentSettings(),
    getCurrentMemberEmail(),
  ]);

  let course: CourseForPublic | CourseDetail | null = courseFromDb;
  if (!course) {
    course = getCourseBySlug(slug) ?? null;
  }
  if (!course) notFound();

  return (
    <CheckoutPageClient
      slug={slug}
      initialCourse={course}
      initialPaymentSettings={paymentSettings}
      initialSessionEmail={sessionEmail}
    />
  );
}
