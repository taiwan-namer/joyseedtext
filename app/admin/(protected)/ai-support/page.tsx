import Link from "next/link";
import { ChevronLeft, MessageCircle } from "lucide-react";

/**
 * AI 客服功能預留頁，敬請期待。
 */
export default function AdminAiSupportPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" />
          返回後台
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900">AI客服</h1>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <MessageCircle className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-600 font-medium">功能開發中</p>
        <p className="text-sm text-gray-500 mt-1">敬請期待</p>
      </div>
    </div>
  );
}
