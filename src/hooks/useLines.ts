import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createLine,
  deleteLine,
  getLine,
  listLines,
  type NewLineInput,
} from '@/db/repos/lines';
import { useAuthStore } from '@/store/authStore';

const KEYS = {
  all: (orgId: string) => ['lines', orgId] as const,
  detail: (id: string) => ['line', id] as const,
};

export function useLines() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery({
    queryKey: KEYS.all(orgId ?? '_'),
    enabled: !!orgId,
    queryFn: () => listLines(orgId!),
  });
}

export function useLine(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? '_'),
    enabled: !!id,
    queryFn: () => getLine(id!),
  });
}

export function useCreateLine() {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useMutation({
    mutationFn: (input: Omit<NewLineInput, 'orgId'>) => {
      if (!orgId) throw new Error('Not signed in');
      return createLine({ ...input, orgId });
    },
    onSuccess: () => {
      if (orgId) qc.invalidateQueries({ queryKey: KEYS.all(orgId) });
    },
  });
}

export function useDeleteLine() {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useMutation({
    mutationFn: (id: string) => deleteLine(id),
    onSuccess: () => {
      if (orgId) qc.invalidateQueries({ queryKey: KEYS.all(orgId) });
    },
  });
}
