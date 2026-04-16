import {
  getCurrentMemberEmail,
  getCurrentMemberName,
  getMyBookings,
} from "@/app/actions/bookingActions";
import { getStoreSettings } from "@/app/actions/storeSettingsActions";
import MemberDashboardClient from "./MemberDashboardClient";
import MemberGuestPanel from "./MemberGuestPanel";

/**
 * 會員中心：已登入者由伺服端並行載入訂單與稱呼，首屏即顯示（避免 client 連續等待登入判斷與訂單 fetch）。
 */
export default async function MemberPage() {
  const [email, store] = await Promise.all([getCurrentMemberEmail(), getStoreSettings()]);

  if (!email) {
    return <MemberGuestPanel siteName={store.siteName} />;
  }

  const [bookingsRes, memberName] = await Promise.all([getMyBookings(), getCurrentMemberName()]);

  return (
    <MemberDashboardClient
      siteName={store.siteName}
      initialBookings={bookingsRes.success ? bookingsRes.data : []}
      initialLoadError={bookingsRes.success ? null : bookingsRes.error}
      initialMemberName={memberName}
    />
  );
}
