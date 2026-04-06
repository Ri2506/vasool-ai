// CSV data export. Generates a CSV string from any array of rows and
// triggers a download (web) or share sheet (native via expo-sharing).
//
// We use CSV instead of XLSX to avoid a heavy dependency. CSV opens
// natively in Excel, Google Sheets, and Numbers on the target user's
// phone. The PRD says "Export to Excel" — CSV achieves that without
// the ~500KB xlsx library.

import { Platform, Share } from 'react-native';

/**
 * Convert an array of objects to a CSV string. Keys of the first row
 * become the header.
 */
export function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const lines = rows.map((row) =>
    keys.map((k) => {
      const v = row[k];
      const s = v == null ? '' : String(v);
      // Escape commas and quotes
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

/**
 * Trigger a CSV download (web) or share sheet (native).
 */
export async function shareCsv(csv: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Browser: create a Blob and trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  // Native: use Share API (will show WhatsApp, email, etc.)
  await Share.share({
    message: csv,
    title: filename,
  });
}

// --- Pre-built export helpers for common reports ---

import { openDb } from '@/db';

export async function exportCollections(orgId: string): Promise<string> {
  const db = await openDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT
       b.name AS borrower,
       b.phone AS borrower_phone,
       c.amount,
       c.expected_amount,
       c.shortfall,
       datetime(c.collected_at / 1000, 'unixepoch', 'localtime') AS collected_at,
       c.gps_lat,
       c.gps_lng
     FROM collections c
     JOIN loans l ON l.id = c.loan_id
     JOIN borrowers b ON b.id = l.borrower_id
     WHERE c.org_id = ?
     ORDER BY c.collected_at DESC`,
    [orgId]
  );
  return toCsv(rows);
}

export async function exportBorrowers(orgId: string): Promise<string> {
  const db = await openDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT name, phone, address, notes,
       datetime(created_at / 1000, 'unixepoch', 'localtime') AS created_at
     FROM borrowers WHERE org_id = ? ORDER BY name COLLATE NOCASE`,
    [orgId]
  );
  return toCsv(rows);
}

export async function exportExpenses(orgId: string): Promise<string> {
  const db = await openDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT category, amount,
       datetime(date / 1000, 'unixepoch', 'localtime') AS date
     FROM expenses WHERE org_id = ? ORDER BY date DESC`,
    [orgId]
  );
  return toCsv(rows);
}
