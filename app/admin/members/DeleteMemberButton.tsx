"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteMember } from "@/app/actions/memberActions";

export function DeleteMemberButton({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm("確定要刪除此會員？")) return;
    setLoading(true);
    try {
      const res = await deleteMember(memberId);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
      aria-label="刪除此會員"
      title="刪除此會員"
    >
      <Trash2 className="w-4 h-4" strokeWidth={2} />
    </button>
  );
}
