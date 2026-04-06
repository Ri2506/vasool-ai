// Supabase ↔ local SQLite two-way sync.
//
// Push: collect all rows with dirty=1, send to the `sync` Edge Function.
// Pull: receive rows changed since lastPulledAt, upsert locally.
// After successful push, flip dirty → 0.

import { openDb } from '@/db';
import { supabase } from '@/lib/supabase';
import { secureStorage } from '@/lib/secureStorage';

const LAST_PULL_KEY = 'vasool.sync.lastPulledAt';

const TABLES = [
  'organizations', 'users', 'borrowers', 'lines', 'loans',
  'plan_entries', 'collections', 'expenses', 'investments', 'notifications',
] as const;

// Column lists per table for upsert — must match local schema.
// We read them dynamically from the first row to stay DRY.

export async function sync(): Promise<{ pushed: number; pulled: number }> {
  const db = await openDb();
  let pushed = 0;
  let pulled = 0;

  // --- Collect dirty rows to push ---
  const changes: Record<string, { created: unknown[]; updated: unknown[]; deleted: string[] }> = {};

  for (const table of TABLES) {
    const dirtyRows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE dirty = 1`
    );
    if (dirtyRows.length === 0) continue;

    // Convert epoch ms back to ISO for date/timestamp columns on the server
    const created = dirtyRows.map((row) => {
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'dirty') continue;
        if (k === 'server_id') continue;
        cleaned[k] = v;
      }
      return cleaned;
    });

    changes[table] = { created, updated: [], deleted: [] };
    pushed += dirtyRows.length;
  }

  // --- Call sync Edge Function ---
  const lastPulledAt = await secureStorage.getItem(LAST_PULL_KEY);

  const { data, error } = await supabase.functions.invoke('sync', {
    body: {
      lastPulledAt: lastPulledAt ? Number(lastPulledAt) : null,
      changes,
    },
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[sync] Edge Function error:', error);
    return { pushed: 0, pulled: 0 };
  }

  // --- Mark pushed rows as clean ---
  for (const table of TABLES) {
    if (!changes[table]) continue;
    await db.runAsync(`UPDATE ${table} SET dirty = 0 WHERE dirty = 1`);
  }

  // --- Pull: upsert remote changes locally ---
  const pullChanges = data?.changes ?? {};

  for (const table of TABLES) {
    const tableData = pullChanges[table];
    if (!tableData) continue;

    const allRows = [...(tableData.created ?? []), ...(tableData.updated ?? [])];
    for (const row of allRows) {
      if (!row.id) continue;
      // Check if row exists locally
      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM ${table} WHERE id = ?`,
        [row.id]
      );

      if (existing) {
        // Skip if local row is dirty (local changes take priority)
        const local = await db.getFirstAsync<{ dirty: number }>(
          `SELECT dirty FROM ${table} WHERE id = ?`,
          [row.id]
        );
        if (local?.dirty === 1) continue;
      }

      // Upsert: build dynamic INSERT OR REPLACE
      const keys = Object.keys(row).filter((k) => k !== 'updated_at');
      keys.push('server_id');
      const placeholders = keys.map(() => '?').join(', ');
      const values = keys.map((k) => {
        if (k === 'server_id') return row.id;
        if (k === 'dirty') return 0;
        return row[k] ?? null;
      });

      try {
        await db.runAsync(
          `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}, dirty)
           VALUES (${placeholders}, 0)`,
          values
        );
        pulled++;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`[sync] upsert ${table} failed:`, e);
      }
    }
  }

  // Save pull timestamp
  if (data?.timestamp) {
    await secureStorage.setItem(LAST_PULL_KEY, String(data.timestamp));
  }

  return { pushed, pulled };
}

/**
 * Run sync silently — for use in background reconnect listeners.
 * Never throws; logs errors.
 */
export async function syncSilent(): Promise<void> {
  try {
    const result = await sync();
    // eslint-disable-next-line no-console
    console.log(`[sync] pushed ${result.pushed}, pulled ${result.pulled}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[sync] failed:', e);
  }
}
