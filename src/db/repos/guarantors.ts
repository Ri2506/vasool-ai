import { openDb, uuid, now } from '@/db';
import type { GuarantorRow } from '@/db/types';

export interface NewGuarantorInput {
  orgId: string;
  loanId: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  relationship?: string | null;
  photoUrl?: string | null;
}

export async function createGuarantor(input: NewGuarantorInput): Promise<GuarantorRow> {
  const db = await openDb();
  const row: GuarantorRow = {
    id: uuid(), server_id: null, org_id: input.orgId,
    loan_id: input.loanId, name: input.name.trim(),
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    relationship: input.relationship?.trim() || null,
    photo_url: input.photoUrl ?? null,
    created_at: now(), dirty: 1,
  };
  await db.runAsync(
    `INSERT INTO guarantors (id, server_id, org_id, loan_id, name, phone, address, relationship, photo_url, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [row.id, row.server_id, row.org_id, row.loan_id, row.name, row.phone, row.address, row.relationship, row.photo_url, row.created_at]
  );
  return row;
}

export async function getGuarantorsForLoan(loanId: string): Promise<GuarantorRow[]> {
  const db = await openDb();
  return db.getAllAsync<GuarantorRow>(
    `SELECT * FROM guarantors WHERE loan_id = ? ORDER BY created_at`, [loanId]
  );
}
