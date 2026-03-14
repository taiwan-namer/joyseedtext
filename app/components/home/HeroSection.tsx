"use client";

type Props = { heroImageUrl: string | null };

export default function HeroSection({ heroImageUrl }: Props) {
  if (!heroImageUrl) return null;
  return (
    <section className="px-4 pt-0 pb-4 mx-auto w-full max-w-7xl">
      <div className="relative w-full aspect-[4/5] sm:aspect-[3/2] md:aspect-auto md:h-[600px] rounded-xl overflow-hidden bg-amber-50">
        <img src={heroImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none" aria-hidden />
      </div>
    </section>
  );
}
