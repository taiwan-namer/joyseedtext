"use client";

type Props = { imageUrl: string | null };

/** 單張大圖區塊（可放於版面任意位置，不輪播） */
export default function FullWidthImageSection({ imageUrl }: Props) {
  if (!imageUrl || !imageUrl.trim()) return null;
  return (
    <section className="px-4 py-4 mx-auto w-full max-w-7xl">
      <div className="relative w-full aspect-[3/2] md:aspect-[21/9] rounded-xl overflow-hidden bg-gray-100">
        <img src={imageUrl.trim()} alt="" className="absolute inset-0 w-full h-full object-cover" />
      </div>
    </section>
  );
}
