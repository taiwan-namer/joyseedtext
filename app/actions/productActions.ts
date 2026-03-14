"use server";

import { revalidatePath } from "next/cache";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

/** 讀取並去除前後空白，避免 .env 隱形空白導致簽章錯誤 */
function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/** 金鑰用：trim + 移除換行／斷行，貼上時常會帶入導致簽章不符 */
function cleanCredential(value: string | undefined): string {
  if (value == null) return "";
  return value.replace(/\r\n|\r|\n/g, "").trim();
}

/**
 * 取得連線至 Cloudflare R2 的 S3 相容 Client。
 * endpoint 直接讀取 R2_ENDPOINT（去掉尾斜線），credentials 經 cleanCredential 防呆。
 */
function getR2Client(): S3Client {
  const rawEndpoint = process.env.R2_ENDPOINT?.trim() ?? "";
  const endpoint = rawEndpoint.replace(/\/+$/, "");
  const accessKeyId = cleanCredential(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = cleanCredential(process.env.R2_SECRET_ACCESS_KEY);

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "缺少 R2 環境變數：R2_ENDPOINT、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY（請檢查 .env.local）"
    );
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}

/**
 * 執行順序 1：將圖片上傳至 Cloudflare R2（S3 協定），並回傳公開網址。
 * 公開網址 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL / 檔案名稱
 */
async function uploadImageToR2(formData: FormData): Promise<string> {
  const bucketName = cleanCredential(process.env.R2_BUCKET_NAME);
  const publicBaseUrl = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim() ?? "").replace(/\/+$/, "");

  if (!bucketName || !publicBaseUrl) {
    throw new Error(
      "缺少 R2 環境變數：R2_BUCKET_NAME、NEXT_PUBLIC_R2_PUBLIC_URL（請檢查 .env.local 且勿在等號後留空白）"
    );
  }

  const file = formData.get("image_file") as File | null;
  if (!file || !(file instanceof File)) {
    throw new Error("請選擇一張課程圖片");
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("僅支援圖片格式：JPEG、PNG、GIF、WebP");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("圖片大小不可超過 10 MB");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `classes/${Date.now()}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    })
  );

  const imageUrl = `${publicBaseUrl}/${fileName}`;
  return imageUrl;
}

/** 上傳單一檔案到 R2，FormData key 由呼叫端傳入；無檔案或空則回傳 null（供 courseIntroActions 等使用） */
export async function uploadOneToR2(
  formData: FormData,
  key: string
): Promise<string | null> {
  return uploadOneToR2WithPrefix(formData, key, "classes");
}

/** 上傳單一檔案到 R2，可指定路徑前綴（例如 layout-bg 用於首頁區塊背景圖） */
export async function uploadOneToR2WithPrefix(
  formData: FormData,
  key: string,
  pathPrefix: string
): Promise<string | null> {
  const file = formData.get(key) as File | null;
  if (!file || !(file instanceof File) || file.size === 0) return null;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return null;
  if (file.size > MAX_IMAGE_SIZE) throw new Error(`圖片 ${key} 超過 10 MB`);
  const bucketName = cleanCredential(process.env.R2_BUCKET_NAME);
  const publicBaseUrl = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim() ?? "").replace(/\/+$/, "");
  if (!bucketName || !publicBaseUrl) throw new Error("缺少 R2 環境變數");
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `${pathPrefix}/${Date.now()}-${key}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    })
  );
  return `${publicBaseUrl}/${fileName}`;
}

/**
 * 新增課程：先上傳圖片到 R2 取得 image_url，再寫入 Supabase classes。
 * merchant_id 強制使用 process.env.NEXT_PUBLIC_CLIENT_ID，確保多租戶資料隔離。
 */
export async function createClass(formData: FormData): Promise<
  | { success: true; message?: string }
  | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return {
        success: false,
        error: "系統設定錯誤：未設定 NEXT_PUBLIC_CLIENT_ID（請檢查 .env.local 且勿在等號後留空白）",
      };
    }

    const title = (formData.get("title") as string)?.trim();
    const priceRaw = formData.get("price");
    const capacityRaw = formData.get("capacity");

    if (!title) {
      return { success: false, error: "請填寫課程名稱" };
    }
    const price = priceRaw != null ? Number(priceRaw) : NaN;
    const capacity = capacityRaw != null ? Number(capacityRaw) : NaN;
    if (Number.isNaN(price) || price < 0) {
      return { success: false, error: "請填寫有效的售價（數字、不可為負）" };
    }
    if (Number.isNaN(capacity) || capacity < 1 || !Number.isInteger(capacity)) {
      return { success: false, error: "請填寫有效的名額（正整數）" };
    }

    // 執行順序 1：上傳圖片到 R2，取得 image_url
    let imageUrl: string;
    try {
      imageUrl = await uploadImageToR2(formData);
    } catch (e) {
      const message = e instanceof Error ? e.message : "圖片上傳失敗";
      return { success: false, error: message };
    }

    // 執行順序 2：寫入 Supabase
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { error } = await supabase.from("classes").insert({
      merchant_id: merchantId,
      title,
      price: Math.round(price),
      capacity: Math.floor(capacity),
      image_url: imageUrl,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "寫入課程失敗",
      };
    }

    return { success: true, message: "課程已新增" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "新增課程時發生錯誤";
    return { success: false, error: message };
  }
}

/** 後台商品列表用：只撈此店家的課程，merchant_id 強制用 env，絕不撈到別家 */
export type ClassRow = {
  id: string;
  merchant_id: string;
  title: string | null;
  price: number | null;
  capacity: number | null;
  image_url: string | null;
};

export async function getClassesForAdmin(): Promise<
  | { success: true; data: ClassRow[] }
  | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    }
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("classes")
      .select("id, merchant_id, title, price, capacity, image_url")
      .eq("merchant_id", merchantId)
      .order("id", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: (data ?? []) as ClassRow[] };
  } catch (e) {
    const message = e instanceof Error ? e.message : "取得課程列表失敗";
    return { success: false, error: message };
  }
}

/** 後台僅更新課程名額（商品管理區直接調整） */
export async function updateCourseCapacity(
  id: string,
  capacity: number
): Promise<
  | { success: true; message?: string }
  | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    if (!Number.isInteger(capacity) || capacity < 1) {
      return { success: false, error: "名額須為 1 以上的整數" };
    }
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("classes")
      .update({ capacity })
      .eq("id", id)
      .eq("merchant_id", merchantId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/");
    revalidatePath(`/course/${id}`);
    return { success: true, message: "名額已更新" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新名額失敗";
    return { success: false, error: message };
  }
}

/**
 * 報名進度查詢用：更新「單一場次」的名額。
 * 若該場次來自 scheduled_slots，則更新該 slot 的 capacity；若來自 class_date/class_time，則更新課程的 capacity。
 */
export async function updateSessionCapacity(
  classId: string,
  slotDate: string,
  slotTime: string,
  capacity: number
): Promise<
  | { success: true; message?: string }
  | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    if (!Number.isInteger(capacity) || capacity < 1) {
      return { success: false, error: "名額須為 1 以上的整數" };
    }
    const dateStr = String(slotDate).slice(0, 10);
    const timeStr = String(slotTime).replace(/.*(\d{2}:\d{2}).*/, "$1").slice(0, 5);

    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { data: row, error: fetchError } = await supabase
      .from("classes")
      .select("scheduled_slots, class_date, class_time, capacity")
      .eq("id", classId)
      .eq("merchant_id", merchantId)
      .single();

    if (fetchError || !row) return { success: false, error: "課程不存在或非本店家" };

    const r = row as {
      scheduled_slots?: { date?: string; time?: string; capacity?: number }[] | null;
      class_date?: string | null;
      class_time?: string | null;
      capacity?: number | null;
    };

    if (Array.isArray(r.scheduled_slots)) {
      let found = false;
      const newSlots = (r.scheduled_slots as { date?: string; time?: string; capacity?: number }[]).map((s) => {
        const sDate = String(s?.date ?? "").slice(0, 10);
        const sTime = String(s?.time ?? "").replace(/.*(\d{2}:\d{2}).*/, "$1").slice(0, 5);
        if (sDate === dateStr && sTime === timeStr) {
          found = true;
          return { ...s, date: s.date ?? dateStr, time: s.time ?? timeStr, capacity };
        }
        return s;
      });
      if (found) {
        const { error: updateError } = await supabase
          .from("classes")
          .update({ scheduled_slots: newSlots })
          .eq("id", classId)
          .eq("merchant_id", merchantId);
        if (updateError) return { success: false, error: updateError.message };
        revalidatePath("/");
        revalidatePath(`/course/${classId}`);
        return { success: true, message: "場次名額已更新" };
      }
    }

    const classDateStr = r.class_date ? String(r.class_date).slice(0, 10) : "";
    const classTimeStr = r.class_time ? String(r.class_time).replace(/.*(\d{2}:\d{2}).*/, "$1").slice(0, 5) : "00:00";
    if (classDateStr === dateStr && classTimeStr === timeStr) {
      const { error: updateError } = await supabase
        .from("classes")
        .update({ capacity })
        .eq("id", classId)
        .eq("merchant_id", merchantId);
      if (updateError) return { success: false, error: updateError.message };
      revalidatePath("/");
      revalidatePath(`/course/${classId}`);
      return { success: true, message: "名額已更新" };
    }

    return { success: false, error: "找不到對應的場次" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新名額失敗";
    return { success: false, error: message };
  }
}

/** 後台刪除課程（依 id，僅限本 merchant） */
export async function deleteClasses(ids: string[]): Promise<
  | { success: true; message?: string }
  | { success: false; error: string }
> {
  if (ids.length === 0) return { success: false, error: "請選擇要刪除的項目" };
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("classes")
      .delete()
      .eq("merchant_id", merchantId)
      .in("id", ids);
    if (error) return { success: false, error: error.message };
    return { success: true, message: `已刪除 ${ids.length} 筆` };
  } catch (e) {
    const message = e instanceof Error ? e.message : "刪除失敗";
    return { success: false, error: message };
  }
}

/** 客戶需知表單欄位對應 DB 的 customer_notice JSON */
export type CustomerNoticeForm = {
  活動場域類型: string;
  課程時段長度: string;
  教學語言: string[];
  教學語言自行填寫?: string;
  家長陪同規則: string;
  體驗成果: string[];
  費用包含項目: string[];
  寵物攜帶規定: string;
  師生比例分子: number;
  師生比例分母: number;
  最低成行人數: number;
  未達人數處置: string;
};

/**
 * 新增課程（完整版）：主圖 + 5 張圖、課程介紹、圖文、客戶需知、注意事項。
 * 需在 Supabase classes 表新增欄位：course_intro, post_content, gallery_urls (jsonb), customer_notice (jsonb), notes (text)。
 */
export async function createCourseFull(formData: FormData): Promise<
  | { success: true; message?: string; id?: string }
  | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    }

    const title = (formData.get("title") as string)?.trim();
    const priceRaw = formData.get("price");
    const capacityRaw = formData.get("capacity");
    if (!title) return { success: false, error: "請填寫課程名稱" };
    const price = priceRaw != null ? Number(priceRaw) : NaN;
    const capacity = capacityRaw != null ? Number(capacityRaw) : NaN;
    if (Number.isNaN(price) || price < 0) return { success: false, error: "請填寫有效的售價" };
    if (Number.isNaN(capacity) || capacity < 1 || !Number.isInteger(capacity)) {
      return { success: false, error: "請填寫有效的名額" };
    }
    const salePriceRaw = formData.get("sale_price");
    const salePrice = salePriceRaw != null && String(salePriceRaw).trim() !== "" ? Number(salePriceRaw) : NaN;
    const hasSalePrice = !Number.isNaN(salePrice) && salePrice >= 0;
    if (hasSalePrice && salePrice > price) {
      return { success: false, error: "特價不可高於原價" };
    }

    const mainUrl = await uploadOneToR2(formData, "image_main");
    if (!mainUrl) return { success: false, error: "請上傳主圖" };

    const galleryUrls: string[] = [];
    for (const key of ["image_1", "image_2", "image_3", "image_4", "image_5"]) {
      const url = await uploadOneToR2(formData, key);
      if (url) galleryUrls.push(url);
    }

    const courseIntro = (formData.get("course_intro") as string)?.trim() ?? "";
    const postContent = (formData.get("post_content") as string)?.trim() ?? "";
    const notes = (formData.get("notes") as string)?.trim() ?? "";

    const sidebarOptionRaw = formData.get("sidebar_option") as string | null;
    const sidebarOption = (() => {
      if (!sidebarOptionRaw) return [];
      try {
        const arr = JSON.parse(sidebarOptionRaw) as unknown;
        return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
      } catch {
        return [];
      }
    })();
    const scheduledSlotsRaw = formData.get("scheduled_slots") as string | null;
    const scheduledSlots = (() => {
      if (!scheduledSlotsRaw) return [];
      try {
        const arr = JSON.parse(scheduledSlotsRaw) as unknown;
        if (!Array.isArray(arr)) return [];
        return arr
          .filter((x): x is { date: string; time: string; capacity?: number } => typeof x === "object" && x != null && "date" in x && "time" in x && typeof (x as { date: unknown }).date === "string" && typeof (x as { time: unknown }).time === "string")
          .map((s) => ({ date: s.date.slice(0, 10), time: String(s.time).slice(0, 5), capacity: typeof s.capacity === "number" && s.capacity >= 1 ? s.capacity : Math.floor(capacity) }));
      } catch {
        return [];
      }
    })();

    const addonPricesRaw = formData.get("addon_prices") as string | null;
    const addonPrices = (() => {
      if (!addonPricesRaw) return [];
      try {
        const arr = JSON.parse(addonPricesRaw) as unknown;
        if (!Array.isArray(arr)) return [];
        return arr.filter((x): x is { name: string; price: number } => typeof x === "object" && x != null && "name" in x && "price" in x && typeof (x as { name: unknown }).name === "string" && typeof (x as { price: unknown }).price === "number" && (x as { price: number }).price >= 0);
      } catch {
        return [];
      }
    })();

    const customerNotice: CustomerNoticeForm = {
      活動場域類型: (formData.get("customer_venue") as string)?.trim() ?? "室內",
      課程時段長度: (formData.get("customer_duration") as string)?.trim() ?? "",
      教學語言: formData.getAll("customer_lang") as string[],
      教學語言自行填寫: (formData.get("customer_lang_custom") as string)?.trim() || undefined,
      家長陪同規則: (formData.get("customer_parent") as string)?.trim() ?? "",
      體驗成果: formData.getAll("customer_outcome") as string[],
      費用包含項目: formData.getAll("customer_fee") as string[],
      寵物攜帶規定: (formData.get("customer_pet") as string)?.trim() ?? "不開放寵物進入",
      師生比例分子: Number(formData.get("customer_ratio_n")) || 1,
      師生比例分母: Number(formData.get("customer_ratio_d")) || 10,
      最低成行人數: Number(formData.get("customer_min_people")) || 5,
      未達人數處置: (formData.get("customer_not_met") as string)?.trim() ?? "改期",
    };

    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const classDateRaw = (formData.get("class_date") as string)?.trim() || null;
    const classTimeRaw = (formData.get("class_time") as string)?.trim() || null;
    const class_date = classDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(classDateRaw) ? classDateRaw : null;
    const class_time = classTimeRaw && /^\d{2}:\d{2}(:\d{2})?$/.test(classTimeRaw) ? classTimeRaw.slice(0, 5) : null;

    const row: Record<string, unknown> = {
      merchant_id: merchantId,
      title,
      price: Math.round(price),
      capacity: Math.floor(capacity),
      image_url: mainUrl,
      course_intro: courseIntro || null,
      post_content: postContent || null,
      gallery_urls: galleryUrls.length ? galleryUrls : null,
      customer_notice: customerNotice,
      notes: notes || null,
      sidebar_option: sidebarOption.length ? sidebarOption : null,
      scheduled_slots: scheduledSlots.length ? scheduledSlots : null,
      class_date,
      class_time,
      sale_price: hasSalePrice ? Math.round(salePrice) : null,
      addon_prices: addonPrices.length ? addonPrices : null,
    };
    const { data: inserted, error } = await supabase.from("classes").insert(row).select("id").single();

    if (error) {
      return { success: false, error: error.message || "寫入課程失敗（若為欄位不存在，請在 Supabase 新增 course_intro, post_content, gallery_urls, customer_notice, notes）" };
    }
    const newId = inserted?.id != null ? String(inserted.id) : undefined;
    if (newId && merchantId) {
      const { backupCourseToIntro } = await import("@/app/actions/courseIntroActions");
      await backupCourseToIntro(merchantId, newId, {
        title,
        imageUrl: mainUrl,
        galleryUrls,
        introText: courseIntro,
      });
    }
    return { success: true, message: "課程已新增", id: newId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "新增課程時發生錯誤";
    return { success: false, error: message };
  }
}

/** 後台選項 value 對應前台顯示標籤 */
const SIDEBAR_OPTION_LABELS: Record<string, string> = {
  "0": "0-3歲",
  "1": "3-6歲",
  "2": "6-9歲",
  "3": "可大人陪同",
};

/** 前台課程詳情（與 course-data CourseDetail 相容，供 /course/[id] 使用） */
export type CourseForPublic = {
  id: string;
  slug: string;
  title: string;
  ageRange: string;
  ageTags: string[];
  courseIntro?: string;
  thumbnailCount?: number;
  imageUrl?: string | null;
  galleryUrls?: string[] | null;
  customerNotice?: {
    活動場域類型: string;
    課程時段長度: string;
    教學語言: string;
    家長陪同規則: string;
    體驗成果: string;
    費用包含項目: string;
    寵物攜帶規定: string;
    師生比例: string;
    注意事項: string;
    活動成行條件: string;
  } | null;
  sidebarOptionLabels?: string[];
  scheduledSlots?: { date: string; time: string }[];
  price?: number;
  salePrice?: number | null;
  addonPrices?: { name: string; price: number }[];
  /** 圖文內文 HTML（READ MORE 全文頁） */
  postContent?: string | null;
  /** 剩餘名額（後台扣庫存後即為剩餘人數） */
  capacity?: number | null;
}

function mapRowToCourseForPublic(row: Record<string, unknown>): CourseForPublic {
  const id = String(row.id ?? "");
  const notice = row.customer_notice as Record<string, unknown> | null | undefined;
  const sidebarOption = (row.sidebar_option as string[] | null) ?? [];
  const labels = sidebarOption.map((v) => SIDEBAR_OPTION_LABELS[v] ?? v).filter(Boolean);
  const n = Number(notice?.師生比例分子) || 1;
  const d = Number(notice?.師生比例分母) || 10;
  const 師生比例 = `${n} : ${d}`;
  const 教學語言 = Array.isArray(notice?.教學語言) ? (notice.教學語言 as string[]).join(" 、 ") : String(notice?.教學語言 ?? "");
  const 體驗成果 = Array.isArray(notice?.體驗成果) ? (notice.體驗成果 as string[]).join(" 、 ") : String(notice?.體驗成果 ?? "");
  const 費用包含項目 = Array.isArray(notice?.費用包含項目) ? (notice.費用包含項目 as string[]).join(" 、 ") : String(notice?.費用包含項目 ?? "");
  const 最低成行 = Number(notice?.最低成行人數) || 0;
  const 未達處置 = String(notice?.未達人數處置 ?? "改期");
  const 活動成行條件 = 最低成行 ? `最低 ${最低成行} 人成行 ，${未達處置}` : 未達處置;
  return {
    id,
    slug: id,
    title: String(row.title ?? ""),
    ageRange: "",
    ageTags: labels.length > 0 ? labels : [],
    courseIntro: row.course_intro != null ? String(row.course_intro) : undefined,
    thumbnailCount: Array.isArray(row.gallery_urls) ? (row.gallery_urls as string[]).length : undefined,
    imageUrl: row.image_url != null ? String(row.image_url) : null,
    galleryUrls: Array.isArray(row.gallery_urls) ? (row.gallery_urls as string[]) : null,
    customerNotice: notice
      ? {
          活動場域類型: String(notice.活動場域類型 ?? "室內"),
          課程時段長度: String(notice.課程時段長度 ?? ""),
          教學語言: 教學語言 || String(notice.教學語言自行填寫 ?? ""),
          家長陪同規則: String(notice.家長陪同規則 ?? ""),
          體驗成果: 體驗成果,
          費用包含項目: 費用包含項目,
          寵物攜帶規定: String(notice.寵物攜帶規定 ?? ""),
          師生比例,
          注意事項: String(row.notes ?? ""),
          活動成行條件,
        }
      : undefined,
    sidebarOptionLabels: labels.length > 0 ? labels : undefined,
    scheduledSlots: Array.isArray(row.scheduled_slots) ? (row.scheduled_slots as { date: string; time: string }[]) : undefined,
    price: row.price != null ? Number(row.price) : undefined,
    salePrice: row.sale_price != null ? Number(row.sale_price) : null,
    addonPrices: Array.isArray(row.addon_prices) ? (row.addon_prices as { name: string; price: number }[]) : undefined,
    postContent: row.post_content != null ? String(row.post_content) : null,
    capacity: row.capacity !== undefined && row.capacity !== null ? Number(row.capacity) : undefined,
  };
}

/** 依 id 取得單一課程（供前台 /course/[id] 使用），含 capacity 供剩餘人數顯示 */
export async function getCourseById(id: string): Promise<CourseForPublic | null> {
  try {
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("classes")
      .select("id, title, price, sale_price, capacity, image_url, course_intro, post_content, gallery_urls, customer_notice, notes, sidebar_option, scheduled_slots, addon_prices")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return mapRowToCourseForPublic(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

/** 後台編輯用：取得單一課程原始資料（含 customer_notice 等） */
export type CourseForEdit = {
  id: string;
  title: string | null;
  price: number | null;
  capacity: number | null;
  course_intro: string | null;
  post_content: string | null;
  notes: string | null;
  sidebar_option: string[] | null;
  scheduled_slots: { date: string; time: string; capacity?: number }[] | null;
  class_date: string | null;
  class_time: string | null;
  sale_price: number | null;
  addon_prices: { name: string; price: number }[] | null;
  customer_notice: CustomerNoticeForm | null;
  image_url: string | null;
  gallery_urls: string[] | null;
};

export async function getCourseForEdit(id: string): Promise<CourseForEdit | null> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return null;
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("id", id)
      .eq("merchant_id", merchantId)
      .single();
    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    const notice = row.customer_notice as Record<string, unknown> | null;
    const classDateRaw = row.class_date;
    const classTimeRaw = row.class_time;
    const class_date = classDateRaw != null ? String(classDateRaw).slice(0, 10) : null;
    const class_time = classTimeRaw != null ? String(classTimeRaw).slice(0, 5) : null; // "09:00:00" -> "09:00"

    return {
      id: String(row.id),
      title: row.title != null ? String(row.title) : null,
      price: row.price != null ? Number(row.price) : null,
      capacity: row.capacity != null ? Number(row.capacity) : null,
      course_intro: row.course_intro != null ? String(row.course_intro) : null,
      post_content: row.post_content != null ? String(row.post_content) : null,
      notes: row.notes != null ? String(row.notes) : null,
      sidebar_option: Array.isArray(row.sidebar_option) ? (row.sidebar_option as string[]) : null,
      scheduled_slots: Array.isArray(row.scheduled_slots)
        ? (row.scheduled_slots as { date?: string; time?: string; capacity?: number }[]).map((s) => ({
            date: String(s?.date ?? "").slice(0, 10),
            time: String(s?.time ?? "09:00").slice(0, 5),
            capacity: typeof s?.capacity === "number" && s.capacity >= 1 ? s.capacity : (row.capacity != null ? Number(row.capacity) : 10),
          }))
        : null,
      class_date: class_date || null,
      class_time: class_time || null,
      sale_price: row.sale_price != null ? Number(row.sale_price) : null,
      addon_prices: Array.isArray(row.addon_prices) ? (row.addon_prices as { name: string; price: number }[]) : null,
      customer_notice: notice as CustomerNoticeForm | null,
      image_url: row.image_url != null ? String(row.image_url) : null,
      gallery_urls: Array.isArray(row.gallery_urls) ? (row.gallery_urls as string[]) : null,
    };
  } catch {
    return null;
  }
}

/** 後台更新課程（依 id，僅限本 merchant） */
export async function updateCourseFull(
  id: string,
  formData: FormData
): Promise<
  | { success: true; message?: string }
  | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };

    const title = (formData.get("title") as string)?.trim();
    const priceRaw = formData.get("price");
    const capacityRaw = formData.get("capacity");
    if (!title) return { success: false, error: "請填寫課程名稱" };
    const price = priceRaw != null ? Number(priceRaw) : NaN;
    const capacity = capacityRaw != null ? Number(capacityRaw) : NaN;
    if (Number.isNaN(price) || price < 0) return { success: false, error: "請填寫有效的售價" };
    if (Number.isNaN(capacity) || capacity < 1 || !Number.isInteger(capacity)) {
      return { success: false, error: "請填寫有效的名額" };
    }
    const salePriceRaw = formData.get("sale_price");
    const salePrice = salePriceRaw != null && String(salePriceRaw).trim() !== "" ? Number(salePriceRaw) : NaN;
    const hasSalePrice = !Number.isNaN(salePrice) && salePrice >= 0;
    if (hasSalePrice && salePrice > price) return { success: false, error: "特價不可高於原價" };

    const courseIntro = (formData.get("course_intro") as string)?.trim() ?? "";
    const postContent = (formData.get("post_content") as string)?.trim() ?? "";
    const notes = (formData.get("notes") as string)?.trim() ?? "";

    const sidebarOptionRaw = formData.get("sidebar_option") as string | null;
    const sidebarOption = (() => {
      if (!sidebarOptionRaw) return [];
      try {
        const arr = JSON.parse(sidebarOptionRaw) as unknown;
        return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
      } catch {
        return [];
      }
    })();
    const scheduledSlotsRaw = formData.get("scheduled_slots") as string | null;
    const scheduledSlots = (() => {
      if (!scheduledSlotsRaw) return [];
      try {
        const arr = JSON.parse(scheduledSlotsRaw) as unknown;
        if (!Array.isArray(arr)) return [];
        return arr.filter((x): x is { date: string; time: string } => typeof x === "object" && x != null && "date" in x && "time" in x && typeof (x as { date: unknown }).date === "string" && typeof (x as { time: unknown }).time === "string");
      } catch {
        return [];
      }
    })();
    const addonPricesRaw = formData.get("addon_prices") as string | null;
    const addonPrices = (() => {
      if (!addonPricesRaw) return [];
      try {
        const arr = JSON.parse(addonPricesRaw) as unknown;
        if (!Array.isArray(arr)) return [];
        return arr.filter((x): x is { name: string; price: number } => typeof x === "object" && x != null && "name" in x && "price" in x && typeof (x as { name: unknown }).name === "string" && typeof (x as { price: unknown }).price === "number" && (x as { price: number }).price >= 0);
      } catch {
        return [];
      }
    })();

    const customerNotice: CustomerNoticeForm = {
      活動場域類型: (formData.get("customer_venue") as string)?.trim() ?? "室內",
      課程時段長度: (formData.get("customer_duration") as string)?.trim() ?? "",
      教學語言: formData.getAll("customer_lang") as string[],
      教學語言自行填寫: (formData.get("customer_lang_custom") as string)?.trim() || undefined,
      家長陪同規則: (formData.get("customer_parent") as string)?.trim() ?? "",
      體驗成果: formData.getAll("customer_outcome") as string[],
      費用包含項目: formData.getAll("customer_fee") as string[],
      寵物攜帶規定: (formData.get("customer_pet") as string)?.trim() ?? "不開放寵物進入",
      師生比例分子: Number(formData.get("customer_ratio_n")) || 1,
      師生比例分母: Number(formData.get("customer_ratio_d")) || 10,
      最低成行人數: Number(formData.get("customer_min_people")) || 5,
      未達人數處置: (formData.get("customer_not_met") as string)?.trim() ?? "改期",
    };

    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();

    const mainFile = formData.get("image_main") as File | null;
    let mainUrl: string | null = null;
    if (mainFile && mainFile instanceof File && mainFile.size > 0) {
      mainUrl = await uploadOneToR2(formData, "image_main");
    }

    const { data: existing } = await supabase.from("classes").select("image_url, gallery_urls").eq("id", id).eq("merchant_id", merchantId).single();
    const existingRow = existing as { image_url?: string; gallery_urls?: string[] } | null;
    const keepMain = mainUrl ?? existingRow?.image_url ?? null;
    const existingGallery: string[] = Array.isArray(existingRow?.gallery_urls) ? (existingRow.gallery_urls as string[]) : [];

    const uploadedGallery: (string | null)[] = [];
    for (const key of ["image_1", "image_2", "image_3", "image_4"]) {
      const url = await uploadOneToR2(formData, key);
      uploadedGallery.push(url);
    }
    const finalGallery = uploadedGallery.map((url, i) => url ?? existingGallery[i]).filter(Boolean) as string[];

    const classDateRaw = (formData.get("class_date") as string)?.trim() || null;
    const classTimeRaw = (formData.get("class_time") as string)?.trim() || null;
    const class_date = classDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(classDateRaw) ? classDateRaw : null;
    const class_time = classTimeRaw && /^\d{2}:\d{2}(:\d{2})?$/.test(classTimeRaw) ? classTimeRaw.slice(0, 5) : null;

    const row: Record<string, unknown> = {
      title,
      price: Math.round(price),
      capacity: Math.floor(capacity),
      ...(keepMain != null && { image_url: keepMain }),
      ...(finalGallery.length > 0 && { gallery_urls: finalGallery }),
      course_intro: courseIntro || null,
      post_content: postContent || null,
      customer_notice: customerNotice,
      notes: notes || null,
      sidebar_option: sidebarOption.length ? sidebarOption : null,
      scheduled_slots: scheduledSlots.length ? scheduledSlots : null,
      class_date,
      class_time,
      sale_price: hasSalePrice ? Math.round(salePrice) : null,
      addon_prices: addonPrices.length ? addonPrices : null,
    };

    const { error } = await supabase.from("classes").update(row).eq("id", id).eq("merchant_id", merchantId);

    if (error) return { success: false, error: error.message };
    if (merchantId) {
      const { backupCourseToIntro } = await import("@/app/actions/courseIntroActions");
      await backupCourseToIntro(merchantId, id, {
        title,
        imageUrl: keepMain,
        galleryUrls: finalGallery,
        introText: courseIntro,
      });
    }
    revalidatePath("/");
    revalidatePath(`/course/${id}`);
    return { success: true, message: "課程已更新" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新課程時發生錯誤";
    return { success: false, error: message };
  }
}

/** 首頁「熱門課程」用：依 merchant 取得課程列表（與前台同步） */
export async function getCoursesForHomepage(): Promise<
  { success: true; data: CourseForPublic[] } | { success: false; error: string }
> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    }
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("classes")
      .select("id, merchant_id, title, price, sale_price, capacity, image_url, course_intro, gallery_urls, sidebar_option, notes, customer_notice, scheduled_slots, addon_prices")
      .eq("merchant_id", merchantId)
      .order("id", { ascending: true });
    if (error) {
      return { success: false, error: error.message };
    }
    const list = (data ?? []).map((row) => mapRowToCourseForPublic(row as Record<string, unknown>));
    return { success: true, data: list };
  } catch (e) {
    const message = e instanceof Error ? e.message : "取得課程列表失敗";
    return { success: false, error: message };
  }
}
