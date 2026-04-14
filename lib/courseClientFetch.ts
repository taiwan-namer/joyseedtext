/** 客戶端載入課程：避免 Server Action 長時間無回應導致永遠「載入中」 */
const COURSE_FETCH_TIMEOUT_MS = 30_000;

export function withCourseFetchTimeout<T>(p: Promise<T>): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), COURSE_FETCH_TIMEOUT_MS)),
  ]);
}
