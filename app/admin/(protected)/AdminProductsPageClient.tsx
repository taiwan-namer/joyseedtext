"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Filter, Plus, Image as ImageIcon, Trash2 } from "lucide-react";
import { getClassesForAdmin, deleteClasses, type ClassRow } from "@/app/actions/productActions";
import { getEnrollmentCountsForAdmin } from "@/app/actions/bookingActions";

export default function AdminProductsPageClient() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setError(null);
      const [classResult, countResult] = await Promise.all([
        getClassesForAdmin(),
        getEnrollmentCountsForAdmin(),
      ]);
      if (cancelled) return;
      if (classResult.success) {
        setClasses(classResult.data);
      } else {
        setError(classResult.error);
      }
      if (countResult.success) {
        setEnrollmentCounts(countResult.data);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
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
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden max-w-4xl">
        <div className="border-b border-gray-100 px-6 py-5">
          <h1 className="text-lg font-semibold text-gray-900">商品管理區 / 產品資訊</h1>
          <p className="mt-1 text-sm text-gray-500">管理課程列表，可篩選、新增、編輯或刪除。</p>
        </div>
      </div>

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
            prefetch
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

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="md:hidden divide-y divide-gray-100">
          {isLoading ? (
            <div className="py-12 px-4 text-center text-gray-500 text-sm">資料載入中...</div>
          ) : error ? (
            <div className="py-12 px-4 text-center text-red-600 text-sm">{error}</div>
          ) : classes.length === 0 ? (
            <div className="py-12 px-4 text-center text-gray-500 text-sm">尚無課程，請點「新增」建立</div>
          ) : (
            filteredClasses.map((item) => (
              <div key={`m-${item.id}`} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <label className="mt-1 shrink-0 inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </label>
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
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/classes/edit/${item.id}`}
                      className="text-amber-700 hover:text-amber-800 font-semibold leading-6 line-clamp-2 block"
                    >
                      {item.title ?? "—"}
                    </Link>
                    <p className="mt-1 text-xs text-gray-500 font-mono">{item.id.slice(0, 8)}…</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="text-gray-500">售價</div>
                  <div className="text-right font-medium text-gray-800">
                    {item.price != null ? item.price : "—"}
                  </div>
                  <div className="text-gray-500">已報名</div>
                  <div className="text-right font-medium text-gray-800">
                    {enrollmentCounts[item.id] ?? 0}
                  </div>
                  <div className="text-gray-500">上下架</div>
                  <div className="text-right text-gray-700">顯示</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
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
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-20">
                  已報名
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 min-w-[180px]" title="是否顯示於首頁輪播／熱門區；說明見同目錄 README-商品管理.md">
                  首頁設定
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 min-w-[120px]" title="數字愈小排序愈前面；說明見同目錄 README-商品管理.md">
                  階層位置
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center text-gray-500">
                    資料載入中...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : classes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 px-4 text-center text-gray-500">
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
