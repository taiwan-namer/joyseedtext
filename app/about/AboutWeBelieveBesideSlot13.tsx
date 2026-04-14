"use client";

/**
 * 關於頁：裝飾圖編號 13 左側時，此段落在右欄（見 .about-believe-beside-slot-13）。
 * 若後台內文仍含相同「我們相信」段落，請刪除其一以免重複。
 */
export default function AboutWeBelieveBesideSlot13() {
  return (
    <div className="home-rich-text about-page-rich-text about-believe-beside-slot-13 w-full min-w-0">
      <p>我們相信</p>
      <p className="mt-4">童趣島的每一堂課，不只是活動，而是一場心靈的冒險</p>
      <p className="mt-4">每一位孩子，都是探索世界的小旅人；</p>
      <p className="mt-4">每一位家長，都是陪伴成長的導航者</p>
      <p className="mt-4">一起在童趣島-玩出快樂，學出能力，成就未來的自己</p>
    </div>
  );
}
