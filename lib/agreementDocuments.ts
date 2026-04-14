/**
 * 同意書型錄（會員類／供應商類）：後台方格、前台路徑、儲存 key 共用。
 * slug 對應 store_settings.frontend_settings.agreementDocumentsBySlug[slug]
 */

export type AgreementGroup = "member" | "supplier";

export type AgreementCatalogItem = {
  slug: string;
  /**
   * 僅作後備；實際顯示名稱以後台「顯示名稱」欄（agreementDocumentLabelsBySlug）為準。
   * 預設留空，未自訂時介面顯示 slug，避免程式預寫錯誤的法律用語。
   */
  label: string;
  group: AgreementGroup;
  /** 後台方格「範例」縮圖（public 路徑） */
  previewSrc: string;
};

/** 會員類 */
const MEMBER_PREV = "/agreement-previews/member.svg";
/** 供應商類 */
const SUPPLIER_PREV = "/agreement-previews/supplier.svg";

export const AGREEMENT_DOCUMENTS: AgreementCatalogItem[] = [
  { slug: "member-membership", label: "", group: "member", previewSrc: MEMBER_PREV },
  { slug: "member-terms-of-use", label: "", group: "member", previewSrc: MEMBER_PREV },
  { slug: "member-points-discount", label: "", group: "member", previewSrc: MEMBER_PREV },
  { slug: "member-coupon", label: "", group: "member", previewSrc: MEMBER_PREV },
  { slug: "member-shopping", label: "", group: "member", previewSrc: MEMBER_PREV },
  { slug: "member-other-info", label: "", group: "member", previewSrc: MEMBER_PREV },
  { slug: "member-privacy", label: "", group: "member", previewSrc: MEMBER_PREV },
  { slug: "member-registration-flow", label: "", group: "member", previewSrc: MEMBER_PREV },
  { slug: "member-score-inquiry", label: "", group: "member", previewSrc: MEMBER_PREV },
  { slug: "member-registration-notes", label: "", group: "member", previewSrc: MEMBER_PREV },
  { slug: "member-peace-addon", label: "", group: "member", previewSrc: MEMBER_PREV },
  { slug: "supplier-platform-terms", label: "", group: "supplier", previewSrc: SUPPLIER_PREV },
  { slug: "supplier-child-safety", label: "", group: "supplier", previewSrc: SUPPLIER_PREV },
  { slug: "supplier-image-license", label: "", group: "supplier", previewSrc: SUPPLIER_PREV },
  { slug: "supplier-privacy", label: "", group: "supplier", previewSrc: SUPPLIER_PREV },
  { slug: "supplier-cancel-change", label: "", group: "supplier", previewSrc: SUPPLIER_PREV },
  { slug: "supplier-commission-payout", label: "", group: "supplier", previewSrc: SUPPLIER_PREV },
];

const SLUG_SET = new Set(AGREEMENT_DOCUMENTS.map((d) => d.slug));

export function isValidAgreementSlug(slug: string): boolean {
  return typeof slug === "string" && SLUG_SET.has(slug.trim());
}

export function getAgreementCatalogItem(slug: string): AgreementCatalogItem | undefined {
  return AGREEMENT_DOCUMENTS.find((d) => d.slug === slug);
}

/** 後台／前台顯示名稱：自訂優先，其次型錄 label，再退回 slug */
export function resolveAgreementDisplayLabel(
  slug: string,
  customBySlug?: Record<string, string> | null
): string {
  const custom = customBySlug?.[slug]?.trim();
  if (custom) return custom;
  const meta = getAgreementCatalogItem(slug);
  const fallback = meta?.label?.trim();
  if (fallback) return fallback;
  return slug;
}

export function parseAgreementLabelsFromRaw(raw: Record<string, unknown>): Record<string, string> {
  const v = raw.agreementDocumentLabelsBySlug ?? raw.agreement_document_labels_by_slug;
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = k.trim();
    if (!key || typeof val !== "string") continue;
    out[key] = val;
  }
  return out;
}

export function parseAgreementDocumentsFromRaw(raw: Record<string, unknown>): Record<string, string> {
  const v = raw.agreementDocumentsBySlug ?? raw.agreement_documents_by_slug;
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = k.trim();
    if (!key || typeof val !== "string") continue;
    out[key] = val;
  }
  return out;
}
