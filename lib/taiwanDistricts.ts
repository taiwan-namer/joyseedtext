import districts from "@/lib/data/taiwan-districts.json";

const map = districts as Record<string, string[]>;

/** 依縣市名稱回傳鄉鎮市區列表（鍵須與 CITY_REGIONS 一致） */
export function getDistrictsForCity(city: string | null | undefined): string[] {
  if (!city) return [];
  const list = map[city];
  return Array.isArray(list) ? [...list] : [];
}
