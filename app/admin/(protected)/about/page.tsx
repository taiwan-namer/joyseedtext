"use client";

import { useEffect, useState, useTransition, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Bold, Italic, Underline, Link as LinkIcon, Image, Code } from "lucide-react";
import { getAboutPageData, updateAboutPage, uploadAboutPageContentImage } from "@/app/actions/frontendSettingsActions";

export default function AboutPage() {
  const router = useRouter();
  const [navAboutLabel, setNavAboutLabel] = useState("關於我們");
  const [aboutContent, setAboutContent] = useState("");
  const aboutEditorRef = useRef<HTMLDivElement>(null);
  const aboutImageFileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [aboutImageUploading, setAboutImageUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeFontSize, setCodeFontSize] = useState(14);

  useEffect(() => {
    if (aboutContent !== undefined && aboutEditorRef.current && aboutEditorRef.current.innerHTML !== aboutContent) {
      aboutEditorRef.current.innerHTML = aboutContent;
    }
  }, [aboutContent]);

  const execEditorCommand = useCallback((command: string, value?: string) => {
    aboutEditorRef.current?.focus();
    document.execCommand(command, false, value ?? "");
  }, []);

  const insertImageHtml = useCallback(
    (url: string) => {
      const safe = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      execEditorCommand(
        "insertHTML",
        `<img src="${safe}" alt="" style="max-width:100%;height:auto;" />`
      );
    },
    [execEditorCommand]
  );

  const insertImageFromUrl = useCallback(() => {
    const url = window.prompt("請輸入圖片網址：");
    if (url?.trim()) insertImageHtml(url.trim());
  }, [insertImageHtml]);

  const onAboutImageFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !file.type.startsWith("image/")) {
        if (file) setMessage({ type: "error", text: "請選擇圖片檔案" });
        return;
      }
      setAboutImageUploading(true);
      setMessage(null);
      try {
        const fd = new FormData();
        fd.set("about_content_image", file);
        const result = await uploadAboutPageContentImage(fd);
        if (result.success) {
          insertImageHtml(result.url);
        } else {
          setMessage({ type: "error", text: result.error });
        }
      } catch (err) {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "上傳失敗" });
      } finally {
        setAboutImageUploading(false);
      }
    },
    [insertImageHtml]
  );

  const insertLink = useCallback(() => {
    const url = window.prompt("請輸入連結網址：");
    if (url?.trim()) {
      execEditorCommand("createLink", url.trim());
    }
  }, [execEditorCommand]);

  /** 將程式碼繪製到 Canvas 並回傳 PNG data URL */
  const codeToImageDataUrl = useCallback((code: string, fontSize: number): string => {
    const lineHeight = Math.round(fontSize * 1.5);
    const padding = 20;
    const fontFamily = "Consolas, Monaco, 'Courier New', monospace";
    const lines = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (lines.length === 0) lines.push("");

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.font = `${fontSize}px ${fontFamily}`;
    let maxW = 0;
    for (const line of lines) {
      const text = line || " ";
      const m = ctx.measureText(text);
      const w = m.width;
      if (w > maxW) maxW = w;
    }
    const canvasWidth = Math.min(Math.ceil(maxW) + padding * 2, 800);
    const canvasHeight = lines.length * lineHeight + padding * 2;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = "#d4d4d4";
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = "top";
    lines.forEach((line, i) => {
      ctx.fillText(line || " ", padding, padding + i * lineHeight);
    });
    return canvas.toDataURL("image/png");
  }, []);

  const insertCodeAsImage = useCallback(() => {
    if (!codeInput.trim()) return;
    const dataUrl = codeToImageDataUrl(codeInput.trim(), codeFontSize);
    if (dataUrl) {
      execEditorCommand("insertHTML", `<img src="${dataUrl}" alt="程式碼" style="max-width:100%;height:auto;border-radius:6px;" />`);
      setCodeInput("");
      setCodeModalOpen(false);
    }
  }, [codeInput, codeFontSize, codeToImageDataUrl, execEditorCommand]);

  useEffect(() => {
    getAboutPageData()
      .then((data) => {
        setNavAboutLabel(data.navAboutLabel ?? "關於我們");
        setAboutContent(data.aboutContent ?? "");
      })
      .catch((err) => {
        setMessage({ type: "error", text: err?.message ?? "無法載入" });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData();
    formData.set("nav_about_label", navAboutLabel);
    formData.set("about_content", aboutEditorRef.current?.innerHTML ?? aboutContent ?? "");
    startTransition(async () => {
      const result = await updateAboutPage(formData);
      if (result.success) {
        setMessage({ type: "success", text: result.message ?? "已儲存" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        載入中…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href="/admin"
          className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="h-4 w-4" />
          返回後台
        </Link>
      </div>
      <h1 className="text-xl font-bold text-gray-900">關於我們</h1>
      <p className="text-sm text-gray-600">
        設定首頁導覽列「關於我們」文字與區塊內容，可插入圖片、超連結與調整字型。
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
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

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">導覽列文字</label>
            <p className="mb-2 text-xs text-gray-500">顯示於前台右上角「關於我們」連結文字</p>
            <input
              type="text"
              name="nav_about_label"
              value={navAboutLabel}
              onChange={(e) => setNavAboutLabel(e.target.value)}
              placeholder="關於我們"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              disabled={isPending}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">關於我們內容</label>
            <p className="mb-2 text-xs text-gray-500">
              首頁點「關於我們」後顯示的區塊。插入圖片請優先使用「上傳圖片」（會存至 R2 並以公開網址顯示於前台）；亦可改用「網址」手動填入外部圖片連結。
            </p>
            <input
              ref={aboutImageFileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={onAboutImageFileChange}
            />
            <div className="rounded-lg border border-gray-300 bg-white overflow-hidden">
              <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
                <button type="button" onClick={() => execEditorCommand("bold")} className="p-2 rounded hover:bg-gray-200" title="粗體">
                  <Bold className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => execEditorCommand("italic")} className="p-2 rounded hover:bg-gray-200" title="斜體">
                  <Italic className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => execEditorCommand("underline")} className="p-2 rounded hover:bg-gray-200" title="底線">
                  <Underline className="w-4 h-4" />
                </button>
                <span className="w-px h-6 bg-gray-300 mx-0.5" />
                <button type="button" onClick={insertLink} className="p-2 rounded hover:bg-gray-200" title="插入超連結">
                  <LinkIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => aboutImageFileRef.current?.click()}
                  disabled={aboutImageUploading || isPending}
                  className="p-2 rounded hover:bg-gray-200 disabled:opacity-50"
                  title="上傳圖片至雲端並插入（R2）"
                >
                  <Image className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={insertImageFromUrl}
                  disabled={aboutImageUploading || isPending}
                  className="px-2 py-1.5 text-xs font-medium text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50"
                  title="改以圖片網址插入"
                >
                  網址
                </button>
                {aboutImageUploading ? (
                  <span className="text-xs text-amber-700 flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    上傳中…
                  </span>
                ) : null}
                <button type="button" onClick={() => setCodeModalOpen(true)} className="p-2 rounded hover:bg-gray-200" title="程式碼轉圖片">
                  <Code className="w-4 h-4" />
                </button>
                <span className="w-px h-6 bg-gray-300 mx-0.5" />
                <select
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) execEditorCommand("fontSize", v);
                  }}
                  title="字型大小"
                >
                  <option value="">字型大小</option>
                  <option value="1">小</option>
                  <option value="2">一般</option>
                  <option value="3">中</option>
                  <option value="4">大</option>
                  <option value="5">特大</option>
                </select>
              </div>
              <div
                ref={aboutEditorRef}
                contentEditable
                className="min-h-[200px] max-h-[400px] overflow-y-auto p-4 text-sm text-gray-900 focus:outline-none prose prose-sm max-w-none"
                data-placeholder="在此輸入關於我們的內容"
                suppressContentEditableWarning
              />
            </div>
          </div>
        </section>

        {/* 程式碼轉圖片彈窗 */}
        {codeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="code-modal-title">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 id="code-modal-title" className="text-lg font-semibold text-gray-900">程式碼轉圖片</h2>
                <button type="button" onClick={() => { setCodeModalOpen(false); setCodeInput(""); }} className="p-2 rounded hover:bg-gray-100 text-gray-500" aria-label="關閉">×</button>
              </div>
              <div className="p-4 space-y-3 flex-1 min-h-0 overflow-auto">
                <p className="text-sm text-gray-600">貼上或輸入程式碼，將轉成圖片並插入編輯區（深色背景、等寬字型）。</p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">字型大小</label>
                  <select value={codeFontSize} onChange={(e) => setCodeFontSize(Number(e.target.value))} className="rounded border border-gray-300 px-2 py-1 text-sm">
                    <option value={12}>12px</option>
                    <option value={14}>14px</option>
                    <option value={16}>16px</option>
                    <option value={18}>18px</option>
                  </select>
                </div>
                <textarea
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="在此貼上或輸入程式碼..."
                  className="w-full h-48 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  spellCheck={false}
                />
              </div>
              <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
                <button type="button" onClick={() => { setCodeModalOpen(false); setCodeInput(""); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                  取消
                </button>
                <button type="button" onClick={insertCodeAsImage} disabled={!codeInput.trim()} className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded-lg">
                  產生圖片並插入
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-white hover:bg-amber-600 disabled:opacity-60"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isPending ? "儲存中…" : "儲存"}
          </button>
        </div>
      </form>
    </div>
  );
}
