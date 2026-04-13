// Org-level settings — currently sms_enabled, name, language. Extend
// here as more per-org preferences accumulate.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { openDb, now } from '@/db';
import type { OrganizationRow } from '@/db/types';
import { useAuthStore } from '@/store/authStore';

const KEY = (orgId: string) => ['org', orgId] as const;

export function useOrg() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery<OrganizationRow | null>({
    queryKey: KEY(orgId ?? '_'),
    enabled: !!orgId,
    queryFn: async () => {
      const db = await openDb();
      const row = await db.getFirstAsync<OrganizationRow>(
        `SELECT * FROM organizations WHERE id = ?`,
        [orgId],
      );
      return row ?? null;
    },
  });
}

export function useUpdateOrg() {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useMutation({
    mutationFn: async (patch: Partial<Pick<OrganizationRow, 'name' | 'sms_enabled' | 'working_days' | 'language'>>) => {
      if (!orgId) throw new Error('Not signed in');
      const db = await openDb();
      const fields: string[] = [];
      const values: (string | number | null)[] = [];
      if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name); }
      if (patch.sms_enabled !== undefined) { fields.push('sms_enabled = ?'); values.push(patch.sms_enabled); }
      if (patch.working_days !== undefined) { fields.push('working_days = ?'); values.push(patch.working_days); }
      if (patch.language !== undefined) { fields.push('language = ?'); values.push(patch.language); }
      if (fields.length === 0) return;
      fields.push('dirty = 1');
      values.push(orgId);
      await db.runAsync(
        `UPDATE organizations SET ${fields.join(', ')} WHERE id = ?`,
        values,
      );
    },
    onSuccess: () => {
      if (orgId) qc.invalidateQueries({ queryKey: KEY(orgId) });
    },
  });
}
