"use server";

import { revalidatePath } from "next/cache";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { verifyAdminSession } from "@/lib/auth/verifyAdminSession";
import { COURSES_LIST_PAGE_SIZE, HOMEPAGE_COURSES_FETCH_LIMIT } from "@/lib/constants";
import { sidebarOptionToDisplayLabels } from "@/lib/sidebarAgeOption";
import { fetchInventoryResolution } from "@/lib/inventoryClass";
import { pushInventoryBindToHqListing } from "@/lib/syncListingInventoryFromTeacher";
import { syncListingInventoryFromBindToken } from "@/lib/syncListingInventoryFromBindToken";

/** 首頁課程列表等快取：與 model 對齊之集中 revalidate（joyseed 目前以 path 為主） */
export async function revalidateHomepageCoursesListCache(): Promise<void> {
  revalidatePath("/");
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

/** 讀取並去除前後空白，避免 .env 隱形空白導致簽章錯誤 */
function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * 單店 R2 路徑隔離：Object Key 最上層必須為商家 ID。
 * 若 NEXT_PUBLIC_CLIENT_ID 未設定則拋錯，嚴禁寫入 bucket 根目錄。
 */
function requireMerchantIdForR2(): string {
  const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
  if (!merchantId) {
    throw new Error(
      "系統設定錯誤：未設定 NEXT_PUBLIC_CLIENT_ID，無法上傳至 R2（請檢查 .env.local）"
    );
  }
  return merchantId;
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
 * 公開網址 = NEXT_PUBLIC_R2_PUBLIC_URL / {merchantId}/classes/...
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

  const merchantId = requireMerchantIdForR2();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `${merchantId}/classes/${Date.now()}-${safeName}`;

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
  const merchantId = requireMerchantIdForR2();
  const bucketName = cleanCredential(process.env.R2_BUCKET_NAME);
  const publicBaseUrl = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim() ?? "").replace(/\/+$/, "");
  if (!bucketName || !publicBaseUrl) throw new Error("缺少 R2 環境變數");
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const fileName = `${merchantId}/${pathPrefix}/${Date.now()}-${key}-${safeName}`;
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
  | { success: true; message?: string; id?: string; listing_bind_token?: string }
  | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const envMerchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!envMerchantId) {
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

    const formMerchantRaw = (formData.get("merchant_id") as string)?.trim() ?? "";
    const { data: merchantRows } = await supabase.from("store_settings").select("merchant_id");
    const allowedMids = new Set(
      (merchantRows ?? [])
        .map((r) => String((r as { merchant_id: unknown }).merchant_id ?? "").trim())
        .filter(Boolean)
    );
    if (allowedMids.size === 0) {
      allowedMids.add(envMerchantId);
    }
    let effectiveMerchantId = envMerchantId;
    if (formMerchantRaw) {
      if (!allowedMids.has(formMerchantRaw)) {
        return { success: false, error: "無效的商家 ID（merchant_id）" };
      }
      effectiveMerchantId = formMerchantRaw;
    }

    const classDateRaw = (formData.get("class_date") as string)?.trim() || null;
    const classTimeRaw = (formData.get("class_time") as string)?.trim() || null;
    const class_date = classDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(classDateRaw) ? classDateRaw : null;
    const class_time = classTimeRaw && /^\d{2}:\d{2}(:\d{2})?$/.test(classTimeRaw) ? classTimeRaw.slice(0, 5) : null;

    const marketplace_category = (formData.get("marketplace_category") as string)?.trim() || null;
    const store_category = (formData.get("store_category") as string)?.trim() || null;
    const city_region = (formData.get("city_region") as string)?.trim() || null;
    const city_district = (formData.get("city_district") as string)?.trim() || null;
    const inventory_merchant_id = (formData.get("inventory_merchant_id") as string)?.trim() || null;
    const inventory_class_id_raw = (formData.get("inventory_class_id") as string)?.trim() || null;
    const inventory_class_id =
      inventory_merchant_id && inventory_class_id_raw ? inventory_class_id_raw : null;

    const hq_listing_bind_token = (formData.get("hq_listing_bind_token") as string)?.trim() || "";
    const hq_listing_merchant_id = (formData.get("hq_listing_merchant_id") as string)?.trim() || null;
    const hq_listing_class_id_raw = (formData.get("hq_listing_class_id") as string)?.trim() || null;
    const hq_listing_class_id =
      hq_listing_merchant_id && hq_listing_class_id_raw ? hq_listing_class_id_raw : null;
    /** 有配對碼時不依表單寫入手動兩欄，改由同步寫入 hq_listing_* */
    const hqListingForRow =
      hq_listing_bind_token
        ? { hq_listing_merchant_id: null as string | null, hq_listing_class_id: null as string | null }
        : {
            hq_listing_merchant_id: hq_listing_merchant_id || null,
            hq_listing_class_id: hq_listing_class_id || null,
          };

    const auto_listing_pairing_code = (formData.get("auto_listing_pairing_code") as string) === "on";
    const hasInventoryBind = !!(inventory_merchant_id && inventory_class_id);
    const shouldAutoMintListingToken =
      effectiveMerchantId === envMerchantId &&
      auto_listing_pairing_code &&
      !hq_listing_bind_token &&
      !hasInventoryBind;

    const baseRow: Record<string, unknown> = {
      merchant_id: effectiveMerchantId,
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
      marketplace_category,
      store_category,
      city_region,
      city_district,
      inventory_merchant_id: inventory_merchant_id || null,
      inventory_class_id: inventory_class_id || null,
      ...hqListingForRow,
    };

    /** 勿在檔案頂層 static import：含 sync 函式，會讓 "use server" 模組被 SWC 誤判；courseIntroActions 僅 import uploadOneToR2 也會整包解析此檔 */
    const listingBindTokenLib = await import("@/lib/listingBindToken");

    let mintedListingToken: string | null = null;
    let attemptRow: Record<string, unknown> = { ...baseRow };
    if (shouldAutoMintListingToken) {
      try {
        mintedListingToken = await listingBindTokenLib.mintUniqueListingBindToken(supabase);
        attemptRow = { ...attemptRow, listing_bind_token: mintedListingToken };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "產生配對碼失敗";
        return { success: false, error: msg };
      }
    }

    let inserted: { id: unknown } | null = null;
    for (;;) {
      const { data, error } = await supabase.from("classes").insert(attemptRow).select("id").single();
      if (!error && data) {
        inserted = data as { id: unknown };
        break;
      }
      const errMsg = error?.message ?? "";
      if (
        listingBindTokenLib.isMissingListingBindTokenColumnError(errMsg) &&
        attemptRow.listing_bind_token != null
      ) {
        const { listing_bind_token: _lb, ...rest } = attemptRow;
        attemptRow = rest;
        mintedListingToken = null;
        continue;
      }
      return {
        success: false,
        error:
          errMsg ||
          "寫入課程失敗（若為欄位不存在，請在 Supabase 新增 course_intro, post_content, gallery_urls, customer_notice, notes）",
      };
    }

    const actualTokenInRow = attemptRow.listing_bind_token;
    let listingTokenForResponse: string | undefined;
    if (
      mintedListingToken &&
      typeof actualTokenInRow === "string" &&
      actualTokenInRow === mintedListingToken
    ) {
      listingTokenForResponse = mintedListingToken;
    } else {
      listingTokenForResponse = undefined;
      mintedListingToken = null;
    }

    const newId = inserted?.id != null ? String(inserted.id) : undefined;
    if (newId && effectiveMerchantId) {
      const { backupCourseToIntro } = await import("@/app/actions/courseIntroActions");
      await backupCourseToIntro(effectiveMerchantId, newId, {
        title,
        imageUrl: mainUrl,
        galleryUrls,
        introText: courseIntro,
      });
    }
    let message = "課程已新增";
    let hqBindFailed = false;
    if (newId) {
      if (hq_listing_bind_token) {
        const sync = await syncListingInventoryFromBindToken(supabase, {
          teacherMerchantId: effectiveMerchantId,
          teacherClassId: newId,
          bindToken: hq_listing_bind_token,
        });
        if (!sync.ok) {
          hqBindFailed = true;
          message = `課程已新增，但總站列表綁定失敗：${sync.error}`;
        } else {
          message = "課程已新增，且已將總站列表課綁定至本課庫存";
        }
      } else if (hq_listing_merchant_id && hq_listing_class_id) {
        const sync = await pushInventoryBindToHqListing(supabase, {
          teacherMerchantId: effectiveMerchantId,
          teacherClassId: newId,
          hqListingMerchantId: hq_listing_merchant_id,
          hqListingClassId: hq_listing_class_id,
        });
        if (!sync.ok) {
          hqBindFailed = true;
          message = `課程已新增，但總站列表綁定失敗：${sync.error}`;
        } else {
          message = "課程已新增，且已將總站列表課綁定至本課庫存";
        }
      }
    }

    if (listingTokenForResponse && !hqBindFailed && !message.includes("總站列表綁定失敗")) {
      message += `\n\n已自動產生列表課配對碼（請複製給合作老師）：${listingTokenForResponse}`;
    }

    await revalidateHomepageCoursesListCache();

    return {
      success: true,
      message,
      id: newId,
      ...(listingTokenForResponse ? { listing_bind_token: listingTokenForResponse } : {}),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "新增課程時發生錯誤";
    return { success: false, error: message };
  }
}

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
  /** 總站主題分類（列表／RPC 可能帶入） */
  marketplace_category?: string | null;
}

function mapRowToCourseForPublic(row: Record<string, unknown>): CourseForPublic {
  const id = String(row.id ?? "");
  const notice = row.customer_notice as Record<string, unknown> | null | undefined;
  const sidebarOption = (row.sidebar_option as string[] | null) ?? [];
  const labels = sidebarOptionToDisplayLabels(sidebarOption);
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
    marketplace_category:
      row.marketplace_category != null ? String(row.marketplace_category) : null,
  };
}

/** 課程列表頁篩選參數（對應 URL SearchParams 與 RPC） */
export type ListCoursesParams = {
  page?: number;
  pageSize?: number;
  /** marketplace_category（總站主題分類） */
  category?: string;
  searchQuery?: string;
  startDate?: string | null;
  endDate?: string | null;
  minAge?: number | null;
  maxAge?: number | null;
};

function normalizeAgeRangeForRpc(
  minAge: number | null | undefined,
  maxAge: number | null | undefined
): { min: number | null; max: number | null } {
  let min = minAge ?? null;
  let max = maxAge ?? null;
  if (min != null && max == null) max = 99;
  if (max != null && min == null) min = 0;
  return { min, max };
}

export type CoursesListPageResult =
  | { success: true; data: CourseForPublic[]; total: number; page: number; pageSize: number }
  | { success: false; error: string };

/**
 * 課程列表頁：分頁 + 篩選（RPC list_classes_for_merchant_page），強制 merchant_id 隔離。
 */
export async function getCoursesForListpage(params: ListCoursesParams = {}): Promise<CoursesListPageResult> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    }
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? COURSES_LIST_PAGE_SIZE));
    const { min, max } = normalizeAgeRangeForRpc(params.minAge, params.maxAge);
    const useAge = min != null && max != null;

    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { data, error } = await supabase.rpc("list_classes_for_merchant_page", {
      p_merchant_id: merchantId,
      p_page: page,
      p_page_size: pageSize,
      p_search: params.searchQuery?.trim() || null,
      p_marketplace_category: params.category?.trim() || null,
      p_start_date: params.startDate?.trim() || null,
      p_end_date: params.endDate?.trim() || null,
      p_min_age: useAge ? min : null,
      p_max_age: useAge ? max : null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const payload = data as unknown;
    if (payload == null || typeof payload !== "object") {
      return { success: false, error: "課程列表回傳格式錯誤" };
    }
    const rec = payload as { total?: unknown; rows?: unknown };
    const totalRaw = rec.total;
    const total = typeof totalRaw === "number" ? totalRaw : Number(totalRaw ?? 0);
    const rowsRaw = Array.isArray(rec.rows) ? rec.rows : [];
    const list = rowsRaw.map((row) => mapRowToCourseForPublic(row as Record<string, unknown>));

    return {
      success: true,
      data: list,
      total: Number.isFinite(total) ? total : 0,
      page,
      pageSize,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "取得課程列表失敗";
    return { success: false, error: message };
  }
}

/**
 * 依 id 取得單一課程（供前台 /course/[id] 使用），含 capacity 供剩餘人數顯示。
 * 強制以伺服器端 NEXT_PUBLIC_CLIENT_ID 過濾 merchant_id；不可依客戶端傳入略過隔離。
 * （舊第二參數已忽略，避免 Client 元件內讀 env 為 undefined 時誤撈全庫任意一筆課程／圖片。）
 */
export async function getCourseById(id: string, _legacyMerchantParam?: string): Promise<CourseForPublic | null> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return null;
    }
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("classes")
      .select(
        "id, title, price, sale_price, capacity, image_url, course_intro, post_content, gallery_urls, customer_notice, notes, sidebar_option, scheduled_slots, addon_prices, inventory_merchant_id, inventory_class_id"
      )
      .eq("id", id)
      .eq("merchant_id", merchantId)
      .single();
    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    const inv = await fetchInventoryResolution(supabase, merchantId, id);
    if (inv && inv.inventoryClassId !== inv.listingClassId) {
      const { data: invRow, error: invErr } = await supabase
        .from("classes")
        .select("capacity, scheduled_slots, class_date, class_time")
        .eq("id", inv.inventoryClassId)
        .eq("merchant_id", inv.inventoryMerchantId)
        .single();
      if (!invErr && invRow) {
        const ir = invRow as {
          capacity?: unknown;
          scheduled_slots?: unknown;
          class_date?: unknown;
          class_time?: unknown;
        };
        row.capacity = ir.capacity;
        row.scheduled_slots = ir.scheduled_slots;
        row.class_date = ir.class_date;
        row.class_time = ir.class_time;
      }
    }
    return mapRowToCourseForPublic(row);
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
  /** 總站主題分類（與總站 DB 對齊） */
  marketplace_category: string | null;
  /** 分站自訂標籤（如：蒙特梭利） */
  store_category: string | null;
  /** 上課地區 */
  city_region: string | null;
  /** 上課地區—鄉鎮市區 */
  city_district: string | null;
  /** 庫存所屬商家（老師 NEXT_PUBLIC_CLIENT_ID），與 inventory_class_id 成對填寫 */
  inventory_merchant_id: string | null;
  /** 庫存所屬課程 UUID（老師端 classes.id） */
  inventory_class_id: string | null;
  /** 老師填寫：總站商家 ID（總站 NEXT_PUBLIC_CLIENT_ID） */
  hq_listing_merchant_id: string | null;
  /** 老師填寫：總站列表課 UUID */
  hq_listing_class_id: string | null;
  /** 課程所屬商家（與 classes.merchant_id 一致） */
  merchant_id: string;
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
      marketplace_category: row.marketplace_category != null ? String(row.marketplace_category) : null,
      store_category: row.store_category != null ? String(row.store_category) : null,
      city_region: row.city_region != null ? String(row.city_region) : null,
      city_district: row.city_district != null ? String(row.city_district) : null,
      inventory_merchant_id:
        row.inventory_merchant_id != null ? String(row.inventory_merchant_id).trim() || null : null,
      inventory_class_id: row.inventory_class_id != null ? String(row.inventory_class_id) : null,
      hq_listing_merchant_id:
        row.hq_listing_merchant_id != null ? String(row.hq_listing_merchant_id).trim() || null : null,
      hq_listing_class_id: row.hq_listing_class_id != null ? String(row.hq_listing_class_id) : null,
      merchant_id:
        row.merchant_id != null ? String(row.merchant_id).trim() || merchantId : merchantId,
    };
  } catch {
    return null;
  }
}

export type MerchantSummaryRow = { merchant_id: string; site_name: string };

/** 後台：所有 store_settings 商家（新增課程所屬商家下拉用） */
export async function getAllMerchantsForAdmin(): Promise<
  { success: true; data: MerchantSummaryRow[] } | { success: false; error: string }
> {
  try {
    await verifyAdminSession();
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("store_settings")
      .select("merchant_id, site_name")
      .order("merchant_id", { ascending: true })
      .limit(500);
    if (error) {
      return { success: false, error: error.message };
    }
    const rows = (data ?? []) as { merchant_id: string; site_name?: string }[];
    const list: MerchantSummaryRow[] = rows.map((r) => ({
      merchant_id: String(r.merchant_id ?? "").trim(),
      site_name: String(r.site_name ?? "").trim() || String(r.merchant_id ?? "").trim(),
    })).filter((r) => r.merchant_id.length > 0);
    return { success: true, data: list };
  } catch (e) {
    const message = e instanceof Error ? e.message : "取得商家列表失敗";
    return { success: false, error: message };
  }
}

/**
 * 後台更新課程（依 id，僅限本 merchant）。
 * 與 model 一致：表單 **`hq_listing_bind_token`**（優先）或 **`hq_listing_merchant_id` + `hq_listing_class_id`** 可自救綁定總站列表庫存。
 */
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

    const marketplace_category = (formData.get("marketplace_category") as string)?.trim() || null;
    const store_category = (formData.get("store_category") as string)?.trim() || null;
    const city_region = (formData.get("city_region") as string)?.trim() || null;
    const city_district = (formData.get("city_district") as string)?.trim() || null;
    const inventory_merchant_id = (formData.get("inventory_merchant_id") as string)?.trim() || null;
    const inventory_class_id_raw = (formData.get("inventory_class_id") as string)?.trim() || null;
    const inventory_class_id =
      inventory_merchant_id && inventory_class_id_raw ? inventory_class_id_raw : null;

    const hq_listing_bind_token = (formData.get("hq_listing_bind_token") as string)?.trim() || "";
    const hq_listing_merchant_id = (formData.get("hq_listing_merchant_id") as string)?.trim() || null;
    const hq_listing_class_id_raw = (formData.get("hq_listing_class_id") as string)?.trim() || null;
    const hq_listing_class_id =
      hq_listing_merchant_id && hq_listing_class_id_raw ? hq_listing_class_id_raw : null;
    /** 有配對碼時 update 不帶手動兩欄，避免誤寫入；同步成功後由 sync 更新 hq_listing_* */
    const hqListingPatch = hq_listing_bind_token
      ? {}
      : {
          hq_listing_merchant_id: hq_listing_merchant_id || null,
          hq_listing_class_id: hq_listing_class_id || null,
        };

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
      marketplace_category,
      store_category,
      city_region,
      city_district,
      inventory_merchant_id: inventory_merchant_id || null,
      inventory_class_id: inventory_class_id || null,
      ...hqListingPatch,
    };

    const { error } = await supabase.from("classes").update(row).eq("id", id).eq("merchant_id", merchantId);

    if (error) return { success: false, error: error.message };

    let message: string | undefined = "課程已更新";
    if (hq_listing_bind_token) {
      const sync = await syncListingInventoryFromBindToken(supabase, {
        teacherMerchantId: merchantId,
        teacherClassId: id,
        bindToken: hq_listing_bind_token,
      });
      if (!sync.ok) {
        message = `課程已更新，但總站列表綁定失敗：${sync.error}`;
      } else {
        message = "課程已更新，且已將總站列表課綁定至本課庫存";
      }
    } else if (hq_listing_merchant_id && hq_listing_class_id) {
      const sync = await pushInventoryBindToHqListing(supabase, {
        teacherMerchantId: merchantId,
        teacherClassId: id,
        hqListingMerchantId: hq_listing_merchant_id,
        hqListingClassId: hq_listing_class_id,
      });
      if (!sync.ok) {
        message = `課程已更新，但總站列表綁定失敗：${sync.error}`;
      } else {
        message = "課程已更新，且已將總站列表課綁定至本課庫存";
      }
    }

    if (merchantId) {
      const { backupCourseToIntro } = await import("@/app/actions/courseIntroActions");
      await backupCourseToIntro(merchantId, id, {
        title,
        imageUrl: keepMain,
        galleryUrls: finalGallery,
        introText: courseIntro,
      });
    }
    await revalidateHomepageCoursesListCache();
    revalidatePath(`/course/${id}`);
    return { success: true, message: message ?? "課程已更新" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新課程時發生錯誤";
    return { success: false, error: message };
  }
}

/**
 * 同店全課程精簡欄位（不含 course_intro、gallery_urls、customer_notice 等大欄位）。
 * 供課程預約頁、後台版型預覽等需完整清單處使用。
 */
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
      .select("id, title, price, sale_price, capacity, image_url, sidebar_option, marketplace_category")
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

/**
 * 首頁熱門課程：限制筆數、精簡欄位（嚴格排除 course_intro、gallery_urls 等）。
 */
export async function getCoursesForHomepageLight(
  limit: number = HOMEPAGE_COURSES_FETCH_LIMIT
): Promise<{ success: true; data: CourseForPublic[] } | { success: false; error: string }> {
  try {
    const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
    if (!merchantId) {
      return { success: false, error: "未設定 NEXT_PUBLIC_CLIENT_ID" };
    }
    const cap = Math.max(1, Math.min(limit, 100));
    const { createServerSupabase } = await import("@/lib/supabase/server");
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("classes")
      .select("id, title, price, sale_price, capacity, image_url, sidebar_option, marketplace_category")
      .eq("merchant_id", merchantId)
      .order("id", { ascending: true })
      .limit(cap);
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
