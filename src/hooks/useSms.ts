import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  flushSmsQueue,
  getSmsStats,
  listRecentSms,
} from '@/db/repos/sms';
import { useAuthStore } from '@/store/authStore';

export function useSmsStats() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery({
    queryKey: ['sms', 'stats', orgId],
    enabled: !!orgId,
    queryFn: () => getSmsStats(orgId!),
    refetchInterval: 30_000,
  });
}

export function useRecentSms(limit = 100) {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery({
    queryKey: ['sms', 'recent', orgId, limit],
    enabled: !!orgId,
    queryFn: () => listRecentSms(orgId!, limit),
  });
}

export function useFlushSmsQueue() {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useMutation({
    mutationFn: () => {
      if (!orgId) throw new Error('Not signed in');
      return flushSmsQueue(orgId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sms'] });
    },
  });
}
