/**
 * 後台／會員中心：可見訂單 = 庫存擁有者為本商家，或經由本商家網站售出（總站代銷）。
 * 用於 Supabase .or() filter。
 */
export function bookingsVisibleToMerchantOrFilter(merchantId: string): string {
  return `merchant_id.eq.${merchantId},sold_via_merchant_id.eq.${merchantId}`;
}
