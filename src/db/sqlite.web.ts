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
import { DDL, SCHEMA_VERSION } from './schema';

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

export async function openDb(): Promise<Db> {
  if (_db) return _db;
  const SQL = await loadSqlJs();
  _handle = loadExisting(SQL);
  _db = makeDb(_handle);

  // Run schema DDL. CREATE TABLE IF NOT EXISTS makes this idempotent.
  for (const stmt of DDL) {
    _handle.exec(stmt);
  }
  _handle.run(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)`,
    [String(SCHEMA_VERSION)]
  );
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
