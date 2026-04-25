import { redirect } from "next/navigation";

export default function VendorRegisterEntryPage() {
  redirect("/api/admin/branch/vendor-registration-link");
}
