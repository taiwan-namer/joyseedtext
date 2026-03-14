"use client";

import FAQ from "@/app/components/FAQ";

export default function FAQSection() {
  return (
    <section id="faq" className="bg-white py-12 px-4 scroll-mt-20">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">常見問題</h2>
        <FAQ />
      </div>
    </section>
  );
}
