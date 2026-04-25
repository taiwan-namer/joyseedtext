import { createServerSupabase } from "@/lib/supabase/server";
import { resolveVendorBindingGate } from "@/lib/vendorBindingStatus";
import VendorLoginEntryClient from "@/app/vendor/VendorLoginEntryClient";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export default async function VendorLoginPage() {
  const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
  const gate = await resolveVendorBindingGate();
  let hasStoreProfile = false;
  let initialSiteName = "";

  if (merchantId) {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("store_settings")
      .select("merchant_id, site_name")
      .eq("merchant_id", merchantId)
      .maybeSingle();
    hasStoreProfile = Boolean(data?.merchant_id);
    initialSiteName = typeof data?.site_name === "string" ? data.site_name : "";
  }

  return (
    <VendorLoginEntryClient
      merchantId={merchantId || "(未設定)"}
      hasStoreProfile={hasStoreProfile}
      initialSiteName={initialSiteName}
      gate={gate}
    />
  );
}
