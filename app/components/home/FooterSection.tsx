"use client";

type Props = { siteName: string };

export default function FooterSection({ siteName }: Props) {
  return (
    <footer className="bg-white border-t border-gray-100 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="text-center text-gray-400 text-sm">
          <p>© 2026 {siteName} WonderVoyage 版權所有</p>
        </div>
      </div>
    </footer>
  );
}
