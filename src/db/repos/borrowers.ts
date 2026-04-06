import { openDb, uuid, now } from '@/db';
import type { BorrowerRow } from '@/db/types';

/**
 * Borrower CRUD against the local SQLite cache. All writes are marked
 * dirty=1 so the Sprint 3 sync layer can push them. Reads are cached
 * locally — no network hit.
 */

export async function listBorrowers(orgId: string): Promise<BorrowerRow[]> {
  const db = await openDb();
  return db.getAllAsync<BorrowerRow>(
    `SELECT * FROM borrowers WHERE org_id = ? ORDER BY name COLLATE NOCASE`,
    [orgId]
  );
}

export async function getBorrower(id: string): Promise<BorrowerRow | null> {
  const db = await openDb();
  const row = await db.getFirstAsync<BorrowerRow>(
    `SELECT * FROM borrowers WHERE id = ?`,
    [id]
  );
  return row ?? null;
}

export interface NewBorrowerInput {
  orgId: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
}

export async function createBorrower(input: NewBorrowerInput): Promise<BorrowerRow> {
  const db = await openDb();
  const row: BorrowerRow = {
    id: uuid(),
    server_id: null,
    org_id: input.orgId,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    photo_url: input.photoUrl ?? null,
    notes: input.notes?.trim() || null,
    created_at: now(),
    dirty: 1,
  };
  await db.runAsync(
    `INSERT INTO borrowers (id, server_id, org_id, name, phone, address, photo_url, notes, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      row.id,
      row.server_id,
      row.org_id,
      row.name,
      row.phone,
      row.address,
      row.photo_url,
      row.notes,
      row.created_at,
    ]
  );
  return row;
}

export interface UpdateBorrowerInput {
  id: string;
  name?: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export async function updateBorrower(input: UpdateBorrowerInput): Promise<void> {
  const db = await openDb();
  const fields: string[] = [];
  const values: (string | null)[] = [];
  if (input.name !== undefined) {
    fields.push('name = ?');
    values.push(input.name.trim());
  }
  if (input.phone !== undefined) {
    fields.push('phone = ?');
    values.push(input.phone?.trim() || null);
  }
  if (input.address !== undefined) {
    fields.push('address = ?');
    values.push(input.address?.trim() || null);
  }
  if (input.notes !== undefined) {
    fields.push('notes = ?');
    values.push(input.notes?.trim() || null);
  }
  if (fields.length === 0) return;
  fields.push('dirty = 1');
  values.push(input.id);
  await db.runAsync(`UPDATE borrowers SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteBorrower(id: string): Promise<void> {
  const db = await openDb();
  // Hard delete locally; Sprint 3 will switch to soft delete + tombstone
  // for sync. OK for now because borrowers can be freely re-added.
  await db.runAsync(`DELETE FROM borrowers WHERE id = ?`, [id]);
}

export async function searchBorrowers(
  orgId: string,
  query: string
): Promise<BorrowerRow[]> {
  const db = await openDb();
  const q = `%${query.trim()}%`;
  return db.getAllAsync<BorrowerRow>(
    `SELECT * FROM borrowers
     WHERE org_id = ?
       AND (name LIKE ? COLLATE NOCASE OR phone LIKE ?)
     ORDER BY name COLLATE NOCASE`,
    [orgId, q, q]
  );
}
