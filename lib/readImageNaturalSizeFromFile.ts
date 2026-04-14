/**
 * 僅在瀏覽器使用：讀取本機圖檔的 intrinsic 寬高（供裝飾圖預設尺寸）。
 */
export function readImageNaturalSizeFromFile(file: File): Promise<{ width: number; height: number }> {
  if (typeof window === "undefined") {
    return Promise.resolve({ width: 72, height: 72 });
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;
      resolve({ width: w, height: h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("無法讀取圖片尺寸"));
    };
    img.src = url;
  });
}
