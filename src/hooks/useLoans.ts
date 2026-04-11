import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createLoanWithPlan,
  createLoanWithTerms,
  listActiveLoans,
  listLoansForBorrower,
  listPlanEntries,
  updateLoanStatus,
  type CreateLoanInput,
  type CreateLoanWithTermsInput,
} from '@/db/repos/loans';
import type { LoanStatus } from '@/db/types';
import { useAuthStore } from '@/store/authStore';

const KEYS = {
  active: (orgId: string) => ['loans', orgId, 'active'] as const,
  byBorrower: (borrowerId: string) => ['loans', 'borrower', borrowerId] as const,
  plan: (loanId: string) => ['plan', loanId] as const,
};

export function useActiveLoans() {
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useQuery({
    queryKey: KEYS.active(orgId ?? '_'),
    enabled: !!orgId,
    queryFn: () => listActiveLoans(orgId!),
  });
}

export function useLoansForBorrower(borrowerId: string | undefined) {
  return useQuery({
    queryKey: KEYS.byBorrower(borrowerId ?? '_'),
    enabled: !!borrowerId,
    queryFn: () => listLoansForBorrower(borrowerId!),
  });
}

export function usePlanEntries(loanId: string | undefined) {
  return useQuery({
    queryKey: KEYS.plan(loanId ?? '_'),
    enabled: !!loanId,
    queryFn: () => listPlanEntries(loanId!),
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useMutation({
    mutationFn: (input: Omit<CreateLoanInput, 'orgId'>) => {
      if (!orgId) throw new Error('Not signed in');
      return createLoanWithPlan({ ...input, orgId });
    },
    onSuccess: (data) => {
      if (orgId) qc.invalidateQueries({ queryKey: KEYS.active(orgId) });
      qc.invalidateQueries({ queryKey: KEYS.byBorrower(data.loan.borrower_id) });
    },
  });
}

/**
 * Month 1 Week 2 — create a loan from dynamic loan config.
 * Target path for the refactored NewLoanScreen wizard.
 */
export function useCreateLoanFromTerms() {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useMutation({
    mutationFn: (input: Omit<CreateLoanWithTermsInput, 'orgId'>) => {
      if (!orgId) throw new Error('Not signed in');
      return createLoanWithTerms({ ...input, orgId });
    },
    onSuccess: (data) => {
      if (orgId) {
        qc.invalidateQueries({ queryKey: KEYS.active(orgId) });
        qc.invalidateQueries({ queryKey: ['dueToday', orgId] });
        qc.invalidateQueries({ queryKey: ['todaySummary', orgId] });
        qc.invalidateQueries({ queryKey: ['borrower-statuses', orgId] });
      }
      qc.invalidateQueries({ queryKey: KEYS.byBorrower(data.loan.borrower_id) });
      qc.invalidateQueries({ queryKey: KEYS.plan(data.loan.id) });
    },
  });
}

export function useUpdateLoanStatus() {
  const qc = useQueryClient();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LoanStatus }) =>
      updateLoanStatus(id, status),
    onSuccess: () => {
      if (orgId) qc.invalidateQueries({ queryKey: KEYS.active(orgId) });
    },
  });
}
