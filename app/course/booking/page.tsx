"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Image as ImageIcon } from "lucide-react";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { HeaderMember } from "@/app/components/HeaderMember";
import { getCoursesForHomepage } from "@/app/actions/productActions";
import type { CourseForPublic } from "@/app/actions/productActions";

export default function CourseBookingPage() {
  const { siteName } = useStoreSettings();
  const [courses, setCourses] = useState<CourseForPublic[]>([]);

  useEffect(() => {
    getCoursesForHomepage().then((res) => {
      if (res.success && res.data.length > 0) {
        setCourses(res.data);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-screen-md px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-brand">
            {siteName}
          </Link>
          <HeaderMember />
        </div>
      </header>

      <div className="mx-auto max-w-screen-md px-4 py-6">
        {/* 麵包屑 */}
        <nav className="mb-6 text-sm text-gray-500" aria-label="麵包屑">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/" className="hover:text-amber-600 transition-colors">
                首頁
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 shrink-0" />
              <span className="text-gray-700">課程預約</span>
            </li>
          </ol>
        </nav>

        <h1 className="text-xl font-semibold text-gray-800 mb-6">課程預約</h1>

        <ul className="space-y-4">
          {courses.length === 0 ? (
            <li className="py-12 text-center text-gray-500 text-sm">尚無課程，請至後台新增課程</li>
          ) : (
            courses.map((course) => {
              const price = course.salePrice != null && course.price != null && course.salePrice < course.price ? course.salePrice : course.price ?? 0;
              return (
                <li key={course.id}>
                  <Link
                    href={`/course/${course.slug || course.id}`}
                    className="flex overflow-hidden bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="relative w-36 h-28 shrink-0 rounded-l-lg bg-gray-200 flex items-center justify-center overflow-hidden">
                      {course.imageUrl ? (
                        <Image
                          src={course.imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="144px"
                        />
                      ) : (
                        <ImageIcon className="w-10 h-10 text-gray-400 relative z-[1]" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col justify-between py-3 px-4">
                      <h2 className="font-semibold text-gray-800">{course.title}</h2>
                      <p className="text-amber-600 font-semibold mt-2">
                        NT$ {price.toLocaleString()} 起
                      </p>
                    </div>
                    <span className="self-center flex items-center justify-center py-2 px-3 rounded-lg bg-amber-500 text-white text-xs font-medium shrink-0 mr-3">
                      立即預約
                    </span>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
