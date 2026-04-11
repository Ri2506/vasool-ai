// PDF generation for reports and loan plans.
// Uses a pure HTML→PDF approach: generates an HTML string, renders it
// in a hidden webview or prints it. On web, uses window.print().
// On native, would use expo-print.

import { Platform, Share } from 'react-native';
import { formatRupees, formatDateShort } from './format';

/**
 * Generate a PDF-friendly HTML string from tabular data.
 */
export function generateReportHtml(
  title: string,
  headers: string[],
  rows: string[][],
  footer?: string
): string {
  const headerRow = headers.map((h) => `<th style="padding:8px;text-align:left;border-bottom:2px solid #059669;color:#047857">${h}</th>`).join('');
  const bodyRows = rows.map((r) =>
    `<tr>${r.map((c) => `<td style="padding:6px 8px;border-bottom:1px solid #eee">${c}</td>`).join('')}</tr>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, Arial, sans-serif; margin: 20px; color: #1a2e23; }
  h1 { color: #059669; font-size: 22px; margin-bottom: 4px; }
  .sub { color: #5f7a6a; font-size: 13px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .footer { margin-top: 20px; font-size: 12px; color: #94a8a0; text-align: center; }
</style></head>
<body>
  <h1>${title}</h1>
  <div class="sub">VasoolAI • ${new Date().toLocaleDateString('en-IN')}</div>
  <table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
  ${footer ? `<div class="footer">${footer}</div>` : ''}
</body></html>`;
}

/**
 * Generate HTML for a loan repayment plan (Thittam).
 *
 * Each plan entry can optionally carry principal/interest portion — when
 * present they are shown as separate columns and totaled in the footer so
 * the owner can see exactly how much of each installment is profit vs
 * capital recovery. Falls back to the old 4-column layout when the
 * portions are missing (legacy calls).
 */
export interface PlanHtmlEntry {
  number: number;
  date: number;
  amount: number;
  status: string;
  principalPortion?: number;
  interestPortion?: number;
}

export function generatePlanHtml(
  borrowerName: string,
  principal: number,
  emiAmount: number,
  plan: Array<PlanHtmlEntry>
): string {
  const hasSplit = plan.some(
    (p) => typeof p.principalPortion === 'number' && typeof p.interestPortion === 'number',
  );

  if (hasSplit) {
    const rows = plan.map((p) => [
      String(p.number),
      formatDateShort(new Date(p.date)),
      formatRupees(p.principalPortion ?? 0),
      formatRupees(p.interestPortion ?? 0),
      formatRupees(p.amount),
      p.status,
    ]);

    const totalPrincipal = plan.reduce((s, p) => s + (p.principalPortion ?? 0), 0);
    const totalInterest = plan.reduce((s, p) => s + (p.interestPortion ?? 0), 0);
    const totalAmount = plan.reduce((s, p) => s + p.amount, 0);

    return generateReportHtml(
      `Repayment Plan \u2014 ${borrowerName}`,
      ['#', 'Date', 'Principal', 'Interest', 'Total', 'Status'],
      rows,
      `Disbursed: ${formatRupees(principal)} \u2022 `
        + `Principal total: ${formatRupees(totalPrincipal)} \u2022 `
        + `Interest total: ${formatRupees(totalInterest)} \u2022 `
        + `Grand total: ${formatRupees(totalAmount)}`,
    );
  }

  // Legacy layout — no split available
  const rows = plan.map((p) => [
    String(p.number),
    formatDateShort(new Date(p.date)),
    formatRupees(p.amount),
    p.status,
  ]);
  return generateReportHtml(
    `Repayment Plan \u2014 ${borrowerName}`,
    ['#', 'Date', 'Amount', 'Status'],
    rows,
    `Principal: ${formatRupees(principal)} \u2022 EMI: ${formatRupees(emiAmount)} \u2022 Total: ${formatRupees(emiAmount * plan.length)}`,
  );
}

/**
 * Open print dialog (web) or share as HTML (native).
 * On web: opens browser print dialog which can "Save as PDF".
 * On native: would use expo-print for actual PDF generation.
 */
export async function sharePdf(html: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
    return;
  }

  // Native fallback: share the HTML as text (expo-print would convert to PDF)
  await Share.share({
    message: `${title}\n\nOpen in browser to print as PDF.`,
    title,
  });
}
