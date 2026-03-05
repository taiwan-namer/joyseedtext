"use client";

import React, { useState, useTransition } from "react";
import { createClass } from "@/app/actions/productActions";
import { Loader2 } from "lucide-react";

export default function CreateClassForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await createClass(formData);
      if (result.success) {
        setSuccess(result.message ?? "課程已新增");
        setFileName(null);
        const form = document.getElementById("create-class-form") as HTMLFormElement;
        form?.reset();
      } else {
        setError(result.error);
      }
    });
  };

  const formClassName = "max-w-lg rounded-xl border border-gray-200 bg-white shadow-sm";

  return React.createElement(
    "form",
    {
      id: "create-class-form",
      action: handleSubmit,
      className: formClassName,
    },
    React.createElement("div", { className: "border-b border-gray-100 px-6 py-5" },
      React.createElement("h2", { className: "text-lg font-semibold text-gray-900" }, "新增課程商品"),
      React.createElement("p", { className: "mt-1 text-sm text-gray-500" }, "填寫課程資訊並上傳圖片，儲存後將寫入 Supabase。")
    ),
    React.createElement("div", { className: "space-y-5 p-6" },
      error && React.createElement("div", { role: "alert", className: "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" }, error),
      success && React.createElement("div", { role: "status", className: "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" }, success),
      React.createElement("div", null,
        React.createElement("label", { htmlFor: "title", className: "mb-1.5 block text-sm font-medium text-gray-700" }, "課程名稱"),
        React.createElement("input", {
          id: "title",
          name: "title",
          type: "text",
          required: true,
          maxLength: 200,
          placeholder: "請輸入課程名稱",
          className: "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-50 disabled:text-gray-500",
          disabled: isPending,
        })
      ),
      React.createElement("div", { className: "grid grid-cols-2 gap-4" },
        React.createElement("div", null,
          React.createElement("label", { htmlFor: "price", className: "mb-1.5 block text-sm font-medium text-gray-700" }, "售價"),
          React.createElement("input", {
            id: "price",
            name: "price",
            type: "number",
            required: true,
            min: 0,
            step: 1,
            placeholder: "0",
            className: "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-50 disabled:text-gray-500",
            disabled: isPending,
          })
        ),
        React.createElement("div", null,
          React.createElement("label", { htmlFor: "capacity", className: "mb-1.5 block text-sm font-medium text-gray-700" }, "名額"),
          React.createElement("input", {
            id: "capacity",
            name: "capacity",
            type: "number",
            required: true,
            min: 1,
            step: 1,
            placeholder: "10",
            className: "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-50 disabled:text-gray-500",
            disabled: isPending,
          })
        )
      ),
      React.createElement("div", null,
        React.createElement("label", { htmlFor: "image_file", className: "mb-1.5 block text-sm font-medium text-gray-700" }, "課程圖片"),
        React.createElement("div", {
          className: `relative rounded-lg border-2 border-dashed px-4 py-6 transition ${fileName ? "border-indigo-200 bg-indigo-50/50" : "border-gray-200 bg-gray-50/50 hover:border-gray-300"}`,
        },
          React.createElement("input", {
            id: "image_file",
            name: "image_file",
            type: "file",
            accept: "image/*",
            required: true,
            className: "absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed",
            disabled: isPending,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFileName(e.target.files?.[0]?.name ?? null),
          }),
          React.createElement("div", { className: "pointer-events-none text-center" },
            fileName
              ? React.createElement(React.Fragment, null,
                  React.createElement("p", { className: "text-sm font-medium text-gray-900" }, fileName),
                  React.createElement("p", { className: "mt-0.5 text-xs text-gray-500" }, "點擊可更換檔案")
                )
              : React.createElement(React.Fragment, null,
                  React.createElement("p", { className: "text-sm text-gray-600" }, "點擊或拖曳上傳圖片"),
                  React.createElement("p", { className: "mt-0.5 text-xs text-gray-500" }, "JPEG、PNG、GIF、WebP，單檔最大 10 MB")
                )
          )
        )
      ),
      React.createElement("button", {
        type: "submit",
        disabled: isPending,
        className: "flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed",
      },
        isPending
          ? React.createElement(React.Fragment, null,
              React.createElement(Loader2, { className: "h-5 w-5 animate-spin", "aria-hidden": true }),
              React.createElement("span", null, "上傳中...")
            )
          : "送出新增課程"
      )
    )
  );
}
