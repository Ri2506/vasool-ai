import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createBorrower,
  deleteBorrower,
  getBorrower,
  listBorrowers,
  searchBorrowers,
  updateBorrower,
  type NewBorrowerInput,
  type UpdateBorrowerInput,
} from '@/db/repos/borrowers';
import { useAuthStore } from '@/store/authStore';

const KEYS = {
  all: (orgId: string) => ['borrowers', orgId] as const,
  search: (orgId: string, q: string) => ['borrowers', orgId, 'search', q] as const,
  detail: (id: string) => ['borrower', id] as const,
};

function useOrgId(): string | null {
  return useAuthStore((s) => s.user?.orgId ?? null);
}

export function useBorrowers() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: KEYS.all(orgId ?? '_'),
    enabled: !!orgId,
    queryFn: () => listBorrowers(orgId!),
  });
}

export function useBorrowerSearch(query: string) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: KEYS.search(orgId ?? '_', query),
    enabled: !!orgId && query.trim().length > 0,
    queryFn: () => searchBorrowers(orgId!, query),
  });
}

export function useBorrower(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? '_'),
    enabled: !!id,
    queryFn: () => getBorrower(id!),
  });
}

export function useCreateBorrower() {
  const qc = useQueryClient();
  const orgId = useOrgId();
  return useMutation({
    mutationFn: (input: Omit<NewBorrowerInput, 'orgId'>) => {
      if (!orgId) throw new Error('Not signed in');
      return createBorrower({ ...input, orgId });
    },
    onSuccess: () => {
      if (orgId) qc.invalidateQueries({ queryKey: KEYS.all(orgId) });
    },
  });
}

export function useUpdateBorrower() {
  const qc = useQueryClient();
  const orgId = useOrgId();
  return useMutation({
    mutationFn: (input: UpdateBorrowerInput) => updateBorrower(input),
    onSuccess: (_data, vars) => {
      if (orgId) qc.invalidateQueries({ queryKey: KEYS.all(orgId) });
      qc.invalidateQueries({ queryKey: KEYS.detail(vars.id) });
    },
  });
}

export function useDeleteBorrower() {
  const qc = useQueryClient();
  const orgId = useOrgId();
  return useMutation({
    mutationFn: (id: string) => deleteBorrower(id),
    onSuccess: () => {
      if (orgId) qc.invalidateQueries({ queryKey: KEYS.all(orgId) });
    },
  });
}
