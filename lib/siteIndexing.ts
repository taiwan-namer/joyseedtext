/**
 * 是否允許搜尋引擎索引（正式網才開）。
 *
 * - 強制關閉：`ALLOW_INDEXING=false`（或 `0`）
 * - 強制開啟：`ALLOW_INDEXING=true`（或 `1`）— 自架正式站請設此值
 * - Vercel：`VERCEL_ENV === "production"` 時允許（預覽／開發部署不索引）
 * - 其餘：`NODE_ENV !== "production"` 不索引；同為 production build 但未符合以上者，預設不索引（需 `ALLOW_INDEXING=true`）
 */
export function isIndexingAllowed(): boolean {
  const raw = process.env.ALLOW_INDEXING?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  if (raw === "true" || raw === "1" || raw === "yes") return true;

  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return true;
  if (vercelEnv === "preview" || vercelEnv === "development") return false;

  if (process.env.NODE_ENV !== "production") return false;

  return false;
}
