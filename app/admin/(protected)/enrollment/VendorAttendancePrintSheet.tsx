"use client";

import type { RollcallSession, SessionBookingsResult } from "@/app/actions/bookingActions";
import {
  buildAttendanceSheetFromSession,
  formatRollcallSlotDateLabel,
} from "@/lib/buildVendorEnrollmentCsv";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function printHtmlInIframe(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const doPrint = () => {
    const win = iframe.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };

  iframe.onload = () => {
    setTimeout(doPrint, 50);
  };
}

function openPrintWindow(session: RollcallSession, sessionData: SessionBookingsResult) {
  const rows = buildAttendanceSheetFromSession(sessionData);
  const title = session.title ?? "未命名課程";
  const dateLabel = formatRollcallSlotDateLabel(session.slotDate);
  const compactDateLabel = dateLabel.replace(" 週", "週");
  const printedAt = new Date();
  const printedAtText = `${printedAt.getFullYear()}/${String(printedAt.getMonth() + 1).padStart(2, "0")}/${String(
    printedAt.getDate()
  ).padStart(2, "0")} ${String(printedAt.getHours()).padStart(2, "0")}:${String(printedAt.getMinutes()).padStart(2, "0")}`;

  const trs = rows
    .map(
      (r) => `
      <tr>
        <td class="cell-check">□</td>
        <td>${r.seq}</td>
        <td>${escapeHtml(r.kidName)}</td>
        <td>${escapeHtml(r.kidAge)}</td>
        <td>${escapeHtml(r.parentName)}</td>
        <td>${escapeHtml(r.phone)}</td>
        <td>${escapeHtml(r.allergy)}</td>
        <td>${escapeHtml(r.addons)}</td>
        <td>${escapeHtml(r.peace)}</td>
        <td></td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>報到表 - ${escapeHtml(title)}</title>
      <style>
        @page { size: A4 landscape; margin: 11mm; }
        body { font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif; color:#111; font-size: 12px; }
        .brand-title {
          font-size:24px;
          margin:0 0 8px;
          font-weight:800;
          text-align:center;
        }
        .helper {
          font-size:15px;
          margin:0 0 14px;
          color:#333;
          line-height:1.45;
        }
        .meta {
          margin-bottom:10px;
          font-size:26px;
          line-height:1.3;
          font-weight:700;
          white-space: nowrap;
          letter-spacing: -0.6px;
          word-spacing: -2px;
        }
        table { width:100%; border-collapse: collapse; font-size:15px; }
        th, td { border: 1px solid #333; padding: 6px 8px; vertical-align: middle; }
        th { background: #f3f4f6; text-align: left; font-weight:700; }
        .cell-check { text-align:center; width:48px; }
      </style>
    </head>
    <body>
      <h1 class="brand-title">【童趣島 WonderVoyage－官方合作夥伴專屬報到表】</h1>
      <p class="helper">感謝您提供優質的親子體驗！為維護課程品質，請於現場核對以下學員報到狀態。</p>
      <div class="meta">課程名稱：${escapeHtml(title)}　開課日期：${escapeHtml(
    compactDateLabel
  )}　場次時間：${escapeHtml(session.time)}　報名進度：${session.enrolledCount}/${session.capacity}人　列印日期：${escapeHtml(
    printedAtText.slice(0, 10)
  )}</div>
      <table>
        <thead>
          <tr>
            <th style="width:48px;">報到</th>
            <th style="width:52px;">序號</th>
            <th>小朋友暱稱</th>
            <th>年齡</th>
            <th>家長姓名</th>
            <th>電話</th>
            <th>過敏/特殊疾病</th>
            <th>加購選項</th>
            <th style="width:60px;">安心包</th>
            <th style="width:130px;">現場備註/家長簽名</th>
          </tr>
        </thead>
        <tbody>
          ${trs}
        </tbody>
      </table>
    </body>
  </html>`;

  printHtmlInIframe(html);
}

export function VendorAttendancePrintSheet({
  session,
  sessionData,
}: {
  session: RollcallSession;
  sessionData: SessionBookingsResult;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => openPrintWindow(session, sessionData)}
        className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-2 text-sm font-medium hover:bg-gray-50"
      >
        列印報到表
      </button>
      <span className="text-sm font-medium text-red-600">（建議列印橫向）</span>
    </div>
  );
}
