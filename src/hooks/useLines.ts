import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assignLineAgent,
  createLine,
  deleteLine,
  getLine,
  getLineAgentStats,
  getLineAssignmentHistory,
  getLineStats,
  listLines,
  type NewLineInput,
} from '@/db/repos/lines';
import { useAuthStore } from '@/store/authStore';

const KEYS = {
  all: (orgId: string) => ['lines', orgId] as const,
  detail: (id: string) => ['line', id] as const,
  stats: (orgId: string) => ['lines', orgId, 'stats'] as const,
  agentStats: (lineId: string) => ['line', lineId, 'agent-stats'] as const,
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
      if (orgId) {
        qc.invalidateQueries({ queryKey: KEYS.all(orgId) });
        qc.invalidateQueries({ queryKey: KEYS.stats(orgId) });
      }
    },
  });
}

export function useLineStats() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery({
    queryKey: KEYS.stats(orgId ?? '_'),
    enabled: !!orgId,
    queryFn: () => getLineStats(orgId!),
  });
}

export function useLineAgentStats(lineId: string | undefined) {
  return useQuery({
    queryKey: KEYS.agentStats(lineId ?? '_'),
    enabled: !!lineId,
    queryFn: () => getLineAgentStats(lineId!),
  });
}

export function useLineAssignmentHistory(lineId: string | undefined) {
  return useQuery({
    queryKey: ['line', lineId ?? '_', 'history'],
    enabled: !!lineId,
    queryFn: () => getLineAssignmentHistory(lineId!),
  });
}

export function useAssignLineAgent() {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useMutation({
    mutationFn: ({ lineId, agentId }: { lineId: string; agentId: string | null }) =>
      assignLineAgent(lineId, agentId),
    onSuccess: () => {
      if (orgId) {
        qc.invalidateQueries({ queryKey: KEYS.all(orgId) });
        qc.invalidateQueries({ queryKey: KEYS.stats(orgId) });
      }
    },
  });
}
