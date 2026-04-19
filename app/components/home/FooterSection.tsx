"use client";

import { JOYSEED_ISLAND_WEB_URL } from "@/lib/mainSiteCanonical";

type Props = { siteName: string };

export default function FooterSection({ siteName }: Props) {
  return (
    <footer className="bg-white border-t border-gray-100 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="text-center text-gray-400 text-sm">
          <p>
            <a
              href={JOYSEED_ISLAND_WEB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-brand hover:underline"
            >
              © 2026 {siteName} WonderVoyage 版權所有
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
