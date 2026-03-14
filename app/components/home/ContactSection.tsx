"use client";

import Link from "next/link";
import { Facebook, Instagram } from "lucide-react";

/** LINE 圖示（lucide 無內建，用 SVG 以 currentColor 套主色） */
function LineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.127h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

type Props = {
  siteName: string;
  primaryColor: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  socialFbUrl: string;
  socialIgUrl: string;
  socialLineUrl: string;
  mapEmbedUrl: string;
};

export default function ContactSection({
  siteName,
  primaryColor,
  contactPhone,
  contactEmail,
  contactAddress,
  socialFbUrl,
  socialIgUrl,
  socialLineUrl,
  mapEmbedUrl,
}: Props) {
  const hasContact = !!(contactPhone || contactEmail || contactAddress);
  const hasSocialLinks = !!(socialFbUrl || socialIgUrl || socialLineUrl);

  return (
    <section className="bg-page border-t border-gray-100 py-12 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            {(hasContact || hasSocialLinks) && (
              <>
                <p className="text-xl font-bold text-brand">{siteName}</p>
                {hasContact && (
                  <div className="text-gray-700 text-sm space-y-2">
                    {contactPhone && <p>聯絡電話：{contactPhone}</p>}
                    {contactEmail && (
                      <p>
                        信箱：{" "}
                        <a href={`mailto:${contactEmail}`} className="text-brand hover:underline">
                          {contactEmail}
                        </a>
                      </p>
                    )}
                    {contactAddress && <p>地址：{contactAddress}</p>}
                  </div>
                )}
                <div className="flex flex-wrap gap-6">
                  {socialFbUrl ? (
                    <a
                      href={socialFbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 text-gray-600 hover:opacity-80 transition-opacity"
                      aria-label="Facebook"
                    >
                      <span
                        className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm"
                        style={{ color: primaryColor }}
                      >
                        <Facebook className="w-5 h-5" strokeWidth={2} />
                      </span>
                      <span className="text-xs font-medium">Facebook</span>
                    </a>
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-gray-400" aria-hidden>
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm">
                        <Facebook className="w-5 h-5" strokeWidth={2} />
                      </span>
                      <span className="text-xs font-medium">Facebook</span>
                    </span>
                  )}
                  {socialIgUrl ? (
                    <a
                      href={socialIgUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 text-gray-600 hover:opacity-80 transition-opacity"
                      aria-label="Instagram"
                    >
                      <span
                        className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm"
                        style={{ color: primaryColor }}
                      >
                        <Instagram className="w-5 h-5" strokeWidth={2} />
                      </span>
                      <span className="text-xs font-medium">Instagram</span>
                    </a>
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-gray-400" aria-hidden>
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm">
                        <Instagram className="w-5 h-5" strokeWidth={2} />
                      </span>
                      <span className="text-xs font-medium">Instagram</span>
                    </span>
                  )}
                  {socialLineUrl ? (
                    <a
                      href={socialLineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 text-gray-600 hover:opacity-80 transition-opacity"
                      aria-label="LINE"
                    >
                      <span
                        className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm"
                        style={{ color: primaryColor }}
                      >
                        <LineIcon className="w-5 h-5" />
                      </span>
                      <span className="text-xs font-medium">LINE</span>
                    </a>
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-gray-400" aria-hidden>
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm">
                        <LineIcon className="w-5 h-5" />
                      </span>
                      <span className="text-xs font-medium">LINE</span>
                    </span>
                  )}
                </div>
              </>
            )}
            {!hasContact && !hasSocialLinks && (
              <p className="text-sm text-gray-500">請至後台「基本資料」填寫聯絡資訊與社群連結。</p>
            )}
          </div>
          {mapEmbedUrl && (
            <div className="w-full min-h-0 rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm flex flex-col max-h-[320px]">
              <iframe
                src={mapEmbedUrl}
                title="地圖"
                className="w-full h-full min-h-[240px] max-h-[320px] border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}
        </div>
        <div className="mt-8 pt-6 border-t border-gray-200 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-gray-600">
          <Link href="/privacy" className="hover:text-brand hover:underline">
            隱私權條款
          </Link>
          <Link href="/terms" className="hover:text-brand hover:underline">
            服務條款
          </Link>
        </div>
      </div>
    </section>
  );
}
