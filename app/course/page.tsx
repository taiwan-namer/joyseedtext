import { redirect } from "next/navigation";

// 舊網址 /course 導向汪汪隊課程詳情，其餘課程請用 /course/1, /course/2, ...
export default function CoursePage() {
  redirect("/course/5");
}
