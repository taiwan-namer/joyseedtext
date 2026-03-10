"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Filter, Plus, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import { getClassesForAdmin, deleteClasses, updateCourseCapacity, type ClassRow } from "@/app/actions/productActions";
import { getEnrollmentCountsForAdmin } from "@/app/actions/bookingActions";

/** 名額欄：可編輯數字，失焦或 Enter 時儲存 */
function CapacityCell({
  capacity,
  isUpdating,
  onUpdate,
}: {
  id: string;
  capacity: number | null;
  isUpdating: boolean;
  onUpdate: (value: number) => Promise<void>;
}) {
  const [value, setValue] = useState<string>(capacity != null ? String(capacity) : "");
  useEffect(() => {
    setValue(capacity != null ? String(capacity) : "");
  }, [capacity]);

  const commit = () => {
    const n = parseInt(value.trim(), 10);
    if (Number.isInteger(n) && n >= 1) {
      if (n !== (capacity ?? 0)) onUpdate(n);
    } else {
      setValue(capacity != null ? String(capacity) : "");
    }
  };

  return (
    <div className="flex items-center gap-1 w-20">
      {isUpdating ? (
        <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
      ) : null}
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="w-14 py-1 px-2 rounded border border-gray-300 text-center text-sm text-gray-900"
      />
    </div>
  );
}

export default function AdminProductsPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingCapacityId, setUpdatingCapacityId] = useState<string | null>(null);
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<string, number>>({});

  const fetchList = async () => {
    setIsLoading(true);
    setError(null);
    const [classResult, countResult] = await Promise.all([
      getClassesForAdmin(),
      getEnrollmentCountsForAdmin(),
    ]);
    if (classResult.success) {
      setClasses(classResult.data);
    } else {
      setError(classResult.error);
    }
    if (countResult.success) {
      setEnrollmentCounts(countResult.data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchList();
  }, []);

  const filteredClasses = filterText.trim()
    ? classes.filter((c) => (c.title ?? "").toLowerCase().includes(filterText.trim().toLowerCase()))
    : classes;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredClasses.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredClasses.map((c) => c.id)));
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`確定要刪除所選的 ${selectedIds.size} 筆課程嗎？`)) return;
    setDeleting(true);
    const result = await deleteClasses(Array.from(selectedIds));
    setDeleting(false);
    if (result.success) {
      setSelectedIds(new Set());
      await fetchList();
      alert(result.message);
    } else {
      alert(result.error);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">
        F商品管理區 / 產品資訊
      </h1>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                filterOpen ? "border-amber-500 bg-amber-50 text-amber-800" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Filter className="w-4 h-4" />
              篩選工具
            </button>
            {filterOpen && (
              <div className="absolute top-full left-0 mt-1 p-3 bg-white rounded-lg border border-gray-200 shadow-lg z-10 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">依名稱篩選</label>
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="輸入課程名稱"
                  className="w-full px-3 py-2 rounded border border-gray-300 text-sm"
                />
              </div>
            )}
          </div>
          <Link
            href="/admin/classes/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={selectedIds.size === 0 || deleting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-white text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            刪除
          </button>
          <span className="text-sm text-gray-500 ml-2">
            排序由小到大呈現
          </span>
        </div>
        <div className="text-sm text-gray-600">商品數：{isLoading ? "—" : filteredClasses.length}{filterText ? `（篩選後）` : ""}</div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-24">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={filteredClasses.length > 0 && selectedIds.size === filteredClasses.length}
                      onChange={toggleSelectAll}
                    />
                    商品ID
                  </label>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-24">
                  上下架
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-20">
                  排序
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-24">
                  圖片
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 min-w-[200px]">
                  名稱
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-28">
                  售價
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-24">
                  名額
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-20">
                  已報名
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 min-w-[220px]">
                  首頁設定
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 min-w-[180px]">
                  階層位置
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 px-4 text-center text-gray-500">
                    資料載入中...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} className="py-12 px-4 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : classes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 px-4 text-center text-gray-500">
                    尚無課程，請點「新增」建立
                  </td>
                </tr>
              ) : (
                filteredClasses.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                        <span className="text-gray-900 font-mono text-xs">{item.id.slice(0, 8)}…</span>
                      </label>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">顯示</span>
                        <input
                          type="number"
                          defaultValue={0}
                          className="w-14 py-1 px-2 rounded border border-gray-200 text-center text-sm"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">—</td>
                    <td className="py-3 px-4">
                      <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                            width={64}
                            height={64}
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/classes/edit/${item.id}`}
                        className="text-amber-600 hover:text-amber-700 font-medium line-clamp-2 block"
                      >
                        {item.title ?? "—"}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {item.price != null ? item.price : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <CapacityCell
                        id={item.id}
                        capacity={item.capacity}
                        isUpdating={updatingCapacityId === item.id}
                        onUpdate={async (value) => {
                          setUpdatingCapacityId(item.id);
                          const result = await updateCourseCapacity(item.id, value);
                          setUpdatingCapacityId(null);
                          if (result.success) {
                            setClasses((prev) =>
                              prev.map((c) => (c.id === item.id ? { ...c, capacity: value } : c))
                            );
                          } else {
                            alert(result.error);
                          }
                        }}
                      />
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {enrollmentCounts[item.id] ?? 0}
                    </td>
                    <td className="py-3 px-4 text-gray-500">—</td>
                    <td className="py-3 px-4 text-gray-600">—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
