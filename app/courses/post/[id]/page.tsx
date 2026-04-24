"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { HeaderMember } from "@/app/components/HeaderMember";
import { getCourseIntroPostById, type CourseIntroPost } from "@/app/actions/courseIntroActions";
import { useParams } from "next/navigation";
import PortraitAwareHtml from "@/app/components/PortraitAwareHtml";
import { stripGoogleFontsFromHtml } from "@/lib/stripGoogleFontsFromHtml";
import { COURSE_PROSE_PORTRAIT_AWARE_IMAGE_CLASS, COURSE_PROSE_POST_BODY_IMG_OVERRIDES } from "@/lib/courseImageSlots";

/** 手動新增的課程介紹文章詳情（無對應課程時點 READ MORE 進入此頁） */
export default function CourseIntroPostPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const { siteName } = useStoreSettings();
  /** undefined＝尚未載入；null＝查無文章（勿在 client 呼叫 notFound，會觸發 Application error） */
  const [post, setPost] = useState<CourseIntroPost | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getCourseIntroPostById(id).then((data) => {
      if (!cancelled) setPost(data);
    });
    return () => { cancelled = true; };
  }, [id]);

  if (!id) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-700">找不到文章。</p>
        <Link href="/courses/intro" className="text-amber-600 font-medium hover:underline">
          回課程介紹
        </Link>
      </div>
    );
  }
  if (post === undefined) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">載入中…</p>
      </div>
    );
  }
  if (post === null) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-700">找不到此文章或連結已失效。</p>
        <Link href="/courses/intro" className="text-amber-600 font-medium hover:underline">
          回課程介紹
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <Link href="/" prefetch className="text-xl font-bold text-brand touch-manipulation">
            {siteName}
          </Link>
          <HeaderMember />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <nav className="mb-6 text-sm text-gray-500" aria-label="麵包屑">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/" prefetch className="hover:text-brand transition-colors touch-manipulation">首頁</Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 shrink-0" />
              <Link href="/courses/intro" className="hover:text-brand transition-colors">課程介紹文章</Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 shrink-0" />
              <span className="text-gray-700">{post.title}</span>
            </li>
          </ol>
        </nav>

        <article>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{post.title}</h1>
          {post.image_url && (
            <div className="aspect-video rounded-xl overflow-hidden bg-gray-200 mb-6">
              <img src={post.image_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {post.intro_text && (
            <div className="text-gray-700 leading-relaxed whitespace-pre-line mb-6">
              {post.intro_text}
            </div>
          )}
          {post.post_content && (
            <PortraitAwareHtml
              className={`prose prose-gray max-w-none text-gray-700 ${COURSE_PROSE_POST_BODY_IMG_OVERRIDES} ${COURSE_PROSE_PORTRAIT_AWARE_IMAGE_CLASS}`}
              html={stripGoogleFontsFromHtml(post.post_content)}
            />
          )}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <Link
              href="/courses/intro"
              className="inline-block py-3 px-6 rounded-full bg-brand hover:bg-brand-hover text-white font-medium transition-colors"
            >
              回課程介紹
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
