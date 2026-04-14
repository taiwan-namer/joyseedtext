"use server";

import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import { uploadOneToR2WithPrefix } from "@/app/actions/productActions";

/**
 * 課程「圖文編輯」內嵌圖片上傳至 R2（路徑：{merchant}/classes/post-content/…）。
 */
export async function uploadCourseEditorImage(
  formData: FormData
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  try {
    await verifyAdminSession();
    const url = await uploadOneToR2WithPrefix(formData, "editor_image", "classes/post-content");
    if (!url) {
      return {
        success: false,
        error: "請選擇有效的圖片檔案（JPEG／PNG／GIF／WebP，10MB 以下）",
      };
    }
    return { success: true, url };
  } catch (e) {
    const message = e instanceof Error ? e.message : "上傳失敗";
    return { success: false, error: message };
  }
}
