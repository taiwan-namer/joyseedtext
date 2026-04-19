import {
  defaultVendorBindingStatusUrl,
  HQ_ADMIN_SESSION_KEY_ENV,
  HQ_VENDOR_BINDING_STATUS_URL_ENV,
} from "@/lib/hqBranchApi";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/** 總站 POST `/api/vendor/branch/vendor-binding-status` 預期 JSON（可擴充）。 */
export type HqVendorBindingStatusPayload = {
  /** 是否已有 line_user_mappings（role vendor）等綁定 */
  has_vendor_mapping?: boolean;
  /** line_user_mappings.vendor_approval_status */
  vendor_approval_status?: "pending" | "approved" | "rejected" | string | null;
  /** 最新一筆 vendor_registration_applications（可為 null） */
  registration_application?: {
    status?: string | null;
    supplement_flags?: unknown;
    admin_review_note?: string | null;
  } | null;
};

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

function statusUrl(): string {
  const override = envTrim(HQ_VENDOR_BINDING_STATUS_URL_ENV);
  if (override) return override;
  return defaultVendorBindingStatusUrl();
}

function parseHqPayload(raw: unknown): HqVendorBindingStatusPayload | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as HqVendorBindingStatusPayload;
}

/**
 * 依總站回傳決定閘道狀態（優先序與後台審核行為一致）：
 * 1. 補件（registration_application.status = supplement_required）
 * 2. 無綁定（has_vendor_mapping = false）
 * 3. 審核拒絕（vendor_approval_status = rejected）
 * 4. 通過（approved）
 * 5. 審核中（pending 等）
 */
export function gateFromHqPayload(p: HqVendorBindingStatusPayload): VendorBindingGate {
  const reg = p.registration_application;
  const regStatus = typeof reg?.status === "string" ? reg.status.trim() : "";

  if (regStatus === "supplement_required") {
    return {
      kind: "supplement_required",
      adminReviewNote: reg?.admin_review_note ?? null,
      supplementFlags: reg?.supplement_flags,
    };
  }

  if (p.has_vendor_mapping === false) {
    return { kind: "no_binding" };
  }

  const vas = p.vendor_approval_status;

  if (vas === "rejected") {
    return { kind: "rejected" };
  }
  if (vas === "approved") {
    return { kind: "ok" };
  }
  if (vas === "pending") {
    return { kind: "pending_review" };
  }
  if (isPendingRegistrationStatus(regStatus)) {
    return { kind: "pending_review" };
  }

  if (p.has_vendor_mapping === true && (vas == null || vas === "")) {
    return { kind: "pending_review" };
  }

  if (vas == null || vas === "") {
    return { kind: "no_binding" };
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

/** 開發／除錯：若設為 1，略過總站查詢並允許進入新增課程（勿用於正式環境）。 */
export function isVendorAddCourseGateDisabled(): boolean {
  return envTrim("DISABLE_VENDOR_GATE_ADD_COURSE") === "1";
}

/**
 * 向總站查詢本分站（NEXT_PUBLIC_CLIENT_ID）之供應商綁定／審核狀態。
 * 僅供 Server 使用（含 admin 頁面、Route Handler）。
 */
export async function resolveVendorBindingGate(): Promise<VendorBindingGate> {
  if (isVendorAddCourseGateDisabled()) {
    return { kind: "ok" };
  }

  const bearer = envTrim(HQ_ADMIN_SESSION_KEY_ENV);
  if (!bearer) {
    return {
      kind: "error",
      message: "分站尚未設定總站授權（HQ_ADMIN_SESSION_KEY），無法查詢審核狀態。",
    };
  }

  const branchSiteMerchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
  if (!branchSiteMerchantId) {
    return { kind: "error", message: "未設定店家代碼（NEXT_PUBLIC_CLIENT_ID）。" };
  }

  const url = statusUrl();
  let pathnameForHint = "";
  try {
    pathnameForHint = new URL(url).pathname;
  } catch {
    pathnameForHint = "";
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ branch_site_merchant_id: branchSiteMerchantId }),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[resolveVendorBindingGate] fetch failed", err);
    return { kind: "error", message: "無法連線至總站，請稍後再試。" };
  }

  /**
   * 僅在 HTTP 404／501 顯示「尚未提供」文案。
   * 常見原因：總站路由與預設不一致（例：實作在別的路徑）、或僅部署了 mint 未部署 status。
   * 若為 405 代表路徑存在但不接受 POST，與本站呼叫方式不一致。
   */
  if (res.status === 405) {
    return {
      kind: "error",
      message: `總站回傳 HTTP 405（路徑：${pathnameForHint || url}）。本站以 POST 呼叫；若總站只實作 GET，請對齊方法或調整總站路由。`,
    };
  }

  if (res.status === 404 || res.status === 501) {
    console.error(
      "[resolveVendorBindingGate] HQ binding-status not found or not implemented",
      res.status,
      url
    );
    return {
      kind: "error",
      message: `總站回傳 HTTP ${res.status}（路徑：${pathnameForHint || url}）。代表此網址在總站上不存在或未實作。請確認總站已部署「綁定狀態」API，且路徑與預設 POST /api/vendor/branch/vendor-binding-status 一致；若總站使用不同路徑，請在分站設定 HQ_VENDOR_BINDING_STATUS_URL 為完整 URL。mint 連線成功不代表此路由已存在。`,
    };
  }

  if (!res.ok) {
    let snippet = "";
    try {
      snippet = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    console.error("[resolveVendorBindingGate] HQ error", res.status, snippet);
    if (res.status === 401) {
      return { kind: "error", message: "總站授權失敗，請聯絡管理員確認 HQ_ADMIN_SESSION_KEY。" };
    }
    return { kind: "error", message: "取得審核狀態失敗，請稍後再試。" };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { kind: "error", message: "總站回應格式異常。" };
  }

  const payload = parseHqPayload(data);
  if (!payload) {
    return { kind: "error", message: "總站回應格式異常。" };
  }

  return gateFromHqPayload(payload);
}

export const vendorRegistrationLinkPath = BRANCH_VENDOR_REGISTRATION_PATH;
