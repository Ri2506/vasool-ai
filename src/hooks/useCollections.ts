import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getDueToday,
  getTodaySummary,
  recordCollection,
  getCollectionsForLoan,
  type RecordCollectionInput,
} from '@/db/repos/collections';
import { useAuthStore } from '@/store/authStore';

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
  return useMutation({
    mutationFn: (input: Omit<RecordCollectionInput, 'orgId'>) => {
      if (!orgId) throw new Error('Not signed in');
      return recordCollection({ ...input, orgId });
    },
    onSuccess: () => {
      if (orgId) {
        qc.invalidateQueries({ queryKey: KEYS.dueToday(orgId) });
        qc.invalidateQueries({ queryKey: KEYS.summary(orgId) });
      }
    },
  });
}
