"use client";

type Props = {
  aboutContent: string | null;
  navAboutLabel: string;
  aboutSectionBackgroundColor: string;
};

export default function AboutSection({ aboutContent, navAboutLabel, aboutSectionBackgroundColor }: Props) {
  if (aboutContent == null || aboutContent.trim() === "") return null;
  return (
    <section
      id="about"
      className="py-12 px-4 scroll-mt-20 border-t border-gray-100"
      style={{ backgroundColor: aboutSectionBackgroundColor }}
    >
      <div className="mx-auto max-w-7xl">
        <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">{navAboutLabel || "關於我們"}</h2>
        <div
          className="prose prose-gray max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: aboutContent }}
        />
      </div>
    </section>
  );
}
