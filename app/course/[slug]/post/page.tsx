"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCourseBySlug } from "../../course-data";
import { getCourseById } from "@/app/actions/productActions";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { HeaderMember } from "@/app/components/HeaderMember";
import type { CourseForPublic } from "@/app/actions/productActions";
import type { CourseDetail } from "../../course-data";
import { useCourseSlugParam } from "../../useCourseSlugParam";
import { withCourseFetchTimeout } from "@/lib/courseClientFetch";

type CourseForDisplay = CourseForPublic | CourseDetail;

function isCourseDetail(c: CourseForDisplay): c is CourseDetail {
  return "articleParagraphs" in c && Array.isArray((c as CourseDetail).articleParagraphs);
}

/** 將內文中的 [圖片1]～[圖片5] 替換為實際圖片：圖片1=主圖，圖片2～5=圖1～圖4 */
function replaceImagePlaceholders(
  html: string,
  mainImageUrl: string | null | undefined,
  galleryUrls: string[] | null | undefined
): string {
  const urls = [
    mainImageUrl ?? "",
    galleryUrls?.[0] ?? "",
    galleryUrls?.[1] ?? "",
    galleryUrls?.[2] ?? "",
    galleryUrls?.[3] ?? "",
  ];
  let out = html;
  for (let i = 1; i <= 5; i++) {
    const placeholder = `[圖片${i}]`;
    const url = urls[i - 1];
    const imgTag = url
      ? `<img src="${url.replace(/"/g, "&quot;")}" alt="圖${i}" class="my-4 rounded-xl w-full max-w-2xl mx-auto object-cover" loading="lazy" />`
      : `<span class="inline-block py-2 px-3 rounded bg-gray-100 text-gray-500 text-sm">[圖${i}]</span>`;
    out = out.split(placeholder).join(imgTag);
  }
  return out;
}

// 部落格全文頁：主圖 + 內文段落（靜態）或 post_content HTML（DB），參考 Rose's Blog 文章版型
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

  const category = "category" in course ? (course as CourseDetail).category : "課程";
  const rawAgeTags = course.sidebarOptionLabels ?? (course as CourseDetail).ageTags ?? [];
  const ageTags = Array.isArray(rawAgeTags) ? rawAgeTags : [];
  const ageRange = "ageRange" in course ? (course as CourseDetail).ageRange : "";

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between">
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

      <article className="mx-auto max-w-3xl px-4 pt-6 pb-16">
        <nav className="mb-6 text-sm text-gray-400" aria-label="麵包屑">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/" prefetch className="hover:text-amber-600 transition-colors touch-manipulation">
                首頁
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 shrink-0" />
              <Link href="/courses/intro" prefetch className="hover:text-amber-600 transition-colors">
                課程介紹
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 shrink-0" />
              <span className="text-gray-600">{course.title}</span>
            </li>
          </ol>
        </nav>

        <div className="mb-3">
          <span className="inline-block px-3 py-1 text-xs font-medium text-amber-600 bg-amber-50 rounded-full">
            {category}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 tracking-tight">
          {course.title}
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          {ageRange}{ageRange && " · "}{ageTags.join("、")}
        </p>

        {/* 主圖（DB 有 imageUrl 則顯示） */}
        <div className="aspect-video rounded-2xl bg-gray-200 mb-6 flex items-center justify-center overflow-hidden">
          {"imageUrl" in course && course.imageUrl ? (
            <img src={course.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-gray-400 text-sm">課程主圖（部落格首圖）</span>
          )}
        </div>

        {/* 課程簡介：主圖下方，與課程詳情頁一致 */}
        {course.courseIntro && (
          <section className="mb-10">
            <h2 className="text-sm font-semibold text-gray-500 mb-2">課程簡介</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{course.courseIntro}</p>
          </section>
        )}

        {/* 全文：DB 為 HTML（post_content），靜態為段落 */}
        {isCourseDetail(course) ? (
          <div className="space-y-8 text-gray-700 text-base leading-relaxed">
            {course.articleParagraphs.map((paragraph, i) => (
              <div key={i}>
                <p className={i === 0 ? "first:indent-8" : ""}>{paragraph}</p>
                {i === 1 && (
                  <div className="my-8 rounded-xl overflow-hidden bg-gray-100 aspect-[16/10] flex items-center justify-center">
                    <span className="text-gray-400 text-sm">文中插圖</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="prose prose-gray max-w-none text-base leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: replaceImagePlaceholders(
                (course.postContent ?? course.courseIntro ?? "") || "<p>尚無內文。</p>",
                "imageUrl" in course ? course.imageUrl : undefined,
                "galleryUrls" in course ? course.galleryUrls : undefined,
              ),
            }}
          />
        )}

        {/* 文末預設圖（僅靜態課程顯示） */}
        {isCourseDetail(course) && (
          <div className="mt-10 rounded-xl overflow-hidden bg-gray-100 aspect-[16/9] flex items-center justify-center">
            <span className="text-gray-400 text-sm">課程情境圖</span>
          </div>
        )}

        {/* 文末 CTA */}
        <section className="mt-12 pt-8 border-t border-gray-100 flex flex-wrap gap-4">
          <Link
            href={`/course/${course.slug}`}
            className="inline-block py-3 px-6 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
          >
            查看課程時段 · 立即預約
          </Link>
          <Link
            href="/courses/intro"
            className="inline-block py-3 px-6 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium transition-colors"
          >
            回課程介紹
          </Link>
        </section>
      </article>
    </div>
  );
}
