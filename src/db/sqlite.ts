// Native SQLite adapter — uses expo-sqlite.
//
// Metro platform resolution:
//   - Native (iOS/Android) loads THIS file.
//   - Web loads sqlite.web.ts instead (sql.js WASM fallback) because
//     expo-sqlite has no web build in SDK 52.
//
// Both files export the same shape: { openDb, uuid, now } where the
// database handle supports execAsync / runAsync / getAllAsync /
// getFirstAsync / withTransactionAsync — the expo-sqlite subset we rely on.

import * as SQLite from 'expo-sqlite';
import { DDL, MIGRATIONS, SCHEMA_VERSION } from './schema';

export type Db = SQLite.SQLiteDatabase;

let _db: Db | null = null;

export async function openDb(): Promise<Db> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('vasool.db');
  await migrate(_db);
  return _db;
}

async function migrate(db: Db): Promise<void> {
  try {
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA foreign_keys = ON;');
  } catch {
    // ignore
  }

  // Create all tables (idempotent — IF NOT EXISTS). This covers fresh installs.
  for (const stmt of DDL) {
    await db.execAsync(stmt);
  }

  // Read the stored version. Default to 0 if first run (no row yet).
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'schema_version'`
  );
  const storedVersion = row ? Number(row.value) : 0;

  // Run each migration whose target version is greater than what's stored.
  // Each ALTER is wrapped in try/catch so "duplicate column" from a partial
  // prior migration does not block the rest.
  for (const [versionStr, statements] of Object.entries(MIGRATIONS)) {
    const targetVersion = Number(versionStr);
    if (storedVersion >= targetVersion) continue;
    for (const stmt of statements) {
      try {
        await db.execAsync(stmt);
      } catch (e) {
        const msg = (e as Error)?.message ?? '';
        if (/duplicate column/i.test(msg) || /already exists/i.test(msg)) {
          // column already present — safe to skip
          continue;
        }
        // eslint-disable-next-line no-console
        console.warn(`[db/migrate] statement failed (v${targetVersion}):`, msg);
      }
    }
  }

  // Persist the current version.
  await db.runAsync(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)`,
    [String(SCHEMA_VERSION)]
  );

  // Belt-and-suspenders: ensure latest schema columns exist even if a
  // prior migration silently failed but bumped the version. ALTER is
  // wrapped in try/catch so "duplicate column" is a safe no-op.
  await ensureColumns(db);
}

/**
 * Idempotently ensure every column the current code relies on exists.
 * Runs every openDb() — adds about 5ms and prevents "no such column"
 * errors on databases where a prior migration partially failed.
 */
async function ensureColumns(db: Db): Promise<void> {
  const safeAlter = async (sql: string) => {
    try {
      await db.execAsync(sql);
    } catch {
      // duplicate column / table missing — both safe to ignore here
    }
  };
  await safeAlter(`ALTER TABLE collections ADD COLUMN plan_entry_id TEXT`);
  await safeAlter(`ALTER TABLE collections ADD COLUMN notes TEXT`);
  await safeAlter(`ALTER TABLE collections ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash'`);
  await safeAlter(`ALTER TABLE loans ADD COLUMN repayment_type TEXT NOT NULL DEFAULT 'principal_plus_interest'`);
  await safeAlter(`ALTER TABLE loans ADD COLUMN interest_type TEXT NOT NULL DEFAULT 'front_loaded'`);
  await safeAlter(`ALTER TABLE loans ADD COLUMN interest_rate REAL NOT NULL DEFAULT 0`);
  await safeAlter(`ALTER TABLE loans ADD COLUMN disbursed_amount REAL`);
  await safeAlter(`ALTER TABLE plan_entries ADD COLUMN principal_portion REAL NOT NULL DEFAULT 0`);
  await safeAlter(`ALTER TABLE plan_entries ADD COLUMN interest_portion REAL NOT NULL DEFAULT 0`);
  // v8 — GPS trust + photo evidence
  await safeAlter(`ALTER TABLE collections ADD COLUMN gps_mocked INTEGER NOT NULL DEFAULT 0`);
  await safeAlter(`ALTER TABLE expenses ADD COLUMN gps_lat REAL`);
  await safeAlter(`ALTER TABLE expenses ADD COLUMN gps_lng REAL`);
  await safeAlter(`ALTER TABLE expenses ADD COLUMN gps_mocked INTEGER NOT NULL DEFAULT 0`);
  await safeAlter(`ALTER TABLE expenses ADD COLUMN photo_uri TEXT`);
  await safeAlter(`ALTER TABLE expenses ADD COLUMN photo_url TEXT`);
  await safeAlter(`ALTER TABLE expenses ADD COLUMN notes TEXT`);
  // v9 — SMS prefs + KYC
  await safeAlter(`ALTER TABLE organizations ADD COLUMN sms_enabled INTEGER NOT NULL DEFAULT 1`);
  await safeAlter(`ALTER TABLE borrowers ADD COLUMN sms_opt_out INTEGER NOT NULL DEFAULT 0`);
  await safeAlter(`ALTER TABLE borrowers ADD COLUMN id_number TEXT`);
  await safeAlter(`ALTER TABLE borrowers ADD COLUMN id_type TEXT`);
  await safeAlter(`ALTER TABLE borrowers ADD COLUMN id_photo_uri TEXT`);
}

export function uuid(): string {
  const bytes = new Uint8Array(16);
  const g = (globalThis as any).crypto;
  if (g?.getRandomValues) {
    g.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function now(): number {
  return Date.now();
}
