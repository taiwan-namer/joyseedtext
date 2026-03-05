import CourseEditForm from "@/app/components/CourseEditForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NewClassPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="flex items-center gap-1 text-sm font-medium text-gray-600 transition hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          返回後台
        </Link>
      </div>
      <CourseEditForm />
    </div>
  );
}
