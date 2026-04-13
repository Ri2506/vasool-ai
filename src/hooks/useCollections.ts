import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getDueToday,
  getTodaySummary,
  recordCollection,
  getCollectionsForLoan,
  type RecordCollectionInput,
} from '@/db/repos/collections';
import { buildReceiptBody, flushSmsQueue, queueSms } from '@/db/repos/sms';
import { openDb } from '@/db';
import type { BorrowerRow } from '@/db/types';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { haptic } from '@/utils/haptics';

const KEYS = {
  dueToday: (orgId: string) => ['dueToday', orgId] as const,
  summary: (orgId: string) => ['todaySummary', orgId] as const,
  forLoan: (loanId: string) => ['collections', loanId] as const,
};

export function useDueToday() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery({
    queryKey: KEYS.dueToday(orgId ?? '_'),
    enabled: !!orgId,
    queryFn: () => getDueToday(orgId!),
    refetchInterval: 30_000,
  });
}

export function useTodaySummary() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery({
    queryKey: KEYS.summary(orgId ?? '_'),
    enabled: !!orgId,
    queryFn: () => getTodaySummary(orgId!),
    refetchInterval: 15_000,
  });
}

export function useCollectionsForLoan(loanId: string | undefined) {
  return useQuery({
    queryKey: KEYS.forLoan(loanId ?? '_'),
    enabled: !!loanId,
    queryFn: () => getCollectionsForLoan(loanId!),
  });
}

export function useRecordCollection() {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const isOnline = useAppStore((s) => s.isOnline);
  return useMutation({
    mutationFn: (input: Omit<RecordCollectionInput, 'orgId'>) => {
      if (!orgId) throw new Error('Not signed in');
      return recordCollection({ ...input, orgId });
    },
    onSuccess: async (data, input) => {
      haptic('success');
      // Queue a receipt SMS to the borrower (fire-and-forget). We look up
      // the borrower phone here instead of passing it in so the collect
      // UI doesn't need to know about SMS. Flush runs immediately if
      // online; otherwise the row stays queued and flushes on reconnect.
      try {
        if (orgId && data) {
          const db = await openDb();
          const borrower = await db.getFirstAsync<BorrowerRow>(
            `SELECT b.* FROM borrowers b
             JOIN loans l ON l.borrower_id = b.id
             WHERE l.id = ?`,
            [data.loan_id],
          );
          // Skip if borrower has opted out of SMS receipts.
          if (borrower?.phone && borrower.sms_opt_out !== 1) {
            await queueSms({
              orgId,
              kind: 'receipt',
              toPhone: borrower.phone,
              body: buildReceiptBody({
                borrowerName: borrower.name,
                amount: data.amount,
              }),
              relatedId: data.id,
            });
            if (isOnline) {
              // Fire-and-forget — failures stay queued for retry.
              flushSmsQueue(orgId).catch(() => undefined);
            }
          }
        }
      } catch {
        // Never let SMS queueing break collection success path.
      }
      if (orgId) {
        qc.invalidateQueries({ queryKey: KEYS.dueToday(orgId) });
        qc.invalidateQueries({ queryKey: KEYS.summary(orgId) });
        qc.invalidateQueries({ queryKey: ['borrower-statuses', orgId] });
        qc.invalidateQueries({ queryKey: ['loans', orgId] });
        qc.invalidateQueries({ queryKey: ['borrower-list-summaries', orgId] });
        qc.invalidateQueries({ queryKey: ['borrower-summary', orgId] });
        // Reports + per-line stats also depend on collection totals
        qc.invalidateQueries({ queryKey: ['report'] });
        qc.invalidateQueries({ queryKey: ['lines', orgId, 'stats'] });
      }
      if (input.loanId) {
        qc.invalidateQueries({ queryKey: KEYS.forLoan(input.loanId) });
        qc.invalidateQueries({ queryKey: ['plan', input.loanId] });
        qc.invalidateQueries({ queryKey: ['plan-timeline', input.loanId] });
        qc.invalidateQueries({ queryKey: ['loan', input.loanId] });
      }
      // Recent-payments timeline on borrower detail. Keyed by borrower id
      // which we don't have here, so invalidate the whole prefix.
      qc.invalidateQueries({ queryKey: ['recent-payments'] });
      qc.invalidateQueries({ queryKey: ['borrower-tip-data'] });
      qc.invalidateQueries({ queryKey: ['line', undefined, 'agent-stats'] });
    },
  });
}
