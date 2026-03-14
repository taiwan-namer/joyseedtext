import { cookies } from "next/headers";

export async function verifyAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  const sessionKey = process.env.ADMIN_SESSION_KEY?.trim();

  if (!token || !sessionKey || token !== sessionKey) {
    throw new Error("Unauthorized admin access");
  }
}
