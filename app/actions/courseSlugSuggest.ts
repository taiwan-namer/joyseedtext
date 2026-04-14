"use server";

import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import {
  isValidCourseSlugFormat,
  normalizeCourseSlugInput,
  slugifyCourseTitle,
} from "@/lib/courseSlug";

const TRANSLATE_V2 = "https://translation.googleapis.com/language/translate/v2";

/** 含中日韓等需翻成英文再 slug 的文字 */
const HAS_CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;

/**
 * 後台專用：依課程標題建議網址代稱。
 * 有設定 GOOGLE_TRANSLATION_API_KEY 且標題含中文等時，先譯成英文再 slugify；否則僅本地 slugify。
 */
export async function suggestCourseSlugFromTitle(title: string): Promise<string> {
  await verifyAdminSession();

  const raw = String(title ?? "").trim();
  if (!raw) {
    return slugifyCourseTitle("");
  }

  const key = process.env.GOOGLE_TRANSLATION_API_KEY?.trim();
  const naive = slugifyCourseTitle(raw);

  if (!key) {
    return naive;
  }

  if (!HAS_CJK_RE.test(raw) && naive !== "course" && naive.length >= 2) {
    return naive;
  }

  try {
    const res = await fetch(`${TRANSLATE_V2}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: [raw],
        target: "en",
        format: "text",
      }),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return naive;
    }

    const json = (await res.json()) as {
      data?: { translations?: { translatedText?: string }[] };
    };
    const translated = json?.data?.translations?.[0]?.translatedText?.trim();
    if (!translated) {
      return naive;
    }

    let slug = normalizeCourseSlugInput(translated);
    if (slug.length < 2) {
      slug = normalizeCourseSlugInput(`${translated}-course`);
    }
    if (!isValidCourseSlugFormat(slug)) {
      slug = normalizeCourseSlugInput(`${translated}-class`);
    }
    if (!isValidCourseSlugFormat(slug)) {
      return naive !== "course" ? naive : slugifyCourseTitle(translated);
    }
    return slug;
  } catch {
    return naive;
  }
}
