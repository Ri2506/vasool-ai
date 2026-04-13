import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { openDb } from '@/db';
import { sync } from '@/db/sync';
import { useAuthStore } from '@/store/authStore';

interface SyncStatus {
  totalDirty: number;
  byTable: Record<string, number>;
}

const TABLES = [
  'organizations', 'users', 'borrowers', 'lines', 'loans',
  'plan_entries', 'collections', 'principal_returns', 'expenses',
  'investments', 'guarantors', 'deposits', 'handovers', 'loan_requests',
  'sms_queue', 'line_agent_assignments', 'notifications', 'referrals',
];

/**
 * How many rows are dirty (pending push). Polls every 15s so the
 * "Sync now" button shows a live count.
 */
export function useSyncStatus() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery<SyncStatus>({
    queryKey: ['sync', 'status', orgId],
    enabled: !!orgId,
    refetchInterval: 15_000,
    queryFn: async () => {
      const db = await openDb();
      let total = 0;
      const byTable: Record<string, number> = {};
      for (const t of TABLES) {
        try {
          const row = await db.getFirstAsync<{ n: number }>(
            `SELECT COUNT(*) AS n FROM ${t} WHERE dirty = 1`,
          );
          if (row && row.n > 0) {
            byTable[t] = row.n;
            total += row.n;
          }
        } catch { /* table missing — skip */ }
      }
      return { totalDirty: total, byTable };
    },
  });
}

export function useSyncNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => sync(),
    onSuccess: () => {
      // Invalidate everything since pulled rows could affect any view.
      qc.invalidateQueries();
    },
  });
}
