// Backup + restore for the local SQLite database.
//
// "Phone broke" is the #1 anxiety for thandal operators considering
// digitisation. We give them a simple shareable JSON dump of every table
// that they can email to themselves, save to Drive, or hand to support.
//
// Restore takes the same JSON and overwrites the local DB. Idempotent —
// running restore twice with the same file produces the same state.
//
// NOT a substitute for the cloud sync layer (which preserves multi-device
// merges). This is a "snapshot" model — best for periodic manual backups.

import { openDb } from '@/db';

// Whitelist tables we know how to round-trip. Order matters for restore:
// children depend on parents (loans → plan_entries, etc.).
const BACKUP_TABLES = [
  'organizations',
  'users',
  'borrowers',
  'lines',
  'loans',
  'plan_entries',
  'collections',
  'expenses',
  'investments',
  'guarantors',
  'deposits',
  'principal_returns',
  'handovers',
  'loan_requests',
  'sms_queue',
  'line_agent_assignments',
  'notifications',
  'referrals',
] as const;

export interface BackupBundle {
  format: 'vasool-ai-backup-v1';
  exported_at: number;
  org_id: string;
  schema_version: number;
  tables: Record<string, Record<string, unknown>[]>;
}

export async function exportBackup(orgId: string): Promise<BackupBundle> {
  const db = await openDb();
  const tables: Record<string, Record<string, unknown>[]> = {};

  // Try each table; gracefully skip any that don't exist on this device
  // (e.g. an older legacy DB missing the latest tables).
  for (const tbl of BACKUP_TABLES) {
    try {
      // Most of our tables have org_id; a few (notifications, referrals)
      // also have it. Filter so the backup contains only this org's data.
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM ${tbl} WHERE org_id = ?`,
        [orgId],
      );
      tables[tbl] = rows;
    } catch {
      // Table missing or no org_id column — skip rather than fail the whole backup.
      tables[tbl] = [];
    }
  }

  // Schema version from _meta if present
  let schemaVersion = 0;
  try {
    const meta = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM _meta WHERE key = 'schema_version'`,
    );
    schemaVersion = Number(meta?.value ?? 0);
  } catch { /* ignore */ }

  return {
    format: 'vasool-ai-backup-v1',
    exported_at: Date.now(),
    org_id: orgId,
    schema_version: schemaVersion,
    tables,
  };
}

export interface RestoreReport {
  inserted: Record<string, number>;
  skipped: Record<string, string>;
  totalInserted: number;
}

/**
 * Restore from a previously-exported bundle. INSERT OR REPLACE is used so
 * existing rows with matching id are overwritten. Foreign-key inserts
 * happen in dependency order (driven by BACKUP_TABLES).
 *
 * Caller responsibility: confirm with the user before calling — this
 * mutates the local DB and there is no undo.
 */
export async function restoreBackup(bundle: BackupBundle): Promise<RestoreReport> {
  if (bundle.format !== 'vasool-ai-backup-v1') {
    throw new Error('Unrecognised backup format');
  }
  const db = await openDb();
  const inserted: Record<string, number> = {};
  const skipped: Record<string, string> = {};
  let totalInserted = 0;

  await db.withTransactionAsync(async () => {
    for (const tbl of BACKUP_TABLES) {
      const rows = bundle.tables[tbl] ?? [];
      if (rows.length === 0) { inserted[tbl] = 0; continue; }
      try {
        let count = 0;
        for (const row of rows) {
          const cols = Object.keys(row);
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => '?').join(',');
          const values = cols.map((c) => (row as Record<string, unknown>)[c] as
            string | number | null);
          await db.runAsync(
            `INSERT OR REPLACE INTO ${tbl} (${cols.join(',')}) VALUES (${placeholders})`,
            values as (string | number | null)[],
          );
          count++;
        }
        inserted[tbl] = count;
        totalInserted += count;
      } catch (e) {
        skipped[tbl] = (e as Error)?.message ?? 'unknown error';
      }
    }
  });

  return { inserted, skipped, totalInserted };
}
