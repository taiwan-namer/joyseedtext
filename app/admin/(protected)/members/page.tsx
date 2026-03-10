import { createServerSupabase } from "@/lib/supabase/server";
import { getBookingCountsByMemberEmailForAdmin } from "@/app/actions/bookingActions";
import { DeleteMemberButton } from "./DeleteMemberButton";

function envTrim(key: string): string {
  const raw = process.env[key];
  return typeof raw === "string" ? raw.trim() : "";
}

export default async function AdminMembersPage() {
  const merchantId = envTrim("NEXT_PUBLIC_CLIENT_ID");
  const supabase = createServerSupabase();

  const [membersResult, countResult] = await Promise.all([
    supabase
      .from("members")
      .select("id, name, phone, email, created_at")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false }),
    getBookingCountsByMemberEmailForAdmin(),
  ]);

  const { data: rows, error } = membersResult;
  const bookingCounts = countResult.success ? countResult.data : {} as Record<string, number>;

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-900">B會員功能管理</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          無法載入會員資料：{error.message}
        </div>
      </div>
    );
  }

  const members = (rows ?? []) as {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    created_at: string | null;
  }[];

  function formatDate(iso: string | null): string {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">B會員功能管理</h1>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">目前尚無會員資料</p>
            <p className="text-sm text-gray-500 mt-1">會員註冊後會顯示於此</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">會員姓名</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">電話</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">信箱</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 w-24">報名課程數</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">註冊日期</th>
                  <th className="w-12 py-3 px-4 font-medium text-gray-700 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-gray-900 font-medium">
                      {m.name ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-gray-700">{m.phone ?? "—"}</td>
                    <td className="py-3 px-4 text-gray-700">{m.email ?? "—"}</td>
                    <td className="py-3 px-4 text-gray-700">
                      {bookingCounts[m.email ?? ""] ?? 0}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{formatDate(m.created_at)}</td>
                    <td className="py-3 px-4 text-center">
                      <DeleteMemberButton memberId={m.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
