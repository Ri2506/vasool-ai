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
import { DDL, SCHEMA_VERSION } from './schema';

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
  for (const stmt of DDL) {
    await db.execAsync(stmt);
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)`,
    [String(SCHEMA_VERSION)]
  );
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
