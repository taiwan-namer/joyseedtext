/**
 * 由完整地址產生 Google Maps 嵌入用 `iframe` `src`（不需手動貼 iframe HTML）。
 */
export function googleMapsEmbedSrcFromAddress(address: string | null | undefined): string | null {
  const q = typeof address === "string" ? address.trim() : "";
  if (!q) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed&hl=zh-TW`;
}
