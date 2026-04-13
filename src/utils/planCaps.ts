// Free-tier hard caps + Pro upsell paths.
//
// Per CLAUDE.md pricing: Free = 1 line, 1 agent, 30 borrowers. Pro
// (₹1,999/yr) = unlimited.
//
// Hard caps stop the operation at the data layer (createBorrower throws),
// not just the UI. This way an agent on the same org can't bypass by
// using a different screen.

import { openDb } from '@/db';
import type { Plan } from '@/db/types';

export const FREE_CAPS = {
  borrowers: 30,
  lines: 1,
  agents: 1,
} as const;

export interface PlanQuota {
  plan: Plan;
  borrowers: { used: number; limit: number; isUnlimited: boolean; remaining: number };
  lines: { used: number; limit: number; isUnlimited: boolean; remaining: number };
  agents: { used: number; limit: number; isUnlimited: boolean; remaining: number };
}

export async function getPlanQuota(orgId: string): Promise<PlanQuota> {
  const db = await openDb();
  const org = await db.getFirstAsync<{ plan: Plan }>(
    `SELECT plan FROM organizations WHERE id = ?`,
    [orgId],
  );
  const plan: Plan = (org?.plan as Plan) ?? 'free';
  const isPro = plan === 'pro';

  const borrowerCount = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM borrowers WHERE org_id = ?`,
    [orgId],
  );
  const lineCount = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM lines WHERE org_id = ?`,
    [orgId],
  );
  const agentCount = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM users
     WHERE org_id = ? AND role = 'agent' AND is_active = 1`,
    [orgId],
  );

  const mk = (used: number, limit: number) => ({
    used,
    limit: isPro ? Infinity : limit,
    isUnlimited: isPro,
    remaining: isPro ? Infinity : Math.max(0, limit - used),
  });

  return {
    plan,
    borrowers: mk(borrowerCount?.n ?? 0, FREE_CAPS.borrowers),
    lines: mk(lineCount?.n ?? 0, FREE_CAPS.lines),
    agents: mk(agentCount?.n ?? 0, FREE_CAPS.agents),
  };
}

/**
 * Throws a tagged error when the cap would be exceeded. Repos call this
 * before INSERT. The error message is the user-facing string.
 */
export class PlanCapError extends Error {
  resource: 'borrowers' | 'lines' | 'agents';
  current: number;
  limit: number;
  constructor(
    resource: 'borrowers' | 'lines' | 'agents',
    current: number,
    limit: number,
  ) {
    super(
      `Free plan limit reached: ${current}/${limit} ${resource}. Upgrade to VasoolAI Pro for unlimited.`,
    );
    this.name = 'PlanCapError';
    this.resource = resource;
    this.current = current;
    this.limit = limit;
  }
}

export async function assertWithinCap(
  orgId: string,
  resource: 'borrowers' | 'lines' | 'agents',
): Promise<void> {
  const quota = await getPlanQuota(orgId);
  const slot = quota[resource];
  if (slot.isUnlimited) return;
  if (slot.used >= slot.limit) {
    throw new PlanCapError(resource, slot.used, slot.limit);
  }
}
