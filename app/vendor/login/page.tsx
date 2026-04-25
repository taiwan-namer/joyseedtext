import Link from "next/link";

export default function VendorLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-800">供應商後台</h1>
          <p className="text-sm text-gray-500 mt-1">供應商後台登入</p>
        </div>

        <Link
          href="/api/vendor/branch/line-login"
          className="block w-full text-center py-3 rounded-lg font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
        >
          使用 LINE 登入後台
        </Link>

        <Link
          href="/admin/login?next=/admin"
          className="block w-full text-center py-3 rounded-lg font-medium text-gray-800 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          使用帳號密碼登入
        </Link>
      </div>
    </div>
  );
}
