import { redirect } from "next/navigation";

/** 舊「前台設定」已併入基本資料；保留路徑以免書籤失效 */
export default function FrontendSettingsRedirectPage() {
  redirect("/admin/settings");
}
