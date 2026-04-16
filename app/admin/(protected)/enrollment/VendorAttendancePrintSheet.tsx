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

  const trs = rows
    .map(
      (r) => `
      <tr>
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
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif; color:#111; }
        .meta { margin-bottom: 10px; font-size: 14px; display:flex; gap: 12px; flex-wrap: wrap; }
        h1 { margin: 0 0 8px; font-size: 18px; }
        table { width:100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #999; padding: 6px 8px; vertical-align: top; }
        th { background: #f3f4f6; text-align: left; }
      </style>
    </head>
    <body>
      <h1>課程報到表</h1>
      <div class="meta">
        <span><strong>課程：</strong>${escapeHtml(title)}</span>
        <span><strong>日期：</strong>${escapeHtml(dateLabel)}</span>
        <span><strong>時段：</strong>${escapeHtml(session.time)}</span>
        <span><strong>名額：</strong>${session.capacity}</span>
        <span><strong>已報名：</strong>${session.enrolledCount}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:40px;">序</th>
            <th>小朋友暱稱</th>
            <th>年齡</th>
            <th>家長姓名</th>
            <th>電話</th>
            <th>過敏/特殊疾病</th>
            <th>加購選項</th>
            <th style="width:60px;">安心包</th>
            <th style="width:70px;">簽到</th>
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
