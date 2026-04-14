/**
 * 由完整地址產生 Google Maps 嵌入用 iframe `src`（不需 Maps Embed API Key）。
 * 使用 `maps.google.com` 之 `output=embed` 格式，較利於 iframe 顯示。
 */
export function googleMapsEmbedSrcFromAddress(address: string | null | undefined): string | null {
  const q = typeof address === "string" ? address.trim() : "";
  if (!q) return null;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&hl=zh-TW&z=16&output=embed`;
}

/**
 * 由地址產生可寫入 `classes.map_embed_html` 的單一 iframe HTML（寬度自適應、lazy load）。
 * 後台僅填地址、此欄留空時，儲存會自動帶入；前台優先渲染此 HTML（若為安全 iframe）。
 */
export function googleMapsIframeHtmlFromAddress(address: string | null | undefined): string | null {
  const src = googleMapsEmbedSrcFromAddress(address);
  if (!src) return null;
  const esc = src.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<iframe src="${esc}" width="100%" height="400" style="border:0;max-width:100%;display:block" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="地圖"></iframe>`;
}
