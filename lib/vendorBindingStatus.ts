import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export type VendorBindingGate =
  | { kind: "ok" }
  | { kind: "no_binding" }
  | { kind: "pending_review" }
  | { kind: "rejected" }
  | {
      kind: "supplement_required";
      adminReviewNote?: string | null;
      supplementFlags?: unknown;
    }
  | { kind: "error"; message: string };

const BRANCH_VENDOR_REGISTRATION_PATH = "/api/admin/branch/vendor-registration-link";

type MappingRow = { vendor_approval_status: string | null };
type RegistrationRow = {
  status: string | null;
  supplement_flags?: unknown;
  admin_review_note?: string | null;
  line_uid?: string | null;
};

/**
 * 由 `line_user_mappings` + `vendor_registration_applications` 列推導閘道狀態。
 * 優先序：補件 → 無任何綁定／申請 → mapping.rejected → mapping.approved → 其餘審核中。
 */
export function gateFromSupabaseRows(args: {
  mapping: MappingRow | null;
  registration: RegistrationRow | null;
}): VendorBindingGate {
  const reg = args.registration;
  const regStatus = typeof reg?.status === "string" ? reg.status.trim() : "";

  if (regStatus === "supplement_required") {
    return {
      kind: "supplement_required",
      adminReviewNote: reg?.admin_review_note ?? null,
      supplementFlags: reg?.supplement_flags,
    };
  }

  const vas =
    typeof args.mapping?.vendor_approval_status === "string"
      ? args.mapping.vendor_approval_status.trim()
      : args.mapping?.vendor_approval_status === null
        ? ""
        : "";

  if (!args.mapping && !reg) {
    return { kind: "no_binding" };
  }

  if (vas === "rejected") {
    return { kind: "rejected" };
  }
  if (vas === "approved") {
    return { kind: "ok" };
  }
  if (vas === "pending") {
    return { kind: "pending_review" };
  }

  if (!args.mapping && reg) {
    return { kind: "pending_review" };
  }

  if (args.mapping && (vas === "" || vas == null)) {
    return { kind: "pending_review" };
  }

  if (isPendingRegistrationStatus(regStatus)) {
    return { kind: "pending_review" };
  }

  return { kind: "pending_review" };
}

function isPendingRegistrationStatus(status: string): boolean {
  if (!status) return false;
  return (
    status === "pending" ||
    status === "submitted" ||
    status === "under_review" ||
    status === "reviewing"
  );
}

async function loadLatestRegistration(
  branchSiteMerchantId: string
): Promise<RegistrationRow | null> {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("vendor_registration_applications")
    .select("status, supplement_flags, admin_review_note, line_uid")
    .eq("branch_site_merchant_id", branchSiteMerchantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data as RegistrationRow | null;
}

async function loadVendorMapping(
  branchSiteMerchantId: string,
  lineUidFromRegistration: string | null | undefined
): Promise<MappingRow | null> {
  const supabase = createServerSupabase();

  const { data: byBranch, error: errBranch } = await supabase
    .from("line_user_mappings")
    .select("vendor_approval_status")
    .eq("branch_site_merchant_id", branchSiteMerchantId)
    .eq("role_type", "vendor")
    .maybeSingle();

  if (errBranch) {
    throw errBranch;
  }
  if (byBranch) {
    return byBranch as MappingRow;
  }

  const lineUid = typeof lineUidFromRegistration === "string" ? lineUidFromRegistration.trim() : "";
  if (!lineUid) {
    return null;
  }

  const { data: byLine, error: errLine } = await supabase
    .from("line_user_mappings")
    .select("vendor_approval_status")
    .eq("line_uid", lineUid)
    .eq("role_type", "vendor")
    .maybeSingle();

  if (errLine) {
    throw errLine;
  }
  return byLine as MappingRow | null;
}

function isSchemaError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const msg = String((err as { message?: string })?.message ?? err);
  if (code === "42P01" || code === "42703") return true;
  return /relation .* does not exist|schema cache|column .* does not exist/i.test(msg);
}

/** Node undici／網路層連 Supabase 逾時或中斷（與業務邏輯無關，多為暫時性）。 */
function isTransientSupabaseNetworkError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err);
  const details = String((err as { details?: string })?.details ?? "");
  const cause = String((err as { cause?: unknown })?.cause ?? "");
  const combined = `${msg}\n${details}\n${cause}`;
  return /ConnectTimeout|UND_ERR_CONNECT_TIMEOUT|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(
    combined
  );
}

/** 開發／除錯：若設為 1，略過閘道並允許進入商品管理／新增課程（勿用於正式環境）。 */
export function isVendorAddCourseGateDisabled(): boolean {
  return envTrim("DISABLE_VENDOR_GATE_ADD_COURSE") === "1";
}

/**
 * 自 Supabase 讀取本分站（NEXT_PUBLIC_CLIENT_ID）之供應商綁定／審核狀態。
 * 資料表：`line_user_mappings`、`vendor_registration_applications`（與總站後台審核一致）。
 *
 * 使用短 TTL 快取：後台側欄同時預載多個路由時，會重複呼叫本函式；快取可減輕對 Supabase 的突發連線與逾時。
 */
export async function resolveVendorBindingGate(): Promise<VendorBindingGate> {
  if (isVendorAddCourseGateDisabled()) {
    return { kind: "ok" };
  }

  const branchSiteMerchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
  if (!branchSiteMerchantId) {
    return { kind: "error", message: "未設定店家代碼（NEXT_PUBLIC_CLIENT_ID）。" };
  }

  const cachedLoad = unstable_cache(
    async () => {
      const registration = await loadLatestRegistration(branchSiteMerchantId);
      const mapping = await loadVendorMapping(branchSiteMerchantId, registration?.line_uid);
      return gateFromSupabaseRows({ mapping, registration });
    },
    ["vendor-binding-gate", branchSiteMerchantId],
    { revalidate: 60 }
  );

  try {
    return await cachedLoad();
  } catch (err) {
    console.error("[resolveVendorBindingGate] supabase", err);
    if (isSchemaError(err)) {
      return {
        kind: "error",
        message:
          "無法讀取 line_user_mappings／vendor_registration_applications（表或欄位不存在）。請在 Supabase 執行專案 migration：20260419120000_vendor_binding_line_user_and_registration.sql，或與總站資料表結構對齊（需含 branch_site_merchant_id、vendor_approval_status、status 等欄位）。",
      };
    }
    if (isTransientSupabaseNetworkError(err)) {
      return {
        kind: "error",
        message:
          "與 Supabase 連線逾時或中斷（多為暫時性）。請重新整理頁面；若短時間內頻繁發生，請至 Supabase／Vercel 狀態頁確認服務是否正常。",
      };
    }
    return { kind: "error", message: "無法讀取供應商審核狀態，請稍後再試。" };
  }
}

export const vendorRegistrationLinkPath = BRANCH_VENDOR_REGISTRATION_PATH;
