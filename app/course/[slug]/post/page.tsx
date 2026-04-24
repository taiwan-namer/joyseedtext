"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCourseBySlug } from "../../course-data";
import { getCourseById } from "@/app/actions/productActions";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { HeaderMember } from "@/app/components/HeaderMember";
import CoursePostBookingPanel from "@/app/components/course/CoursePostBookingPanel";
import type { CourseForPublic } from "@/app/actions/productActions";
import type { CourseDetail } from "../../course-data";
import { useCourseSlugParam } from "../../useCourseSlugParam";
import { withCourseFetchTimeout } from "@/lib/courseClientFetch";
import { COURSE_FORM_GALLERY_SLOT_COUNT, COURSE_FORM_IMAGE_SLOT_COUNT } from "@/lib/constants";

type CourseForDisplay = CourseForPublic | CourseDetail;

/** 後台測試時可能誤留的亂字，內文頁不顯示 */
const TEST_GIBBERISH = "hghghhjghghghhghg";

function stripTestGibberish(text: string): string {
  if (!text) return text;
  return text.split(TEST_GIBBERISH).join("").replace(/\n{3,}/g, "\n\n").trim();
}

function isCourseDetail(c: CourseForDisplay): c is CourseDetail {
  return "articleParagraphs" in c && Array.isArray((c as CourseDetail).articleParagraphs);
}

function formatNoticeValue(v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => String(x ?? "")).filter(Boolean).join("、");
  return String(v ?? "");
}

function CustomerNoticePanel({ notice }: { notice: CourseForPublic["customerNotice"] }) {
  if (!notice) return null;
  return (
    <section className="rounded-xl border border-gray-100 bg-gray-50/80 p-5 shadow-sm">
      <h2 className="mb-3 text-base font-bold text-gray-900">客戶須知</h2>
      <dl className="space-y-3 text-sm leading-relaxed">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3">
          <dt className="text-gray-500">活動場域</dt>
          <dd className="min-w-0 text-gray-800">{formatNoticeValue(notice.活動場域類型)}</dd>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3">
          <dt className="text-gray-500">課程時段</dt>
          <dd className="min-w-0 text-gray-800">{formatNoticeValue(notice.課程時段長度)}</dd>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3">
          <dt className="text-gray-500">教學語言</dt>
          <dd className="min-w-0 text-gray-800">{formatNoticeValue(notice.教學語言)}</dd>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3">
          <dt className="text-gray-500">家長陪同</dt>
          <dd className="min-w-0 text-gray-800">{formatNoticeValue(notice.家長陪同規則)}</dd>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3">
          <dt className="text-gray-500">注意事項</dt>
          <dd className="min-w-0 whitespace-pre-line text-gray-800">{formatNoticeValue(notice.注意事項)}</dd>
        </div>
      </dl>
    </section>
  );
}

/** 將內文中的 [圖片1]～[圖片15] 替換為實際圖片：圖片1=主圖，圖片2 起對應圖庫圖1～圖14 */
function replaceImagePlaceholders(
  html: string,
  mainImageUrl: string | null | undefined,
  galleryUrls: string[] | null | undefined
): string {
  const gallery = (galleryUrls ?? []).slice(0, COURSE_FORM_GALLERY_SLOT_COUNT);
  const urls = [mainImageUrl ?? "", ...gallery];
  let out = html;
  for (let i = 1; i <= COURSE_FORM_IMAGE_SLOT_COUNT; i++) {
    const placeholder = `[圖片${i}]`;
    const url = urls[i - 1] ?? "";
    const imgTag = url
      ? `<img src="${url.replace(/"/g, "&quot;")}" alt="圖${i}" class="my-4 rounded-xl w-full max-w-2xl mx-auto object-cover" loading="lazy" />`
      : `<span class="inline-block py-2 px-3 rounded bg-gray-100 text-gray-500 text-sm">[圖${i}]</span>`;
    out = out.split(placeholder).join(imgTag);
  }
  return out;
}

// 課程內文頁：主欄從課程內文起；不顯示主圖／課程簡介；內文僅用 post_content（靜態則用段落）
export default function CoursePostPage() {
  const slug = useCourseSlugParam();
  const { siteName } = useStoreSettings();
  const [course, setCourse] = useState<CourseForDisplay | null>(null);
  const [courseMissing, setCourseMissing] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setCourse(null);
    setCourseMissing(false);
    (async () => {
      try {
        const fromDb = await withCourseFetchTimeout(getCourseById(slug));
        if (cancelled) return;
        if (fromDb) {
          setCourse(fromDb);
          return;
        }
      } catch {
        if (cancelled) return;
      }
      if (cancelled) return;
      const fromStatic = getCourseBySlug(slug);
      if (fromStatic) {
        setCourse(fromStatic);
        return;
      }
      setCourseMissing(true);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (!course) {
    if (courseMissing) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-gray-700 text-center">找不到此課程或連結已失效。</p>
          <Link href="/" prefetch className="text-amber-600 font-medium hover:underline touch-manipulation">
            回首頁
          </Link>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">載入中…</p>
      </div>
    );
  }

  const rawAgeTags = course.sidebarOptionLabels ?? (course as CourseDetail).ageTags ?? [];
  const ageTags = Array.isArray(rawAgeTags) ? rawAgeTags : [];
  const ageRange = "ageRange" in course ? (course as CourseDetail).ageRange : "";
  const customerNotice = "customerNotice" in course ? course.customerNotice : undefined;
  const coursePublicSlug = ("slug" in course && course.slug ? course.slug : slug) ?? "";

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link href="/" prefetch className="text-xl font-bold text-brand touch-manipulation">
            {siteName}
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/courses/intro"
              prefetch
              className="text-sm text-gray-500 hover:text-brand transition-colors"
            >
              課程介紹
            </Link>
            <HeaderMember />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12 lg:items-start">
          <article className="min-w-0 w-full lg:col-span-7 lg:justify-self-start">
            {/* 內文頁不顯示主圖、課程簡介與「課程內文」標題；左欄直接顯示內容本體 */}
            <section className="border-t border-gray-100 pt-8 lg:border-t-0 lg:pt-0">
              {isCourseDetail(course) ? (
                (() => {
                  const parts = course.articleParagraphs
                    .map((p) => stripTestGibberish(String(p ?? "")))
                    .filter(Boolean);
                  if (parts.length === 0) {
                    return <p className="text-gray-500">尚無內文。</p>;
                  }
                  return (
                    <div className="space-y-8 text-base leading-relaxed text-gray-700">
                      {parts.map((cleaned, i) => (
                        <p key={i} className={i === 0 ? "first:indent-8" : ""}>
                          {cleaned}
                        </p>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div
                  className="prose prose-gray max-w-[78ch] text-base leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: replaceImagePlaceholders(
                      (() => {
                        const raw =
                          "postContent" in course &&
                          course.postContent != null &&
                          String(course.postContent).trim() !== ""
                            ? String(course.postContent)
                            : "";
                        const cleaned = stripTestGibberish(raw);
                        return cleaned || "<p>尚無內文。</p>";
                      })(),
                      "imageUrl" in course ? course.imageUrl : undefined,
                      "galleryUrls" in course ? course.galleryUrls : undefined,
                    ),
                  }}
                />
              )}
            </section>
          </article>

          <aside className="lg:col-span-5 lg:-translate-x-[60px]">
            <div className="lg:sticky lg:top-24 space-y-6">
              <CoursePostBookingPanel
                course={course}
                classId={"id" in course && typeof course.id === "string" ? course.id : null}
                routeSlug={coursePublicSlug}
                ageTags={ageTags}
                ageRange={ageRange}
              />
              {customerNotice ? <CustomerNoticePanel notice={customerNotice} /> : null}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
