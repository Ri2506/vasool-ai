// Outbound SMS queue — offline-first.
//
// When a collection is recorded we enqueue a receipt SMS row here. The
// flush() function pops queued rows and sends them via the MSG91 Edge
// Function. If network is down, rows stay 'queued' and flush() retries
// on the next online tick (or when the user manually taps "Send now").
//
// Receipt templates are kept short to fit a single SMS segment (160 char
// limit before it becomes 2 segments and costs 2 credits).

import { openDb, uuid, now } from '@/db';
import { supabase } from '@/lib/supabase';
import type { SmsKind, SmsQueueRow, SmsStatus } from '@/db/types';

export interface QueueSmsInput {
  orgId: string;
  kind: SmsKind;
  toPhone: string;
  body: string;
  relatedId?: string | null;
}

function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  // India: 10-digit numbers → prepend +91. Numbers already starting with
  // country code pass through. Refuse anything else.
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length > 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

export async function queueSms(input: QueueSmsInput): Promise<SmsQueueRow | null> {
  const phone = normalisePhone(input.toPhone);
  if (!phone) return null; // silently skip invalid phones
  const db = await openDb();

  // Respect org-level kill switch — if sms_enabled = 0 we skip silently.
  // Used by owners who want to disable receipts org-wide (e.g., during
  // MSG91 outage or before they configure DLT).
  const org = await db.getFirstAsync<{ sms_enabled: number }>(
    `SELECT sms_enabled FROM organizations WHERE id = ?`,
    [input.orgId],
  );
  if (org && org.sms_enabled === 0) return null;
  const row: SmsQueueRow = {
    id: uuid(),
    server_id: null,
    org_id: input.orgId,
    kind: input.kind,
    to_phone: phone,
    body: input.body,
    related_id: input.relatedId ?? null,
    status: 'queued',
    attempts: 0,
    last_attempt_at: null,
    last_error: null,
    sent_at: null,
    created_at: now(),
    dirty: 1,
  };
  await db.runAsync(
    `INSERT INTO sms_queue (id, server_id, org_id, kind, to_phone, body,
       related_id, status, attempts, last_attempt_at, last_error, sent_at,
       created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      row.id, row.server_id, row.org_id, row.kind, row.to_phone, row.body,
      row.related_id, row.status, row.attempts, row.last_attempt_at,
      row.last_error, row.sent_at, row.created_at,
    ],
  );
  return row;
}

/**
 * Build a short receipt body that fits a single SMS segment.
 * Keep under 160 chars.
 */
export function buildReceiptBody(params: {
  borrowerName: string;
  amount: number;
  installmentNumber?: number;
  totalInstallments?: number;
  balance?: number;
  orgName?: string;
}): string {
  const { borrowerName, amount, installmentNumber, totalInstallments, balance, orgName } = params;
  const tag = orgName ? `-${orgName}` : '';
  const inst = installmentNumber != null && totalInstallments != null
    ? ` Day ${installmentNumber}/${totalInstallments}.`
    : '';
  const bal = balance != null && balance > 0 ? ` Balance Rs${balance}.` : '';
  return `Rs${amount} received from ${borrowerName}.${inst}${bal} Thank you!${tag}`.slice(0, 160);
}

export async function listPendingSms(orgId: string, limit = 50): Promise<SmsQueueRow[]> {
  const db = await openDb();
  return db.getAllAsync<SmsQueueRow>(
    `SELECT * FROM sms_queue WHERE org_id = ? AND status = 'queued'
     ORDER BY created_at ASC LIMIT ?`,
    [orgId, limit],
  );
}

export async function listRecentSms(orgId: string, limit = 100): Promise<SmsQueueRow[]> {
  const db = await openDb();
  return db.getAllAsync<SmsQueueRow>(
    `SELECT * FROM sms_queue WHERE org_id = ?
     ORDER BY created_at DESC LIMIT ?`,
    [orgId, limit],
  );
}

async function markStatus(
  id: string,
  status: SmsStatus,
  patch: { last_error?: string | null; attempts?: number; sent_at?: number | null },
): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    `UPDATE sms_queue
       SET status = ?,
           last_error = COALESCE(?, last_error),
           attempts = COALESCE(?, attempts),
           last_attempt_at = ?,
           sent_at = COALESCE(?, sent_at),
           dirty = 1
     WHERE id = ?`,
    [
      status,
      patch.last_error ?? null,
      patch.attempts ?? null,
      now(),
      patch.sent_at ?? null,
      id,
    ],
  );
}

/**
 * Flush the queue — sends all pending rows via the MSG91 Edge Function.
 * Returns counts so the caller can surface "sent X, failed Y".
 *
 * The Edge Function `send-receipt-sms` lives in supabase/functions/ and
 * calls MSG91's v5 bulk endpoint. If the function isn't deployed yet,
 * the supabase.functions.invoke() call throws and we mark the row
 * 'failed' with the error — but keep attempts < 3 so it'll retry.
 */
export interface FlushResult { sent: number; failed: number; skipped: number }

export async function flushSmsQueue(orgId: string): Promise<FlushResult> {
  const pending = await listPendingSms(orgId);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of pending) {
    if (row.attempts >= 3) {
      await markStatus(row.id, 'failed', {
        last_error: 'Max retries exceeded',
        attempts: row.attempts,
      });
      skipped++;
      continue;
    }
    try {
      const { error } = await supabase.functions.invoke('send-receipt-sms', {
        body: {
          org_id: row.org_id,
          to: row.to_phone,
          message: row.body,
          kind: row.kind,
          ref_id: row.id,
        },
      });
      if (error) throw new Error(error.message ?? 'unknown');
      await markStatus(row.id, 'sent', {
        attempts: row.attempts + 1,
        sent_at: now(),
        last_error: null,
      });
      sent++;
    } catch (e) {
      const msg = (e as Error)?.message ?? 'unknown';
      await markStatus(row.id, 'queued', {
        attempts: row.attempts + 1,
        last_error: msg,
      });
      failed++;
    }
  }

  return { sent, failed, skipped };
}

export async function getSmsStats(orgId: string): Promise<{
  queued: number;
  failed: number;
  sent_today: number;
}> {
  const db = await openDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMs = today.getTime();

  const queued = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sms_queue WHERE org_id = ? AND status = 'queued'`,
    [orgId],
  );
  const failed = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sms_queue WHERE org_id = ? AND status = 'failed'`,
    [orgId],
  );
  const sent = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sms_queue WHERE org_id = ? AND status = 'sent' AND sent_at >= ?`,
    [orgId, startMs],
  );
  return {
    queued: queued?.n ?? 0,
    failed: failed?.n ?? 0,
    sent_today: sent?.n ?? 0,
  };
}
