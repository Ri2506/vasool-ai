import { openDb, uuid, now } from '@/db';
import type { BorrowerRow, IdType } from '@/db/types';
import { assertWithinCap } from '@/utils/planCaps';

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
  smsOptOut?: boolean;
  idNumber?: string | null;
  idType?: IdType | null;
  idPhotoUri?: string | null;
}

export async function createBorrower(input: NewBorrowerInput): Promise<BorrowerRow> {
  await assertWithinCap(input.orgId, 'borrowers');
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
    sms_opt_out: input.smsOptOut ? 1 : 0,
    id_number: input.idNumber?.trim() || null,
    id_type: input.idType ?? null,
    id_photo_uri: input.idPhotoUri ?? null,
    created_at: now(),
    dirty: 1,
  };
  await db.runAsync(
    `INSERT INTO borrowers (id, server_id, org_id, name, phone, address, photo_url, notes,
       sms_opt_out, id_number, id_type, id_photo_uri, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      row.id, row.server_id, row.org_id, row.name, row.phone, row.address,
      row.photo_url, row.notes, row.sms_opt_out, row.id_number, row.id_type,
      row.id_photo_uri, row.created_at,
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
  photoUrl?: string | null;
  smsOptOut?: boolean;
  idNumber?: string | null;
  idType?: IdType | null;
  idPhotoUri?: string | null;
}

export async function updateBorrower(input: UpdateBorrowerInput): Promise<void> {
  const db = await openDb();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name.trim()); }
  if (input.phone !== undefined) { fields.push('phone = ?'); values.push(input.phone?.trim() || null); }
  if (input.address !== undefined) { fields.push('address = ?'); values.push(input.address?.trim() || null); }
  if (input.notes !== undefined) { fields.push('notes = ?'); values.push(input.notes?.trim() || null); }
  if (input.photoUrl !== undefined) { fields.push('photo_url = ?'); values.push(input.photoUrl); }
  if (input.smsOptOut !== undefined) { fields.push('sms_opt_out = ?'); values.push(input.smsOptOut ? 1 : 0); }
  if (input.idNumber !== undefined) { fields.push('id_number = ?'); values.push(input.idNumber?.trim() || null); }
  if (input.idType !== undefined) { fields.push('id_type = ?'); values.push(input.idType); }
  if (input.idPhotoUri !== undefined) { fields.push('id_photo_uri = ?'); values.push(input.idPhotoUri); }
  if (fields.length === 0) return;
  fields.push('dirty = 1');
  values.push(input.id);
  await db.runAsync(`UPDATE borrowers SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteBorrower(id: string): Promise<void> {
  const db = await openDb();
  // Cascade delete child records to prevent orphans.
  // Wrapped in a transaction so partial failures don't leave dangling data.
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM collections WHERE loan_id IN (SELECT id FROM loans WHERE borrower_id = ?)`,
      [id]
    );
    await db.runAsync(
      `DELETE FROM plan_entries WHERE loan_id IN (SELECT id FROM loans WHERE borrower_id = ?)`,
      [id]
    );
    await db.runAsync(`DELETE FROM loans WHERE borrower_id = ?`, [id]);
    await db.runAsync(`DELETE FROM borrowers WHERE id = ?`, [id]);
  });
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
