import { openDb, uuid, now } from '@/db';

export interface ReferralRow {
  id: string;
  org_id: string;
  referral_code: string;
  referred_org_id: string | null;
  status: 'pending' | 'completed' | 'rewarded';
  created_at: number;
  completed_at: number | null;
  dirty: 0 | 1;
}

/**
 * Generate a short referral code: "VASOOL" + 6 random alphanumeric chars.
 * Example: VASOOL-K3M9XP
 */
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 for clarity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `VASOOL-${code}`;
}

/**
 * Get or create the referral code for an organization.
 * Each org gets exactly one code.
 */
export async function getOrCreateReferralCode(orgId: string): Promise<string> {
  const db = await openDb();
  const existing = await db.getFirstAsync<{ referral_code: string }>(
    `SELECT referral_code FROM referrals WHERE org_id = ? LIMIT 1`,
    [orgId]
  );
  if (existing) return existing.referral_code;

  const code = generateCode();
  await db.runAsync(
    `INSERT INTO referrals (id, org_id, referral_code, status, created_at, dirty)
     VALUES (?, ?, ?, 'pending', ?, 1)`,
    [uuid(), orgId, code, now()]
  );
  return code;
}

/**
 * Apply a referral code — called when a new user signs up with a code.
 * Marks the referral as completed and records who was referred.
 */
export async function applyReferralCode(
  code: string,
  referredOrgId: string
): Promise<{ success: boolean; message: string }> {
  const db = await openDb();
  const referral = await db.getFirstAsync<ReferralRow>(
    `SELECT * FROM referrals WHERE referral_code = ? AND status = 'pending'`,
    [code.toUpperCase().trim()]
  );

  if (!referral) {
    return { success: false, message: 'Invalid or already used referral code' };
  }

  if (referral.org_id === referredOrgId) {
    return { success: false, message: 'Cannot use your own referral code' };
  }

  await db.runAsync(
    `UPDATE referrals SET status = 'completed', referred_org_id = ?, completed_at = ?, dirty = 1
     WHERE id = ?`,
    [referredOrgId, now(), referral.id]
  );

  return { success: true, message: 'Referral applied! Both you and the referrer get 1 free month.' };
}

/**
 * Get referral stats for an org (how many referred, how many completed).
 */
export async function getReferralStats(orgId: string): Promise<{
  code: string;
  totalReferred: number;
  completedCount: number;
  freeMonthsEarned: number;
}> {
  const code = await getOrCreateReferralCode(orgId);
  const db = await openDb();

  const stats = await db.getFirstAsync<{ total: number; completed: number }>(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN status IN ('completed','rewarded') THEN 1 ELSE 0 END) AS completed
     FROM referrals WHERE org_id = ?`,
    [orgId]
  );

  const completed = Number(stats?.completed ?? 0);
  return {
    code,
    totalReferred: Number(stats?.total ?? 0),
    completedCount: completed,
    freeMonthsEarned: completed, // 1 free month per successful referral
  };
}
