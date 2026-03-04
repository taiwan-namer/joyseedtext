"use client";

import { Filter, Plus, Pencil, Image as ImageIcon } from "lucide-react";

export default function AdminProductsPage() {
  return (
    <div className="space-y-6">
      {/* 頁面標題 */}
      <h1 className="text-xl font-bold text-gray-900">
        F商品管理區 / 產品資訊
      </h1>

      {/* 工具列 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            篩選工具
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            編輯
          </button>
          <span className="text-sm text-gray-500 ml-2">
            排序由小到大呈現
          </span>
        </div>
        <div className="text-sm text-gray-600">商品數：1</div>
      </div>

      {/* 表格區 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700 w-24">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
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
                <th className="text-left py-3 px-4 font-medium text-gray-700 min-w-[220px]">
                  首頁設定
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 min-w-[180px]">
                  階層位置
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                <td className="py-3 px-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="text-gray-900">14</span>
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
                  <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-6 h-6 text-gray-400" />
                  </div>
                </td>
                <td className="py-3 px-4">
                  <p className="text-gray-900 line-clamp-2">
                    【0~6歲】幼兒自由探索 三小時托嬰中心等級遊戲空間X親子同樂X小小孩社交刺激
                  </p>
                </td>
                <td className="py-3 px-4 text-gray-700">
                  <p>0-700</p>
                  <p>0-800</p>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="home-14" defaultChecked className="text-amber-500" />
                      <span className="text-sm text-gray-700">新上架課程</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="home-14" className="text-amber-500" />
                      <span className="text-sm text-gray-700">熱門體驗</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="home-14" className="text-amber-500" />
                      <span className="text-sm text-gray-700">精選課程</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="home-14" className="text-amber-500" />
                      <span className="text-sm text-gray-700">好評推薦</span>
                    </label>
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-600">
                  藝術花園 &gt; 學齡前 0-3歲
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
