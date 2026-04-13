// Discover every org the signed-in user can switch into.
// We match on `phone` because the same person may have multiple `users`
// rows (one per org they own / agent for).

import { useQuery } from '@tanstack/react-query';

import { openDb } from '@/db';
import { useAuthStore } from '@/store/authStore';
import type { Role } from '@/store/authStore';

export interface OrgMembership {
  user_id: string;          // local users.id (one per org)
  org_id: string;
  org_name: string;
  role: Role;
  borrower_count: number;
  is_active: boolean;
}

export function useMyOrgs() {
  const phone = useAuthStore((s) => s.user?.phone ?? null);
  return useQuery<OrgMembership[]>({
    queryKey: ['my-orgs', phone],
    enabled: !!phone,
    queryFn: async () => {
      const db = await openDb();
      const rows = await db.getAllAsync<{
        user_id: string;
        org_id: string;
        org_name: string;
        role: Role;
        is_active: number;
        borrower_count: number;
      }>(
        `SELECT u.id AS user_id,
                u.org_id,
                COALESCE(o.name, 'Organisation') AS org_name,
                u.role,
                u.is_active,
                (SELECT COUNT(*) FROM borrowers b WHERE b.org_id = u.org_id) AS borrower_count
         FROM users u
         LEFT JOIN organizations o ON o.id = u.org_id
         WHERE u.phone = ?
         ORDER BY u.created_at ASC`,
        [phone],
      );
      return rows.map((r) => ({
        user_id: r.user_id,
        org_id: r.org_id,
        org_name: r.org_name,
        role: r.role,
        borrower_count: r.borrower_count,
        is_active: r.is_active === 1,
      }));
    },
  });
}
