// React Query bindings for the handovers repo.
// Fully realtime: every mutation invalidates the whole prefix.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  confirmHandover,
  getAgentTallyForDate,
  getAgentVarianceSummary,
  getOrCreateTodayHandover,
  listHandoversForOwner,
  submitHandover,
  type AgentTally,
  type AgentVarianceRow,
  type HandoverWithAgent,
} from '@/db/repos/handovers';
import { openDb } from '@/db';
import type { HandoverRow, HandoverStatus } from '@/db/types';
import {
  notifyHandoverDisputed,
  notifyHandoverSubmitted,
} from '@/lib/notifications';
import { useAuthStore } from '@/store/authStore';
import { haptic } from '@/utils/haptics';

const KEYS = {
  todayForAgent: (orgId: string, agentId: string) =>
    ['handover', 'today', orgId, agentId] as const,
  agentTally: (orgId: string, agentId: string) =>
    ['handover', 'tally', orgId, agentId] as const,
  ownerInbox: (orgId: string, status?: HandoverStatus) =>
    ['handover', 'inbox', orgId, status ?? 'all'] as const,
  agentVariance: (orgId: string) => ['handover', 'variance', orgId] as const,
};

/**
 * Today's handover row for the currently signed-in agent. Auto-creates if
 * missing, refreshes on focus.
 */
export function useTodayHandover() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery<HandoverRow | null>({
    queryKey: KEYS.todayForAgent(orgId ?? '_', userId ?? '_'),
    enabled: !!orgId && !!userId,
    queryFn: () => getOrCreateTodayHandover(orgId!, userId!),
    refetchInterval: 30_000,
  });
}

/**
 * Live tally for the currently signed-in agent — used to show
 * "auto-tallied" amounts above the cash input on the EOD sheet.
 */
export function useAgentTallyToday() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery<AgentTally>({
    queryKey: KEYS.agentTally(orgId ?? '_', userId ?? '_'),
    enabled: !!orgId && !!userId,
    queryFn: () => getAgentTallyForDate(orgId!, userId!, Date.now()),
    refetchInterval: 15_000,
  });
}

export function useSubmitHandover() {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useMutation({
    mutationFn: (input: { id: string; cashHandedOver: number; notes?: string }) =>
      submitHandover(input.id, input.cashHandedOver, input.notes),
    onSuccess: async (data) => {
      haptic('success');
      qc.invalidateQueries({ queryKey: ['handover'] });
      if (orgId) {
        qc.invalidateQueries({ queryKey: ['notifications', orgId] });
      }
      // Owner alert — surface the submission immediately on the owner
      // device so they can confirm cash count without opening the app.
      try {
        const db = await openDb();
        const agent = await db.getFirstAsync<{ name: string }>(
          `SELECT name FROM users WHERE id = ?`,
          [data.agent_id],
        );
        await notifyHandoverSubmitted(agent?.name ?? 'Agent', data.cash_handed_over ?? 0);
      } catch {
        // Notifications aren't critical — never block mutation success
      }
    },
  });
}

export function useConfirmHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; cashReceived: number }) =>
      confirmHandover(input.id, input.cashReceived),
    onSuccess: async (data) => {
      haptic(data.status === 'disputed' ? 'error' : 'success');
      qc.invalidateQueries({ queryKey: ['handover'] });
      // If the confirmation produced a dispute, fire a high-priority
      // alert so the owner doesn't forget to investigate.
      if (data.status === 'disputed') {
        try {
          const db = await openDb();
          const agent = await db.getFirstAsync<{ name: string }>(
            `SELECT name FROM users WHERE id = ?`,
            [data.agent_id],
          );
          await notifyHandoverDisputed(agent?.name ?? 'Agent', data.variance ?? 0);
        } catch {
          // ignore
        }
      }
    },
  });
}

/**
 * Owner inbox of all handovers across all agents. Defaults to all statuses;
 * pass a specific status to filter (e.g., 'submitted' for "needs my attention").
 */
export function useHandoverInbox(status?: HandoverStatus) {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery<HandoverWithAgent[]>({
    queryKey: KEYS.ownerInbox(orgId ?? '_', status),
    enabled: !!orgId,
    queryFn: () => listHandoversForOwner(orgId!, status),
    refetchInterval: 30_000,
  });
}

/**
 * Per-agent variance summary for the fraud dashboard.
 * Bigger absolute net_variance and higher disputed_count = redder flag.
 */
export function useAgentVarianceSummary(days = 30) {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery<AgentVarianceRow[]>({
    queryKey: KEYS.agentVariance(orgId ?? '_'),
    enabled: !!orgId,
    queryFn: () => getAgentVarianceSummary(orgId!, days),
  });
}
