"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { getCourseForEdit } from "@/app/actions/productActions";
import type { CourseForEdit } from "@/app/actions/productActions";
import CourseEditForm from "@/app/components/CourseEditForm";

export default function AdminEditClassPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0] ?? "";
  const [data, setData] = useState<CourseForEdit | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getCourseForEdit(id).then((editData) => {
      if (cancelled) return;
      setData(editData ?? null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  if (!id) {
    return (
      <div className="space-y-6">
        <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">返回商品管理</Link>
        <p className="text-gray-500">無課程 ID</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          返回商品管理
        </Link>
        {data && (
          <Link
            href={`/course/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            預覽課程
          </Link>
        )}
      </div>
      <h1 className="text-xl font-bold text-gray-900">編輯課程</h1>
      {loading ? (
        <p className="text-gray-500">載入中…</p>
      ) : data === null ? (
        <p className="text-gray-500">找不到此課程</p>
      ) : (
        <CourseEditForm courseId={id} initialData={data ?? null} />
      )}
    </div>
  );
}
