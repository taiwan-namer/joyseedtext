/** 移除內嵌 HTML 中的 Google Fonts 資源連結，減少多餘請求。 */
export function stripGoogleFontsFromHtml(html: string): string {
  if (!html) return html;
  let out = html;
  out = out.replace(/<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>/gi, "");
  out = out.replace(/@import\s+url\s*\([^)]*(?:fonts\.googleapis\.com|\/\/fonts\.googleapis)[^)]*\)\s*;?/gi, "");
  out = out.replace(/@import[^;]*fonts\.googleapis\.com[^;]*;?/gi, "");
  return out;
}
