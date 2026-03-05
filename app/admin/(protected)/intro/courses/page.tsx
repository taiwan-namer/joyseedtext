"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Filter, Plus, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import {
  getCourseIntroPostsForAdmin,
  deleteCourseIntroPosts,
  createCourseIntroPostManual,
  backfillCourseIntroFromClasses,
  type CourseIntroPost,
} from "@/app/actions/courseIntroActions";

/** 後台課程介紹：來自新增課程自動備份 + 手動新增部落格；僅在此刪除才會從前台消失 */
export default function AdminIntroCoursesPage() {
  const [posts, setPosts] = useState<CourseIntroPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPending, startAddTransition] = useTransition();
  const [backfillPending, setBackfillPending] = useState(false);

  const fetchList = async () => {
    setIsLoading(true);
    setError(null);
    const result = await getCourseIntroPostsForAdmin();
    if (result.success) {
      setPosts(result.data);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchList();
  }, []);

  const filteredPosts = filterText.trim()
    ? posts.filter((p) => p.title.toLowerCase().includes(filterText.trim().toLowerCase()))
    : posts;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredPosts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredPosts.map((p) => p.id)));
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`確定要刪除所選的 ${selectedIds.size} 筆？刪除後將從前台課程介紹消失。`)) return;
    setDeleting(true);
    const result = await deleteCourseIntroPosts(Array.from(selectedIds));
    setDeleting(false);
    if (result.success) {
      setSelectedIds(new Set());
      await fetchList();
      alert(result.message);
    } else {
      alert(result.error);
    }
  };

  const handleBackfill = async () => {
    setBackfillPending(true);
    const result = await backfillCourseIntroFromClasses();
    setBackfillPending(false);
    if (result.success) {
      alert(result.message ?? "已補建");
      await fetchList();
    } else {
      alert(result.error);
    }
  };

  const handleAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startAddTransition(async () => {
      const result = await createCourseIntroPostManual(formData);
      if (result.success) {
        setShowAddForm(false);
        form.reset();
        await fetchList();
      } else {
        alert(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">課程介紹</h1>

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
                <label className="block text-xs font-medium text-gray-600 mb-1">依標題篩選</label>
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="輸入標題"
                  className="w-full px-3 py-2 rounded border border-gray-300 text-sm"
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增部落格
          </button>
          <button
            type="button"
            onClick={handleBackfill}
            disabled={backfillPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {backfillPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            從現有課程補建
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={selectedIds.size === 0 || deleting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-white text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            刪除
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            文章數：{isLoading ? "—" : filteredPosts.length}{filterText ? "（篩選後）" : ""}
          </span>
          <Link
            href="/courses"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            前往前台課程介紹 →
          </Link>
        </div>
      </div>

      {showAddForm && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">新增部落格（僅出現在課程介紹，不影響新增課程）</h2>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">標題 *</label>
              <input name="title" type="text" required className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="文章標題" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">主圖</label>
              <input name="image_main" type="file" accept="image/*" className="text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">課程簡介 / 內文</label>
              <textarea name="intro_text" rows={4} className="w-full max-w-2xl rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="簡介或內文…" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={addPending} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60">
                {addPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {addPending ? "新增中…" : "儲存"}
              </button>
              <button type="button" onClick={() => setShowAddForm(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-24">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={filteredPosts.length > 0 && selectedIds.size === filteredPosts.length}
                      onChange={toggleSelectAll}
                    />
                    ID
                  </label>
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-24">圖片</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 min-w-[200px]">標題</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-24">來源</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 px-4 text-center text-gray-500">資料載入中...</td>
                </tr>
              ) : error ? (
                <>
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-red-600">{error}</td>
                  </tr>
                  {/course_intro_posts|schema cache/i.test(error) && (
                    <tr>
                      <td colSpan={5} className="py-4 px-4 text-center">
                        <p className="text-sm text-gray-700 mb-2">請先在 Supabase 建立課程介紹資料表：</p>
                        <p className="text-xs text-gray-600">
                          到 Supabase Dashboard → SQL Editor，貼上並執行專案根目錄的{" "}
                          <code className="bg-gray-100 px-1 rounded">SUPABASE_COURSE_INTRO_TABLE.sql</code>。
                        </p>
                        <p className="text-xs text-amber-700 mt-2">建表完成後重新整理此頁，再點「從現有課程補建」即可。</p>
                      </td>
                    </tr>
                  )}
                </>
              ) : filteredPosts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 px-4 text-center text-gray-500">
                    {posts.length === 0 ? "尚無文章。新增課程會自動備份至此，或點「新增部落格」手動新增。" : "篩選後無結果"}
                  </td>
                </tr>
              ) : (
                filteredPosts.map((post) => (
                  <tr key={post.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedIds.has(post.id)}
                          onChange={() => toggleSelect(post.id)}
                        />
                        <span className="text-gray-900 font-mono text-xs">{post.id.slice(0, 8)}…</span>
                      </label>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                        {post.image_url ? (
                          <img src={post.image_url} alt="" className="w-full h-full object-cover" width={64} height={64} />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-gray-900 line-clamp-2">{post.title || "—"}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={post.source === "course" ? "text-amber-600" : "text-gray-600"}>
                        {post.source === "course" ? "備份" : "手動"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {post.course_id ? (
                        <Link href={`/admin/classes/edit/${post.course_id}`} className="text-amber-600 hover:text-amber-700 text-sm">
                          編輯課程
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
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
