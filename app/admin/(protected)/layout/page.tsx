"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronUp, ChevronDown, Loader2, Save, Plus, Image as ImageIcon, GripVertical, ExternalLink, Pencil } from "lucide-react";
import {
  getFrontendSettings,
  updateLayoutBlocks,
  uploadLayoutBlockBackground,
} from "@/app/actions/frontendSettingsActions";
import { getCoursesForHomepage } from "@/app/actions/productActions";
import {
  LAYOUT_SECTION_IDS,
  LAYOUT_SECTION_LABELS,
  getDefaultLayoutBlocks,
  type LayoutBlock,
} from "@/app/lib/frontendSettingsShared";
import type { CarouselItem } from "@/app/lib/frontendSettingsShared";
import type { Activity } from "@/app/lib/homeSectionTypes";
import LayoutCanvas from "./LayoutCanvas";

/** 畫布最大寬度（與前台 max-w-7xl 一致） */
const CANVAS_MAX_WIDTH_PX = 1280;

/** 依 block id 對應到「編輯內容」的後台頁面 */
const BLOCK_EDIT_LINKS: Record<string, { href: string; label: string }> = {
  header: { href: "/admin/frontend-settings", label: "前台設定（導覽列）" },
  hero: { href: "/admin/frontend-settings", label: "前台設定（首頁大圖）" },
  hero_carousel: { href: "/admin/frontend-settings", label: "前台設定（輪播）" },
  carousel: { href: "/admin/frontend-settings", label: "前台設定（輪播）" },
  carousel_2: { href: "/admin/frontend-settings", label: "前台設定（輪播）" },
  full_width_image: { href: "/admin/frontend-settings", label: "前台設定（單張大圖）" },
  courses: { href: "/admin", label: "商品管理（課程）" },
  courses_grid: { href: "/admin", label: "商品管理（課程）" },
  courses_list: { href: "/admin", label: "商品管理（課程）" },
  about: { href: "/admin/about", label: "關於我們" },
  faq: { href: "/admin/faq", label: "常見問題" },
  contact: { href: "/admin/settings", label: "基本資料（聯絡資訊）" },
  footer: { href: "/admin/settings", label: "基本資料（店名）" },
};

export default function AdminLayoutPage() {
  const [blocks, setBlocks] = useState<LayoutBlock[]>(getDefaultLayoutBlocks());
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 畫布用資料（與前台一致）
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
  const [aboutContent, setAboutContent] = useState<string | null>(null);
  const [navAboutLabel, setNavAboutLabel] = useState("關於我們");
  const [navCoursesLabel, setNavCoursesLabel] = useState("課程介紹");
  const [navBookingLabel, setNavBookingLabel] = useState("課程預約");
  const [navFaqLabel, setNavFaqLabel] = useState("常見問題");
  const [fullWidthImageUrl, setFullWidthImageUrl] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    Promise.all([getFrontendSettings(), getCoursesForHomepage()])
      .then(([s, coursesRes]) => {
        setBlocks(s.layoutBlocks && s.layoutBlocks.length > 0 ? s.layoutBlocks : getDefaultLayoutBlocks());
        setHeroImageUrl(s.heroImageUrl);
        setCarouselItems(s.carouselItems.length > 0 ? s.carouselItems : [
          { id: "w1", title: "熱門推薦", subtitle: "親子手作體驗", imageUrl: null, visible: true },
          { id: "w2", title: "新課上架", subtitle: "兒童烘焙工作坊", imageUrl: null, visible: true },
          { id: "w3", title: "限時優惠", subtitle: "報名享早鳥價", imageUrl: null, visible: true },
        ]);
        setAboutContent(s.aboutContent ?? null);
        setNavAboutLabel(s.navAboutLabel || "關於我們");
        setNavCoursesLabel(s.navCoursesLabel || "課程介紹");
        setNavBookingLabel(s.navBookingLabel || "課程預約");
        setNavFaqLabel(s.navFaqLabel || "常見問題");
        setFullWidthImageUrl(s.fullWidthImageUrl ?? null);
        if (coursesRes.success && coursesRes.data.length > 0) {
          setActivities(
            coursesRes.data.map((c) => ({
              id: c.id,
              title: c.title,
              price: c.salePrice != null && c.price != null && c.salePrice < c.price ? c.salePrice : c.price ?? 0,
              stock: c.capacity ?? 0,
              imageUrl: c.imageUrl ?? null,
              detailHref: `/course/${c.id}`,
              ageTags: c.sidebarOptionLabels ?? c.ageTags ?? [],
              category: c.marketplace_category?.trim() ? c.marketplace_category : "課程",
            }))
          );
        }
      })
      .catch(() => setBlocks(getDefaultLayoutBlocks()))
      .finally(() => setLoading(false));
  }, []);

  const currentIds = blocks.map((b) => b.id);
  const availableToAdd = LAYOUT_SECTION_IDS.filter((id) => !currentIds.includes(id));

  const addBlock = (sectionId: string) => {
    const nextOrder = blocks.length;
    setBlocks([...blocks, { id: sectionId, order: nextOrder, heightPx: null, backgroundImageUrl: null }]);
    setMessage(null);
  };

  const getBlockIndex = (blockId: string) => blocks.findIndex((b) => b.id === blockId);

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };
  const handleDragLeave = () => setDragOverIndex(null);
  const handleDrop = (toIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(null);
    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (Number.isNaN(fromIndex) || fromIndex === toIndex) return;
    const next = [...blocks];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    setBlocks(next.map((b, i) => ({ ...b, order: i })));
    setMessage(null);
  };
  const handleDragEnd = () => setDragOverIndex(null);

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return;
    if (selectedBlockId === blocks[index]?.id) setSelectedBlockId(null);
    const next = blocks.filter((_, i) => i !== index).map((b, i) => ({ ...b, order: i }));
    setBlocks(next);
    setMessage(null);
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...blocks];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setBlocks(next.map((b, i) => ({ ...b, order: i })));
    setMessage(null);
  };

  const moveDown = (index: number) => {
    if (index >= blocks.length - 1) return;
    const next = [...blocks];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setBlocks(next.map((b, i) => ({ ...b, order: i })));
    setMessage(null);
  };

  const setBlockHeightByIndex = (index: number, heightPx: number | null) => {
    const next = [...blocks];
    next[index] = { ...next[index], heightPx: heightPx && heightPx > 0 ? heightPx : null };
    setBlocks(next);
  };

  const setBlockBackgroundUrlByIndex = (index: number, url: string | null) => {
    const next = [...blocks];
    next[index] = { ...next[index], backgroundImageUrl: url };
    setBlocks(next);
  };

  const onBlockResizeHeight = (blockId: string, heightPx: number | null) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, heightPx: heightPx && heightPx > 0 ? heightPx : null } : b))
    );
  };

  const handleBackgroundUpload = async (file: File) => {
    if (selectedBlockId == null) return;
    const index = getBlockIndex(selectedBlockId);
    if (index < 0) return;
    setUploadingBlockId(selectedBlockId);
    setMessage(null);
    const formData = new FormData();
    formData.set("background_image", file);
    try {
      const result = await uploadLayoutBlockBackground(formData);
      if (result.success) {
        setBlockBackgroundUrlByIndex(index, result.url);
        setMessage({ type: "success", text: "背景圖已上傳至 R2，請按「儲存版面」寫入資料庫" });
      } else {
        setMessage({ type: "error", text: result.error });
      }
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "上傳失敗" });
    } finally {
      setUploadingBlockId(null);
    }
  };

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updateLayoutBlocks(blocks);
      if (result.success) {
        setMessage({ type: "success", text: result.message ?? "已儲存" });
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  };

  const selectedBlock = selectedBlockId ? blocks.find((b) => b.id === selectedBlockId) : null;
  const selectedIndex = selectedBlockId != null ? getBlockIndex(selectedBlockId) : -1;
  const editLink = selectedBlockId ? BLOCK_EDIT_LINKS[selectedBlockId] : null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        載入中…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          返回後台
        </Link>
      </div>

      <h1 className="text-xl font-bold text-gray-900">首頁版面</h1>
      <p className="text-sm text-gray-600 max-w-2xl">
        右側為目前前台的畫面。點選區塊可編輯內容與大小；拖曳區塊底部可調整高度。儲存後套用到前台。
      </p>

      {message && (
        <div
          role="alert"
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 三欄：僅中間可捲動，左右欄固定不隨畫布捲動 */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch lg:h-[calc(100vh-14rem)] lg:min-h-[420px]">
        {/* 左側：可加入的積木 + 目前的積木（不隨中間捲動，固定可見） */}
        <aside className="lg:w-56 shrink-0 flex flex-col gap-4 overflow-y-auto lg:overflow-y-auto lg:max-h-full">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 shrink-0">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">可加入的積木</h2>
            <ul className="space-y-1.5">
              {availableToAdd.length === 0 ? (
                <li className="text-xs text-gray-500">已全部加入</li>
              ) : (
                availableToAdd.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => addBlock(id)}
                      className="w-full flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 hover:bg-amber-50 hover:border-amber-200 transition-colors"
                    >
                      <Plus className="h-4 w-4 shrink-0 text-amber-600" />
                      {LAYOUT_SECTION_LABELS[id] ?? id}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold text-gray-800 mb-3 shrink-0">目前的積木</h2>
            <p className="text-xs text-gray-500 mb-2 shrink-0">拖曳左側 ⋮⋮ 可調整順序</p>
            <ul className="space-y-1 overflow-y-auto flex-1 min-h-0">
              {blocks.map((b, i) => (
                <li
                  key={`${b.id}-${i}`}
                  className={`flex items-center gap-0 rounded-lg border transition-colors ${
                    dragOverIndex === i ? "border-amber-400 bg-amber-50" : "border-transparent"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverIndex(i);
                  }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={handleDrop(i)}
                >
                  <div
                    draggable
                    onDragStart={handleDragStart(i)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 flex-1 min-w-0 py-1.5 pl-2 pr-1 cursor-grab active:cursor-grabbing hover:bg-gray-100 rounded-l-lg ${
                      dragOverIndex === i ? "bg-amber-50" : ""
                    }`}
                    title="拖曳此處以調整順序"
                  >
                    <GripVertical className="h-4 w-4 text-gray-500 shrink-0" aria-hidden />
                    <span className="flex-1 text-sm text-gray-700 truncate">
                      {LAYOUT_SECTION_LABELS[b.id] ?? b.id}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBlock(i)}
                    disabled={blocks.length <= 1}
                    className="p-1.5 rounded-r-lg hover:bg-red-100 text-red-600 disabled:opacity-40 text-xs shrink-0"
                    aria-label="移除"
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* 中間：畫布（僅此區可捲動，左右欄不會跟著跑） */}
        <div className="flex-1 min-w-0 flex flex-col items-center overflow-y-auto overflow-x-hidden">
          <div
            className="w-full rounded-xl border border-gray-200 bg-gray-100 overflow-hidden shadow-lg shrink-0"
            style={{ maxWidth: CANVAS_MAX_WIDTH_PX }}
          >
            <div className="px-3 py-2 bg-gray-200 border-b border-gray-300 text-xs text-gray-600 text-center">
              目前前台畫面 · 點選區塊可編輯 · 拖曳區塊底部可調整高度
            </div>
            <div className="overflow-x-auto">
              <LayoutCanvas
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                onSelectBlock={setSelectedBlockId}
                onBlockResizeHeight={onBlockResizeHeight}
                heroImageUrl={heroImageUrl}
                carouselItems={carouselItems}
                aboutContent={aboutContent}
                navAboutLabel={navAboutLabel}
                navCoursesLabel={navCoursesLabel}
                navBookingLabel={navBookingLabel}
                navFaqLabel={navFaqLabel}
                activities={activities}
                fullWidthImageUrl={fullWidthImageUrl}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 shrink-0 pb-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isPending ? "儲存中…" : "儲存版面"}
            </button>
            <span className="text-sm text-gray-500">儲存後前台首頁將依此版面顯示</span>
          </div>
        </div>

        {/* 右側：編輯此區塊（固定可見，不隨畫布捲動） */}
        <aside className="lg:w-64 shrink-0 overflow-y-auto lg:max-h-full flex flex-col">
          {selectedBlock && selectedIndex >= 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Pencil className="h-4 w-4 text-amber-600" />
                編輯此區塊
              </h2>
              <p className="text-xs text-gray-600">
                {LAYOUT_SECTION_LABELS[selectedBlock.id] ?? selectedBlock.id}
              </p>

              {editLink && (
                <Link
                  href={editLink.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  {editLink.label}
                </Link>
              )}

              <div>
                <p className="text-xs font-medium text-amber-700 mb-1">
                  目前高度: {selectedBlock.heightPx != null && selectedBlock.heightPx > 0 ? `${selectedBlock.heightPx} px` : "自動"}
                </p>
                <label className="block text-xs font-medium text-gray-700 mb-1">區塊高度 (px)</label>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={selectedBlock.heightPx ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setBlockHeightByIndex(selectedIndex, v === "" ? null : parseInt(v, 10));
                  }}
                  placeholder="自動"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">區塊背景圖</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBackgroundUpload(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingBlockId === selectedBlockId}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {uploadingBlockId === selectedBlockId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  {selectedBlock.backgroundImageUrl ? "更換背景圖" : "上傳背景圖"}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
