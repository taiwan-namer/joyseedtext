import { notFound } from "next/navigation";
import { getCourseById } from "@/app/actions/productActions";
import { getCourseBySlug } from "../course-data";
import CourseDetailPageClient from "./CourseDetailPageClient";
import type { CourseDetail } from "../course-data";
import type { CourseForPublic } from "@/app/actions/productActions";

function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * 課程詳情：伺服端載入 DB 或靜態課程，首屏即顯示（避免進頁後 client 再 fetch）。
 */
export default async function CourseDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = decodeSlug(params.slug);
  let course: CourseForPublic | CourseDetail | null = await getCourseById(slug);
  if (!course) {
    course = getCourseBySlug(slug) ?? null;
  }
  if (!course) notFound();
  return <CourseDetailPageClient initialCourse={course} slug={slug} />;
}
