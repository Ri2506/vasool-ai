// Web SQLite adapter — uses sql.js (pure JS SQLite via WASM).
//
// Why: expo-sqlite has no web build in SDK 52 (no .web.* files, no
// "browser" export condition). Metro picks THIS file on web and
// sqlite.ts on native. Both expose the same { openDb, uuid, now } API
// with an expo-sqlite-compatible database handle (execAsync, runAsync,
// getAllAsync, getFirstAsync, withTransactionAsync).
//
// Persistence: the whole DB is serialized to a Uint8Array via
// sqljs.export() on every mutation and saved as base64 in localStorage.
// Sufficient for a dev demo (tens of KB of data). Sprint 3 upgrades to
// IndexedDB via idb-keyval for multi-MB datasets.

import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { DDL, MIGRATIONS, SCHEMA_VERSION } from './schema';

const STORAGE_KEY = 'vasool.sqlite.blob';

// The shape callers use. Matches the subset of expo-sqlite's SQLiteDatabase
// that our repositories actually call.
export interface Db {
  execAsync: (sql: string) => Promise<void>;
  runAsync: (sql: string, params?: unknown[]) => Promise<void>;
  getAllAsync: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  getFirstAsync: <T>(sql: string, params?: unknown[]) => Promise<T | null>;
  withTransactionAsync: (fn: () => Promise<void>) => Promise<void>;
}

let _db: Db | null = null;
let _sqlJs: SqlJsStatic | null = null;
let _handle: SqlJsDatabase | null = null;

async function loadSqlJs(): Promise<SqlJsStatic> {
  if (_sqlJs) return _sqlJs;

  // sql.js's Emscripten loader tries to fetch sql-wasm.wasm from a relative
  // path that doesn't exist under Metro's bundle URL. `locateFile` alone
  // is unreliable (Emscripten's streaming compile path ignores it in some
  // bundlers). We sidestep by fetching the WASM ourselves and passing the
  // bytes via `wasmBinary`, which Emscripten honors unconditionally.
  const wasmUrl = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm';
  const resp = await fetch(wasmUrl);
  if (!resp.ok) throw new Error(`sql.js wasm fetch failed: ${resp.status}`);
  const wasmBinary = await resp.arrayBuffer();

  _sqlJs = await initSqlJs({
    wasmBinary,
    locateFile: (file: string) =>
      `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/${file}`,
  } as any);
  return _sqlJs;
}

function persist(): void {
  if (!_handle) return;
  try {
    const bytes = _handle.export();
    // Base64-encode the binary blob so it fits in localStorage.
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = globalThis.btoa(binary);
    globalThis.localStorage?.setItem(STORAGE_KEY, b64);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[sqlite.web] persist failed', e);
  }
}

function loadExisting(SQL: SqlJsStatic): SqlJsDatabase {
  try {
    const b64 = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!b64) return new SQL.Database();
    const binary = globalThis.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new SQL.Database(bytes);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[sqlite.web] load failed, starting fresh', e);
    return new SQL.Database();
  }
}

function makeDb(handle: SqlJsDatabase): Db {
  const wrap: Db = {
    execAsync: async (sql) => {
      handle.exec(sql);
      persist();
    },
    runAsync: async (sql, params = []) => {
      handle.run(sql, params as any);
      persist();
    },
    getAllAsync: async <T>(sql: string, params: unknown[] = []) => {
      const res = handle.exec(sql, params as any);
      if (res.length === 0) return [] as T[];
      const { columns, values } = res[0];
      return values.map((row) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj as T;
      });
    },
    getFirstAsync: async <T>(sql: string, params: unknown[] = []) => {
      const all = await wrap.getAllAsync<T>(sql, params);
      return all[0] ?? null;
    },
    withTransactionAsync: async (fn) => {
      handle.run('BEGIN TRANSACTION');
      try {
        await fn();
        handle.run('COMMIT');
        persist();
      } catch (err) {
        handle.run('ROLLBACK');
        throw err;
      }
    },
  };
  return wrap;
}

function runSql(handle: SqlJsDatabase, sql: string): void {
  handle.exec(sql);
}

function querySql(handle: SqlJsDatabase, sql: string) {
  return handle.exec(sql);
}

export async function openDb(): Promise<Db> {
  if (_db) return _db;
  const SQL = await loadSqlJs();
  _handle = loadExisting(SQL);
  _db = makeDb(_handle);

  // Run schema DDL. CREATE TABLE IF NOT EXISTS makes this idempotent.
  for (const stmt of DDL) {
    runSql(_handle, stmt);
  }

  // Read stored version from _meta (default 0 for first run).
  let storedVersion = 0;
  try {
    const res = querySql(_handle, `SELECT value FROM _meta WHERE key = 'schema_version'`);
    if (res.length > 0 && res[0].values.length > 0) {
      storedVersion = Number(res[0].values[0][0]);
    }
  } catch {
    // _meta may not exist on first run — default to 0
  }

  // Apply versioned migrations in order. Each ALTER is try/wrapped so
  // "duplicate column" errors from partial prior migrations don't block.
  for (const [versionStr, statements] of Object.entries(MIGRATIONS)) {
    const targetVersion = Number(versionStr);
    if (storedVersion >= targetVersion) continue;
    for (const stmt of statements) {
      try {
        runSql(_handle, stmt);
      } catch (e) {
        const msg = (e as Error)?.message ?? '';
        if (/duplicate column/i.test(msg) || /already exists/i.test(msg)) {
          continue;
        }
        // eslint-disable-next-line no-console
        console.warn(`[sqlite.web/migrate] v${targetVersion} failed:`, msg);
      }
    }
  }

  _handle.run(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)`,
    [String(SCHEMA_VERSION)]
  );

  // Belt-and-suspenders: re-attempt every additive ALTER. Catches any DB
  // where a prior migration partially failed but bumped the version.
  // sql.js raises on duplicate columns, but we silently ignore.
  const safeAlter = (sql: string) => {
    try {
      _handle!.exec(sql);
    } catch {
      // duplicate column / harmless
    }
  };
  safeAlter(`ALTER TABLE collections ADD COLUMN plan_entry_id TEXT`);
  safeAlter(`ALTER TABLE collections ADD COLUMN notes TEXT`);
  safeAlter(`ALTER TABLE collections ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash'`);
  safeAlter(`ALTER TABLE loans ADD COLUMN repayment_type TEXT NOT NULL DEFAULT 'principal_plus_interest'`);
  safeAlter(`ALTER TABLE loans ADD COLUMN interest_type TEXT NOT NULL DEFAULT 'front_loaded'`);
  safeAlter(`ALTER TABLE loans ADD COLUMN interest_rate REAL NOT NULL DEFAULT 0`);
  safeAlter(`ALTER TABLE loans ADD COLUMN disbursed_amount REAL`);
  safeAlter(`ALTER TABLE plan_entries ADD COLUMN principal_portion REAL NOT NULL DEFAULT 0`);
  safeAlter(`ALTER TABLE plan_entries ADD COLUMN interest_portion REAL NOT NULL DEFAULT 0`);
  safeAlter(`ALTER TABLE collections ADD COLUMN gps_mocked INTEGER NOT NULL DEFAULT 0`);
  safeAlter(`ALTER TABLE expenses ADD COLUMN gps_lat REAL`);
  safeAlter(`ALTER TABLE expenses ADD COLUMN gps_lng REAL`);
  safeAlter(`ALTER TABLE expenses ADD COLUMN gps_mocked INTEGER NOT NULL DEFAULT 0`);
  safeAlter(`ALTER TABLE expenses ADD COLUMN photo_uri TEXT`);
  safeAlter(`ALTER TABLE expenses ADD COLUMN photo_url TEXT`);
  safeAlter(`ALTER TABLE expenses ADD COLUMN notes TEXT`);
  safeAlter(`ALTER TABLE organizations ADD COLUMN sms_enabled INTEGER NOT NULL DEFAULT 1`);
  safeAlter(`ALTER TABLE borrowers ADD COLUMN sms_opt_out INTEGER NOT NULL DEFAULT 0`);
  safeAlter(`ALTER TABLE borrowers ADD COLUMN id_number TEXT`);
  safeAlter(`ALTER TABLE borrowers ADD COLUMN id_type TEXT`);
  safeAlter(`ALTER TABLE borrowers ADD COLUMN id_photo_uri TEXT`);

  persist();

  return _db;
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
