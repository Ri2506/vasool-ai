// Indian number + currency formatting. Use everywhere. Never show raw numbers.

/**
 * Format a rupee amount using Indian digit grouping (1,00,000 — not 100,000).
 * Always prefixes ₹. No decimals (rupee amounts only per PRD §5.2).
 */
export function formatRupees(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return '₹0';
  const n = Math.round(amount);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n).toString();
  return `${sign}₹${indianGroup(abs)}`;
}

/**
 * Group a non-negative integer string using Indian digit grouping.
 * Last 3 digits, then groups of 2.
 *   12345    → 12,345
 *   123456   → 1,23,456
 *   12345678 → 1,23,45,678
 */
function indianGroup(s: string): string {
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

/**
 * Format a date for display. Defaults to DD MMM (e.g. "05 Apr").
 */
export function formatDateShort(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/**
 * HH:MM display (24-hour).
 */
export function formatTime(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}
