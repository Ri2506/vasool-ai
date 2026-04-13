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
/**
 * Promissory note (pro-note) — a printable one-pager the borrower can
 * sign at disbursement. Traditional thandal operators take one of these
 * on stamped paper. We generate the text in English + Tamil side by side
 * so the borrower can read whichever they prefer.
 *
 * NOT a legal document — this is a business receipt. The owner is
 * expected to print on ₹10 stamp paper and collect borrower signature
 * + thumb impression + ID photocopy.
 */
export interface PromissoryNoteInput {
  borrowerName: string;
  borrowerPhone: string | null;
  borrowerAddress: string | null;
  principal: number;
  disbursedAmount: number;
  emiAmount: number;
  totalRepayment: number;
  totalInstallments: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  startDate: number;
  endDate: number | null;
  lenderName: string;
  loanId: string;
  guarantorName?: string | null;
  guarantorPhone?: string | null;
}

export function generatePromissoryNoteHtml(input: PromissoryNoteInput): string {
  const freqLabel = {
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'monthly',
  }[input.frequency];
  const freqLabelTamil = {
    daily: 'தினசரி',
    weekly: 'வாரம்',
    monthly: 'மாதம்',
  }[input.frequency];

  const today = new Date(input.startDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const end = input.endDate
    ? new Date(input.endDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : 'When principal returned';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Promissory Note</title>
<style>
  @page { size: A4; margin: 24mm; }
  body { font-family: 'Noto Serif', Georgia, serif; color: #000; line-height: 1.7; font-size: 13.5pt; }
  .title { text-align: center; font-size: 18pt; font-weight: 700; letter-spacing: 1.5pt; margin: 0 0 4pt; text-transform: uppercase; }
  .title-tamil { text-align: center; font-size: 14pt; font-weight: 600; color: #222; margin-bottom: 24pt; }
  .header-meta { display: flex; justify-content: space-between; font-size: 11pt; color: #333; margin-bottom: 18pt; }
  .body p { margin: 10pt 0; text-align: justify; }
  .amt { font-weight: 700; border-bottom: 1px dotted #000; padding: 0 3pt; }
  .terms { border: 1px solid #333; padding: 12pt 16pt; margin: 18pt 0; background: #fafafa; }
  .terms h4 { margin: 0 0 8pt; font-size: 12pt; }
  .terms table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  .terms td { padding: 3pt 6pt; }
  .terms td:first-child { color: #555; width: 40%; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40pt; margin-top: 40pt; }
  .sig-box { border-top: 1px solid #000; padding-top: 6pt; font-size: 11pt; color: #333; text-align: center; }
  .thumb-box { border: 1px dashed #999; height: 60pt; margin-top: 10pt; display: flex; align-items: center; justify-content: center; color: #999; font-size: 9pt; }
  .footer { margin-top: 30pt; font-size: 9pt; color: #888; text-align: center; border-top: 1px solid #ddd; padding-top: 10pt; }
  .stamp-note { font-size: 10pt; font-style: italic; color: #666; text-align: center; margin-bottom: 16pt; }
</style></head>
<body>
  <div class="title">Promissory Note</div>
  <div class="title-tamil">வாக்குறுதி பத்திரம்</div>
  <div class="stamp-note">Print on ₹10 stamp paper · ₹10 முத்திரை காகிதத்தில் அச்சிடவும்</div>

  <div class="header-meta">
    <div><strong>Date:</strong> ${today}</div>
    <div><strong>Loan ID:</strong> ${input.loanId.slice(0, 8).toUpperCase()}</div>
  </div>

  <div class="body">
    <p>
      I, <span class="amt">${input.borrowerName}</span>
      ${input.borrowerPhone ? `(phone ${input.borrowerPhone})` : ''}
      ${input.borrowerAddress ? `resident of ${input.borrowerAddress}` : ''},
      hereby acknowledge having received the sum of
      <span class="amt">₹${input.disbursedAmount.toLocaleString('en-IN')}</span>
      (Rupees ${numberToWords(input.disbursedAmount)} only)
      from <span class="amt">${input.lenderName}</span> on ${today}.
    </p>
    <p>
      நான், <strong>${input.borrowerName}</strong>, ${today} அன்று
      <strong>${input.lenderName}</strong> அவர்களிடமிருந்து ₹${input.disbursedAmount.toLocaleString('en-IN')}
      ரூபாய் பெற்றுள்ளேன் என்று ஒப்புக்கொள்கிறேன்.
    </p>
    <p>
      In return, I promise to pay the lender a total sum of
      <span class="amt">₹${input.totalRepayment.toLocaleString('en-IN')}</span>
      over <span class="amt">${input.totalInstallments}</span> ${freqLabel}
      installments of <span class="amt">₹${input.emiAmount.toLocaleString('en-IN')}</span> each,
      starting ${today} and ending ${end}.
    </p>
    <p>
      இதற்கு பதிலாக, நான் மொத்தம் ₹${input.totalRepayment.toLocaleString('en-IN')} ரூபாயை
      ${freqLabelTamil}ம் ₹${input.emiAmount.toLocaleString('en-IN')} வீதம்
      ${input.totalInstallments} தவணைகளில் செலுத்துவேன்.
    </p>
  </div>

  <div class="terms">
    <h4>Summary of Terms · தவணை விவரம்</h4>
    <table>
      <tr><td>Principal received</td><td><strong>₹${input.disbursedAmount.toLocaleString('en-IN')}</strong></td></tr>
      <tr><td>Total repayment</td><td><strong>₹${input.totalRepayment.toLocaleString('en-IN')}</strong></td></tr>
      <tr><td>Per installment</td><td><strong>₹${input.emiAmount.toLocaleString('en-IN')}</strong></td></tr>
      <tr><td>Frequency</td><td>${freqLabel}</td></tr>
      <tr><td>Total installments</td><td>${input.totalInstallments}</td></tr>
      <tr><td>Start date</td><td>${today}</td></tr>
      <tr><td>End date</td><td>${end}</td></tr>
      ${input.guarantorName ? `<tr><td>Guarantor</td><td>${input.guarantorName}${input.guarantorPhone ? ` (${input.guarantorPhone})` : ''}</td></tr>` : ''}
    </table>
  </div>

  <div class="sig-grid">
    <div>
      <div class="sig-box">Borrower signature · கடன் வாங்கியவர் கையொப்பம்</div>
      <div style="text-align:center; margin-top: 4pt; font-size: 11pt;">${input.borrowerName}</div>
      <div class="thumb-box">Thumb impression / கைரேகை</div>
    </div>
    <div>
      <div class="sig-box">Lender signature · கடன் கொடுத்தவர் கையொப்பம்</div>
      <div style="text-align:center; margin-top: 4pt; font-size: 11pt;">${input.lenderName}</div>
      ${input.guarantorName ? `
        <div class="sig-box" style="margin-top: 30pt;">Guarantor signature · பிணையாளர் கையொப்பம்</div>
        <div style="text-align:center; margin-top: 4pt; font-size: 11pt;">${input.guarantorName}</div>
      ` : ''}
    </div>
  </div>

  <div class="footer">
    VasoolAI · ${new Date().toLocaleDateString('en-IN')} · This note is a business receipt, not a legal instrument.
  </div>
</body></html>`;
}

/**
 * Convert a positive integer (or rounded float) to English words for amounts
 * up to 99,99,99,999 (Indian numbering). Not perfect but good enough for
 * promissory notes. E.g. 12,500 → "Twelve Thousand Five Hundred".
 */
function numberToWords(n: number): string {
  n = Math.round(n);
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number): string => {
    if (x < 20) return ones[x];
    const t = Math.floor(x / 10);
    const o = x % 10;
    return tens[t] + (o ? ' ' + ones[o] : '');
  };
  const three = (x: number): string => {
    if (x < 100) return two(x);
    const h = Math.floor(x / 100);
    const r = x % 100;
    return ones[h] + ' Hundred' + (r ? ' ' + two(r) : '');
  };
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1_000);
  const rest = n % 1_000;
  const parts: string[] = [];
  if (crore) parts.push(three(crore) + ' Crore');
  if (lakh) parts.push(three(lakh) + ' Lakh');
  if (thousand) parts.push(three(thousand) + ' Thousand');
  if (rest) parts.push(three(rest));
  return parts.join(' ').trim();
}

export async function sharePdf(html: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Open the report HTML as a Blob URL in a new tab. Avoids the
    // security-flagged document.write() pattern. The print dialog
    // auto-fires once the iframe loads — same UX as before.
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      // Give the new window a beat to render before printing.
      setTimeout(() => {
        try { win.print(); } catch { /* user can manually print */ }
      }, 600);
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Native fallback: share the HTML as text (expo-print would convert to PDF)
  await Share.share({
    message: `${title}\n\nOpen in browser to print as PDF.`,
    title,
  });
}

// ─── CSV / Excel export ───────────────────────────────────────────────
//
// Excel can open any CSV directly. We build standards-compliant CSV
// (RFC 4180): commas separate, quotes escape, double-quote escapes a
// quote inside a field. UTF-8 BOM is prefixed so Excel renders Tamil
// characters correctly when the file is opened on Windows.

const CSV_BOM = '\uFEFF';

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(headers: string[], rows: (string | number | null)[][]): string {
  const headerLine = headers.map(csvEscape).join(',');
  const bodyLines = rows.map((r) => r.map(csvEscape).join(','));
  return CSV_BOM + [headerLine, ...bodyLines].join('\r\n');
}

export async function shareCsv(csv: string, filename: string): Promise<void> {
  const safe = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safe}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ message: csv, title: `${safe}.csv` });
}

// ─── Report builders ──────────────────────────────────────────────────

export interface OutstandingRowExport {
  borrower_name: string;
  borrower_phone: string | null;
  loan_principal: number;
  total_repayment: number;
  total_paid: number;
  outstanding: number;
  status: string;
}

export function buildOutstandingReport(rows: OutstandingRowExport[], title = 'Outstanding Report'): {
  html: string; csv: string;
} {
  const headers = ['Borrower', 'Phone', 'Principal', 'Total Due', 'Paid', 'Outstanding', 'Status'];
  const csvRows = rows.map((r) => [
    r.borrower_name, r.borrower_phone ?? '',
    r.loan_principal, r.total_repayment, r.total_paid, r.outstanding, r.status,
  ]);
  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const totalPaid = rows.reduce((s, r) => s + r.total_paid, 0);
  const html = generateReportHtml(
    title, headers,
    rows.map((r) => [
      r.borrower_name, r.borrower_phone ?? '—',
      formatRupees(r.loan_principal), formatRupees(r.total_repayment),
      formatRupees(r.total_paid), formatRupees(r.outstanding),
      r.status.toUpperCase(),
    ]),
    `Total outstanding: ${formatRupees(totalOutstanding)} · Total collected to-date: ${formatRupees(totalPaid)} · ${rows.length} loans`,
  );
  return { html, csv: buildCsv(headers, csvRows) };
}

export interface NippuRowExport {
  borrower_name: string;
  borrower_phone: string | null;
  line_name: string | null;
  days_overdue: number;
  amount_overdue: number;
}

export function buildNippuReport(rows: NippuRowExport[], title = 'Overdue / Nippu Report'): {
  html: string; csv: string;
} {
  const headers = ['Borrower', 'Phone', 'Line', 'Days overdue', 'Amount overdue'];
  const csvRows = rows.map((r) => [
    r.borrower_name, r.borrower_phone ?? '', r.line_name ?? '',
    r.days_overdue, r.amount_overdue,
  ]);
  const totalOverdue = rows.reduce((s, r) => s + r.amount_overdue, 0);
  const html = generateReportHtml(
    title, headers,
    rows.map((r) => [
      r.borrower_name, r.borrower_phone ?? '—', r.line_name ?? '—',
      `${r.days_overdue}d`, formatRupees(r.amount_overdue),
    ]),
    `Total overdue: ${formatRupees(totalOverdue)} · ${rows.length} borrowers behind schedule`,
  );
  return { html, csv: buildCsv(headers, csvRows) };
}

export interface PattiRowExport {
  line_name: string;
  borrower_count: number;
  total_due_today: number;
  total_collected_today: number;
  outstanding: number;
  agent_name: string | null;
}

export function buildPattiReport(rows: PattiRowExport[], title = 'Patti Note (Per-Line Status)'): {
  html: string; csv: string;
} {
  const headers = ['Line', 'Agent', 'Borrowers', 'Due Today', 'Collected Today', 'Outstanding'];
  const csvRows = rows.map((r) => [
    r.line_name, r.agent_name ?? '',
    r.borrower_count, r.total_due_today, r.total_collected_today, r.outstanding,
  ]);
  const totalDue = rows.reduce((s, r) => s + r.total_due_today, 0);
  const totalCollected = rows.reduce((s, r) => s + r.total_collected_today, 0);
  const totalOut = rows.reduce((s, r) => s + r.outstanding, 0);
  const html = generateReportHtml(
    title, headers,
    rows.map((r) => [
      r.line_name, r.agent_name ?? 'No agent',
      String(r.borrower_count), formatRupees(r.total_due_today),
      formatRupees(r.total_collected_today), formatRupees(r.outstanding),
    ]),
    `Today: ${formatRupees(totalCollected)} of ${formatRupees(totalDue)} · Total outstanding ${formatRupees(totalOut)}`,
  );
  return { html, csv: buildCsv(headers, csvRows) };
}

export interface DailySummaryRowExport {
  date: number;
  total_collected: number;
  cash_collected: number;
  account_collected: number;
  collection_count: number;
  total_expenses: number;
  loans_disbursed_count: number;
  loans_disbursed_amount: number;
  net_cash_flow: number;
}

export function buildDailySummaryReport(rows: DailySummaryRowExport[], title = 'Daily Summary'): {
  html: string; csv: string;
} {
  const headers = [
    'Date', 'Collected', 'Cash', 'Account', 'Count',
    'Expenses', 'New Loans Count', 'New Loans Amount', 'Net Cash Flow',
  ];
  const csvRows = rows.map((r) => [
    new Date(r.date).toISOString().slice(0, 10),
    r.total_collected, r.cash_collected, r.account_collected,
    r.collection_count, r.total_expenses,
    r.loans_disbursed_count, r.loans_disbursed_amount, r.net_cash_flow,
  ]);
  const totalCollected = rows.reduce((s, r) => s + r.total_collected, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.total_expenses, 0);
  const totalDisbursed = rows.reduce((s, r) => s + r.loans_disbursed_amount, 0);
  const html = generateReportHtml(
    title, headers,
    rows.map((r) => [
      formatDateShort(new Date(r.date)),
      formatRupees(r.total_collected), formatRupees(r.cash_collected),
      formatRupees(r.account_collected), String(r.collection_count),
      formatRupees(r.total_expenses), String(r.loans_disbursed_count),
      formatRupees(r.loans_disbursed_amount), formatRupees(r.net_cash_flow),
    ]),
    `${rows.length} days · Collected ${formatRupees(totalCollected)} · Expenses ${formatRupees(totalExpenses)} · Loans disbursed ${formatRupees(totalDisbursed)}`,
  );
  return { html, csv: buildCsv(headers, csvRows) };
}
