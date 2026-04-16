import { getCoursesForListpage } from "@/app/actions/productActions";
import { getGlobalCategoriesFromMain } from "@/app/actions/storeSettingsActions";
import { COURSES_LIST_PAGE_SIZE, dedupeCategoryList } from "@/lib/constants";
import CoursesListClient from "./CoursesListClient";
import {
  getSearchParam,
  parseOptionalAge,
  parsePositiveInt,
} from "./listSearchParams";

/**
 * 課程列表：伺服端依 URL 查詢載入資料，首屏即含列表（避免進頁後 client 再 fetch）。
 */
export default async function CoursesListPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const page = parsePositiveInt(getSearchParam(searchParams, "page"), 1);
  const category = getSearchParam(searchParams, "category");
  const searchQuery = getSearchParam(searchParams, "searchQuery");
  const startDate = getSearchParam(searchParams, "startDate");
  const endDate = getSearchParam(searchParams, "endDate");
  const minAge = getSearchParam(searchParams, "minAge");
  const maxAge = getSearchParam(searchParams, "maxAge");

  const [listRes, rawCategories] = await Promise.all([
    getCoursesForListpage({
      page,
      pageSize: COURSES_LIST_PAGE_SIZE,
      category: category || undefined,
      searchQuery: searchQuery || undefined,
      startDate: startDate || null,
      endDate: endDate || null,
      minAge: parseOptionalAge(minAge),
      maxAge: parseOptionalAge(maxAge),
    }),
    getGlobalCategoriesFromMain(),
  ]);

  const remoteCategoryOptions = dedupeCategoryList(
    Array.isArray(rawCategories) ? rawCategories : []
  );

  return (
    <CoursesListClient
      courses={listRes.success ? listRes.data : []}
      total={listRes.success ? listRes.total : 0}
      listError={listRes.success ? null : listRes.error}
      remoteCategoryOptions={remoteCategoryOptions}
      page={page}
      category={category}
      searchQuery={searchQuery}
      startDate={startDate}
      endDate={endDate}
      minAge={minAge}
      maxAge={maxAge}
    />
  );
}
