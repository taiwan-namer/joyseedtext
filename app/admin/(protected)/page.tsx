import AdminProductsPageClient from "./AdminProductsPageClient";
import VendorBindingGatePanel from "@/app/components/admin/VendorBindingGatePanel";
import { resolveVendorBindingGate } from "@/lib/vendorBindingStatus";

export default async function AdminProductsPage() {
  const gate = await resolveVendorBindingGate();

  if (gate.kind !== "ok") {
    return (
      <VendorBindingGatePanel
        gate={gate}
        backHref="/admin/dashboard"
        backLabel="返回 Dashboard"
      />
    );
  }

  return <AdminProductsPageClient />;
}
