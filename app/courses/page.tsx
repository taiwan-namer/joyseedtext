"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { HeaderMember } from "@/app/components/HeaderMember";
import { getCourseIntroPostsForPublic } from "@/app/actions/courseIntroActions";
import type { CourseIntroPost } from "@/app/actions/courseIntroActions";

/** 課程介紹頁：僅顯示課程介紹文章（備份 + 手動），部落格模式（圖 + 文字） */
export default function CourseIntroPage() {
  const [posts, setPosts] = useState<CourseIntroPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { siteName } = useStoreSettings();

  useEffect(() => {
    getCourseIntroPostsForPublic().then((list) => {
      setPosts(list);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-brand">
            {siteName}
          </Link>
          <HeaderMember />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <nav className="mb-6 text-sm text-gray-500" aria-label="麵包屑">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/" className="hover:text-brand transition-colors">
                首頁
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 shrink-0" />
              <span className="text-gray-700">課程介紹</span>
            </li>
          </ol>
        </nav>

        <h1 className="text-xl font-bold text-gray-900 mb-8">課程介紹</h1>

        <div className="md:grid md:grid-cols-12 md:gap-8 lg:gap-10">
          <div className="md:col-span-7 lg:col-span-8">
            {loading ? (
              <p className="text-gray-500 py-8">載入中…</p>
            ) : posts.length === 0 ? (
              <p className="text-gray-500 py-8">尚無課程介紹文章。</p>
            ) : (
              <div className="space-y-16">
                {posts.map((post) => (
                  <article key={post.id} className="max-w-3xl">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">{post.title}</h2>

                    <div className="aspect-[4/3] rounded-xl bg-gray-200 mb-6 flex items-center justify-center overflow-hidden">
                      {post.image_url ? (
                        <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-400 text-sm">課程主圖</span>
                      )}
                    </div>

                    <div className="space-y-6 text-gray-700 leading-relaxed">
                      {post.intro_text ? (
                        <p className="whitespace-pre-line">{post.intro_text}</p>
                      ) : (
                        <p className="text-gray-500">尚無簡介。</p>
                      )}
                    </div>

                    <div className="mt-6">
                      <Link
                        href={post.course_id ? `/course/${post.course_id}` : `/courses/post/${post.id}`}
                        className="block w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white font-medium text-center transition-colors"
                      >
                        READ MORE
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="mt-12 md:mt-0 md:col-span-5 lg:col-span-4">
            <div className="md:sticky md:top-24">
              <h2 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                最新課程文章
              </h2>
              <ul className="space-y-3">
                {posts.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={post.course_id ? `/course/${post.course_id}` : `/courses/post/${post.id}`}
                      className="text-sm text-gray-600 hover:text-brand transition-colors line-clamp-2"
                    >
                      {post.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
