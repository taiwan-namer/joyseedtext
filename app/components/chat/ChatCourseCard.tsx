"use client";

import Link from "next/link";

export type ChatCourseItem = {
  id: string;
  title: string;
  image_url: string | null;
  price: number | null;
  age_range: string;
  url: string;
};

export function ChatCourseCard({
  course,
  primaryColor,
  onLinkClick,
}: {
  course: ChatCourseItem;
  primaryColor: string;
  onLinkClick?: () => void;
}) {
  const handleClick = () => {
    onLinkClick?.();
  };
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {course.image_url ? (
        <div className="relative h-32 w-full bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={course.image_url}
            alt={course.title}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="h-24 w-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
          無圖片
        </div>
      )}
      <div className="p-3">
        <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{course.title}</h4>
        <p className="mt-1 text-xs text-gray-500">適合：{course.age_range}</p>
        <p className="mt-0.5 text-sm font-medium" style={{ color: primaryColor }}>
          {course.price != null ? `NT$ ${course.price}` : "洽詢"}
        </p>
        <div className="mt-2 flex gap-2">
          <Link
            href={course.url}
            onClick={handleClick}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            查看課程
          </Link>
          <Link
            href={course.url}
            onClick={handleClick}
            className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: primaryColor }}
          >
            立即報名
          </Link>
        </div>
      </div>
    </div>
  );
}
