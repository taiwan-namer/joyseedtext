"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { uploadOneToR2 } from "@/app/actions/productActions";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export type CourseIntroPost = {
  id: string;
  merchant_id: string;
  source: "course" | "manual";
  course_id: string | null;
  title: string;
  image_url: string | null;
  gallery_urls: string[];
  intro_text: string | null;
  post_content: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function rowToPost(row: Record<string, unknown>): CourseIntroPost {
  return {
    id: String(row.id),
    merchant_id: String(row.merchant_id),
    source: row.source === "manual" ? "manual" : "course",
    course_id: row.course_id != null ? String(row.course_id) : null,
    title: String(row.title ?? ""),
    image_url: row.image_url != null ? String(row.image_url) : null,
    gallery_urls: Array.isArray(row.gallery_urls) ? (row.gallery_urls as string[]) : [],
    intro_text: row.intro_text != null ? String(row.intro_text) : null,
    post_content: row.post_content != null ? String(row.post_content) : null,
    sort_order: Number(row.sort_order) ?? 0,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** 新增課程儲存後呼叫：自動備份至課程介紹（insert 或 update 同 course_id）。回傳 ok/error 供補建流程判斷。 */
export async function backupCourseToIntro(
  merchantId: string,
  courseId: string,
  data: { title: string; imageUrl: string | null; galleryUrls: string[]; introText: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = createServerSupabase();
    const { data: existing, error: fetchErr } = await supabase
      .from("course_intro_posts")
      .select("id")
      .eq("merchant_id", merchantId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (fetchErr) return { ok: false, error: fetchErr.message };

    const row = {
      merchant_id: merchantId,
      source: "course",
      course_id: courseId,
      title: data.title,
      image_url: data.imageUrl,
      gallery_urls: data.galleryUrls.length ? data.galleryUrls : [],
      intro_text: data.introText || null,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error: updateErr } = await supabase
        .from("course_intro_posts")
        .update(row)
        .eq("id", existing.id);
      if (updateErr) return { ok: false, error: updateErr.message };
    } else {
      const { error: insertErr } = await supabase.from("course_intro_posts").insert(row);
      if (insertErr) return { ok: false, error: insertErr.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "備份失敗";
    return { ok: false, error: msg };
  }
}

/** 後台課程介紹列表 */
export async function getCourseIntroPostsForAdmin(): Promise<
  { success: true; data: CourseIntroPost[] } | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("course_intro_posts")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []).map((r) => rowToPost(r as Record<string, unknown>)) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "取得列表失敗";
    return { success: false, error: msg };
  }
}

/** 前台 /courses 用 */
export async function getCourseIntroPostsForPublic(): Promise<CourseIntroPost[]> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return [];
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("course_intro_posts")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data.map((r) => rowToPost(r as Record<string, unknown>));
  } catch {
    return [];
  }
}

/** 單筆（前台手動文章詳情用） */
export async function getCourseIntroPostById(id: string): Promise<CourseIntroPost | null> {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("course_intro_posts")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return rowToPost(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** 課程介紹手動新增部落格 */
export async function createCourseIntroPostManual(formData: FormData): Promise<
  { success: true; message?: string; id?: string } | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };

    const title = (formData.get("title") as string)?.trim();
    if (!title) return { success: false, error: "請填寫標題" };

    const introText = (formData.get("intro_text") as string)?.trim() ?? "";
    const postContent = (formData.get("post_content") as string)?.trim() ?? null;

    let imageUrl: string | null = await uploadOneToR2(formData, "image_main");

    const galleryUrls: string[] = [];
    for (const key of ["image_1", "image_2", "image_3", "image_4"]) {
      const url = await uploadOneToR2(formData, key);
      if (url) galleryUrls.push(url);
    }

    const supabase = createServerSupabase();
    const { data: inserted, error } = await supabase
      .from("course_intro_posts")
      .insert({
        merchant_id: merchantId,
        source: "manual",
        course_id: null,
        title,
        image_url: imageUrl,
        gallery_urls: galleryUrls.length ? galleryUrls : [],
        intro_text: introText || null,
        post_content: postContent,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, message: "已新增", id: inserted?.id ? String(inserted.id) : undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "新增失敗";
    return { success: false, error: msg };
  }
}

/** 從現有課程補建至課程介紹（表建立前已新增的課程如蠟筆工廠，執行一次即可全部備份過去） */
export async function backfillCourseIntroFromClasses(): Promise<
  { success: true; message?: string; count?: number } | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const supabase = createServerSupabase();
    const { data: classes, error: fetchError } = await supabase
      .from("classes")
      .select("id, title, image_url, gallery_urls, course_intro")
      .eq("merchant_id", merchantId)
      .order("id", { ascending: true });
    if (fetchError) return { success: false, error: fetchError.message };
    if (!classes || classes.length === 0) return { success: true, message: "尚無課程可補建", count: 0 };
    let count = 0;
    for (const row of classes as { id: string; title: string | null; image_url: string | null; gallery_urls: string[] | null; course_intro: string | null }[]) {
      const result = await backupCourseToIntro(merchantId, String(row.id), {
        title: row.title ?? "",
        imageUrl: row.image_url ?? null,
        galleryUrls: Array.isArray(row.gallery_urls) ? row.gallery_urls : [],
        introText: row.course_intro ?? "",
      });
      if (!result.ok) return { success: false, error: result.error };
      count++;
    }
    return { success: true, message: `已補建 ${count} 筆課程至課程介紹`, count };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "補建失敗";
    return { success: false, error: msg };
  }
}

/** 課程介紹刪除（僅後台課程介紹刪除才會從前台消失） */
export async function deleteCourseIntroPosts(ids: string[]): Promise<
  { success: true; message?: string } | { success: false; error: string }
> {
  if (ids.length === 0) return { success: false, error: "請選擇要刪除的項目" };
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("course_intro_posts")
      .delete()
      .eq("merchant_id", merchantId)
      .in("id", ids);
    if (error) return { success: false, error: error.message };
    return { success: true, message: `已刪除 ${ids.length} 筆` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "刪除失敗";
    return { success: false, error: msg };
  }
}
