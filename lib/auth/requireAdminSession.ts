import { cookies } from "next/headers";

export async function requireAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  const sessionKey = process.env.ADMIN_SESSION_KEY?.trim();

  if (!token || token !== sessionKey) {
    throw new Error("403 admin only");
  }
}
