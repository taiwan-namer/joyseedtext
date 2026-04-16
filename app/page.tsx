import { getFrontendSettings } from "./actions/frontendSettingsActions";
import { getCoursesForHomepageLight } from "./actions/productActions";
import HomePageClient from "./HomePageClient";

/**
 * 首頁：伺服端並行載入前台設定與精簡課程列表，再交 client 渲染互動區塊。
 */
export default async function WonderVoyageHomePage() {
  const [settings, coursesRes] = await Promise.all([
    getFrontendSettings(),
    getCoursesForHomepageLight(),
  ]);

  return (
    <HomePageClient
      settings={settings}
      homeCourses={coursesRes.success ? coursesRes.data : []}
      homeCoursesError={coursesRes.success ? null : coursesRes.error}
    />
  );
}
