import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  approveLoanRequest,
  cancelLoanRequest,
  createLoanRequest,
  getPendingRequestCount,
  listLoanRequestsByAgent,
  listLoanRequestsForOwner,
  rejectLoanRequest,
  type CreateLoanRequestInput,
} from '@/db/repos/loanRequests';
import { openDb } from '@/db';
import type { LoanRequestStatus } from '@/db/types';
import { notifyLoanRequestCreated } from '@/lib/notifications';
import { useAuthStore } from '@/store/authStore';
import { haptic } from '@/utils/haptics';

const KEYS = {
  inbox: (orgId: string, status?: LoanRequestStatus) =>
    ['loan-requests', orgId, status ?? 'all'] as const,
  pendingCount: (orgId: string) => ['loan-requests', orgId, 'pending-count'] as const,
};

export function useLoanRequests(status?: LoanRequestStatus) {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery({
    queryKey: KEYS.inbox(orgId ?? '_', status),
    enabled: !!orgId,
    queryFn: () => listLoanRequestsForOwner(orgId!, status),
    refetchInterval: 30_000,
  });
}

/**
 * Agent-side hook — returns the requests the signed-in agent submitted.
 * Polls every 30s so an approve/reject from the owner reflects quickly.
 */
export function useMyLoanRequests() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useQuery({
    queryKey: ['loan-requests', orgId, 'mine', userId],
    enabled: !!orgId && !!userId,
    queryFn: () => listLoanRequestsByAgent(orgId!, userId!),
    refetchInterval: 30_000,
  });
}

export function usePendingLoanRequestCount() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery({
    queryKey: KEYS.pendingCount(orgId ?? '_'),
    enabled: !!orgId,
    queryFn: () => getPendingRequestCount(orgId!),
    refetchInterval: 60_000,
  });
}

export function useCreateLoanRequest() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const userName = useAuthStore((s) => s.user?.name ?? null);
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useMutation({
    mutationFn: (input: Omit<CreateLoanRequestInput, 'orgId' | 'requestedBy'>) => {
      if (!orgId || !userId) throw new Error('Not signed in');
      return createLoanRequest({ ...input, orgId, requestedBy: userId });
    },
    onSuccess: async (data) => {
      qc.invalidateQueries({ queryKey: ['loan-requests'] });
      // Owner alert — pings the owner so they don't have to poll the
      // requests inbox. Best-effort; failure here never blocks success.
      try {
        const db = await openDb();
        const borrower = await db.getFirstAsync<{ name: string }>(
          `SELECT name FROM borrowers WHERE id = ?`,
          [data.borrower_id],
        );
        await notifyLoanRequestCreated(
          userName ?? 'Agent',
          borrower?.name ?? 'borrower',
          data.disbursed_amount,
        );
      } catch {
        // ignore
      }
    },
  });
}

export function useApproveLoanRequest() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useMutation({
    mutationFn: (requestId: string) => {
      if (!userId) throw new Error('Not signed in');
      return approveLoanRequest(requestId, userId);
    },
    onSuccess: () => {
      haptic('success');
      qc.invalidateQueries({ queryKey: ['loan-requests'] });
      if (orgId) {
        qc.invalidateQueries({ queryKey: ['loans', orgId] });
        qc.invalidateQueries({ queryKey: ['borrower-list-summaries', orgId] });
        qc.invalidateQueries({ queryKey: ['borrower-summary', orgId] });
        qc.invalidateQueries({ queryKey: ['dueToday', orgId] });
      }
    },
  });
}

export function useRejectLoanRequest() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) => {
      if (!userId) throw new Error('Not signed in');
      return rejectLoanRequest(requestId, userId, reason);
    },
    onSuccess: () => {
      haptic('warn');
      qc.invalidateQueries({ queryKey: ['loan-requests'] });
    },
  });
}

export function useCancelLoanRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => cancelLoanRequest(requestId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loan-requests'] });
    },
  });
}
