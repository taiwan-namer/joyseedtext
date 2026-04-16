"use client";

import Link from "next/link";
import { useStoreSettings } from "@/app/providers/StoreSettingsProvider";
import { HeaderMember } from "@/app/components/HeaderMember";

export default function PrivacyPage() {
  const { siteName } = useStoreSettings();
  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between">
          <Link href="/" prefetch className="text-xl font-bold text-brand touch-manipulation">
            {siteName}
          </Link>
          <HeaderMember />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">隱私權條款</h1>
        <div className="prose prose-gray text-gray-700 space-y-4">
          <p>請於此處填寫您的隱私權條款內容。</p>
        </div>
      </main>
    </div>
  );
}
