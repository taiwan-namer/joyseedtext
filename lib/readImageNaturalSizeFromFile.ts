/**
 * 僅在瀏覽器使用：讀取本機圖檔的解碼後寬高（供裝飾圖預設尺寸，與原檔顯示比例一致）。
 * 優先使用 `createImageBitmap`（較能反映解碼後像素；部分情境下對 EXIF 方向較一致），失敗則退回 Image 載入。
 */
export function readImageNaturalSizeFromFile(file: File): Promise<{ width: number; height: number }> {
  if (typeof window === "undefined") {
    return Promise.resolve({ width: 72, height: 72 });
  }
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file)
      .then((bmp) => {
        const w = Math.max(1, bmp.width);
        const h = Math.max(1, bmp.height);
        bmp.close();
        return { width: w, height: h };
      })
      .catch(() => readImageNaturalSizeFromFileViaImage(file));
  }
  return readImageNaturalSizeFromFileViaImage(file);
}

function readImageNaturalSizeFromFileViaImage(file: File): Promise<{ width: number; height: number }> {
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
