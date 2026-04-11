// Unit tests for computeLoanTerms covering all 6 loan structures.
//
// Run with:  npm run test:calc
// Internally: npx tsx src/utils/loanCalc.test.ts
//
// Uses Node's built-in assert. No jest/vitest dependency.

import assert from 'node:assert/strict';
import { computeLoanTerms, type ComputeLoanTermsInput } from './loanCalc';

// Fixed start date for reproducible due_date assertions: 2026-04-01 00:00 IST
const START = new Date(2026, 3, 1, 0, 0, 0, 0).getTime();
const MS_PER_DAY = 86_400_000;

let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passCount++;
    // eslint-disable-next-line no-console
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    failCount++;
    // eslint-disable-next-line no-console
    console.error(`  \u2717 ${name}`);
    // eslint-disable-next-line no-console
    console.error(`     ${(e as Error).message}`);
  }
}

function approxEqual(a: number, b: number, tolerance = 1): void {
  assert.ok(
    Math.abs(a - b) <= tolerance,
    `expected ~${b}, got ${a} (diff ${Math.abs(a - b).toFixed(2)} > ${tolerance})`,
  );
}

// ─── Case 1: Thandal classic (front-loaded, daily, 100 days) ───────────

test('Case 1: Thandal classic — ₹9K disbursed, front-loaded, 100 days daily → ₹100/day', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 9000,
    repaymentType: 'principal_plus_interest',
    interestType: 'front_loaded',
    // Owner chose: "₹1000 on top of ₹9000" — that's ~11.11% over ~3.3 months
    // We model it as a rate that gives exactly ₹1000 interest over 100 days:
    //   interest = 9000 × rate × (100/30) for rate period 'month'
    //   1000 = 9000 × rate × 3.333...
    //   rate = 1000 / (9000 × 3.333) = ~0.0333 per month = 3.33%/month
    interestRate: 1000 / (9000 * (100 / 30)),
    interestRatePeriod: 'month',
    frequency: 'daily',
    tenureCount: 100,
    startDate: START,
  };
  const result = computeLoanTerms(input);
  assert.equal(result.principal, 9000);
  approxEqual(result.totalInterest, 1000);
  approxEqual(result.totalRepayment, 10000);
  approxEqual(result.emiAmount, 100);
  assert.equal(result.installments, 100);
  assert.equal(result.planEntries.length, 100);
  // First installment due day 1 after start
  assert.equal(result.planEntries[0].dueDate, START + MS_PER_DAY);
  // Last installment due day 100
  assert.equal(result.planEntries[99].dueDate, START + 100 * MS_PER_DAY);
});

// ─── Case 2: Flat interest loan (weekly) ───────────────────────────────

test('Case 2: Flat interest — ₹50K at 2%/month flat, 26 weekly installments', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 50000,
    repaymentType: 'principal_plus_interest',
    interestType: 'flat',
    interestRate: 0.02,
    interestRatePeriod: 'month',
    frequency: 'weekly',
    tenureCount: 26,
    startDate: START,
  };
  const result = computeLoanTerms(input);
  assert.equal(result.principal, 50000);
  // tenureDays = 26 × 7 = 182 days = 182/30 = 6.067 months
  // interest = 50000 × 0.02 × 6.067 ≈ 6,067
  approxEqual(result.totalInterest, 6067, 5);
  approxEqual(result.totalRepayment, 56067, 5);
  assert.equal(result.installments, 26);
  // Principal portion per installment: (50000 / 26) ≈ 1923
  // Interest portion per installment: (6067 / 26) ≈ 233
  // EMI ≈ 2156
  approxEqual(result.planEntries[0].principalPortion, 1923, 5);
  approxEqual(result.planEntries[0].interestPortion, 233, 5);
});

// ─── Case 3: Reducing balance EMI (monthly) ────────────────────────────

test('Case 3: Reducing balance — ₹1L at 24% p.a. reducing, 12 months', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 100000,
    repaymentType: 'principal_plus_interest',
    interestType: 'reducing',
    interestRate: 0.24,
    interestRatePeriod: 'year',
    frequency: 'monthly',
    tenureCount: 12,
    startDate: START,
  };
  const result = computeLoanTerms(input);
  assert.equal(result.principal, 100000);
  // Standard EMI formula: 24%/year → 2%/month reducing
  // EMI = 100000 × 0.02 × (1.02)^12 / ((1.02)^12 - 1) ≈ 9456
  approxEqual(result.emiAmount, 9456, 10);
  assert.equal(result.installments, 12);
  // First installment: interest = 100000 × 0.02 = 2000, principal = 9456 - 2000 = 7456
  approxEqual(result.planEntries[0].interestPortion, 2000, 5);
  approxEqual(result.planEntries[0].principalPortion, 7456, 10);
  // Last installment: outstanding should be close to 0 after
  const lastEntry = result.planEntries[11];
  assert.ok(lastEntry.interestPortion < lastEntry.principalPortion);
});

// ─── Case 4: Interest-only rolling (daily) ─────────────────────────────

test('Case 4: Interest-only rolling — ₹10K working capital, 0.3%/day, 365 days', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 10000,
    repaymentType: 'interest_only',
    interestType: 'flat',
    interestRate: 0.003,
    interestRatePeriod: 'day',
    frequency: 'daily',
    tenureCount: 365,
    startDate: START,
  };
  const result = computeLoanTerms(input);
  assert.equal(result.principal, 10000);
  // Each day: 10000 × 0.003 × 1 = ₹30/day
  approxEqual(result.emiAmount, 30, 0.1);
  assert.equal(result.installments, 365);
  // Every installment has principalPortion = 0
  assert.equal(result.planEntries[0].principalPortion, 0);
  assert.equal(result.planEntries[100].principalPortion, 0);
  approxEqual(result.planEntries[0].interestPortion, 30, 0.1);
  // No natural end date for interest-only
  assert.equal(result.endDate, null);
  // Total scheduled interest over 365 days ≈ ₹10,950
  approxEqual(result.totalInterest, 10950, 5);
});

// ─── Case 5: Interest-only with upfront fee ────────────────────────────

test('Case 5: Interest-only + upfront fee — ₹10K principal + ₹500 fee + ₹200/day interest', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 10000,
    repaymentType: 'interest_only',
    interestType: 'front_loaded',
    interestRate: 0.02, // 2% per day → ₹200/day
    interestRatePeriod: 'day',
    frequency: 'daily',
    tenureCount: 100,
    startDate: START,
    upfrontFee: 500,
  };
  const result = computeLoanTerms(input);
  assert.equal(result.principal, 10000);
  // First entry is the day-0 upfront fee, pre-marked paid
  assert.equal(result.planEntries[0].installmentNumber, 0);
  assert.equal(result.planEntries[0].expectedAmount, 500);
  assert.equal(result.planEntries[0].preMarkedPaid, true);
  assert.equal(result.planEntries[0].dueDate, START);
  // Installments 1..100 are daily ₹200 interest
  assert.equal(result.planEntries.length, 101); // 100 regular + 1 day-0
  approxEqual(result.planEntries[1].expectedAmount, 200, 0.1);
  assert.equal(result.planEntries[1].installmentNumber, 1);
  assert.equal(result.planEntries[1].dueDate, START + MS_PER_DAY);
  assert.equal(result.endDate, null);
});

// ─── Case 6: Zero interest friend loan ─────────────────────────────────

test('Case 6: Zero interest — ₹5K borrowed, 50 days daily, no interest', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 5000,
    repaymentType: 'principal_plus_interest',
    interestType: 'none',
    interestRate: 0,
    interestRatePeriod: 'month',
    frequency: 'daily',
    tenureCount: 50,
    startDate: START,
  };
  const result = computeLoanTerms(input);
  assert.equal(result.principal, 5000);
  assert.equal(result.totalInterest, 0);
  assert.equal(result.totalRepayment, 5000);
  approxEqual(result.emiAmount, 100, 0.01);
  assert.equal(result.installments, 50);
  // Every installment is 100% principal
  assert.equal(result.planEntries[0].interestPortion, 0);
  assert.equal(result.planEntries[0].principalPortion, 100);
  assert.equal(result.planEntries[49].dueDate, START + 50 * MS_PER_DAY);
});

// ─── Validation cases ──────────────────────────────────────────────────

test('Validation: negative disbursedAmount throws', () => {
  assert.throws(() =>
    computeLoanTerms({
      disbursedAmount: -1000,
      repaymentType: 'principal_plus_interest',
      interestType: 'none',
      interestRate: 0,
      interestRatePeriod: 'month',
      frequency: 'daily',
      tenureCount: 10,
      startDate: START,
    }),
  );
});

test('Validation: zero tenure throws', () => {
  assert.throws(() =>
    computeLoanTerms({
      disbursedAmount: 1000,
      repaymentType: 'principal_plus_interest',
      interestType: 'none',
      interestRate: 0,
      interestRatePeriod: 'month',
      frequency: 'daily',
      tenureCount: 0,
      startDate: START,
    }),
  );
});

test('Validation: negative interestRate throws', () => {
  assert.throws(() =>
    computeLoanTerms({
      disbursedAmount: 1000,
      repaymentType: 'principal_plus_interest',
      interestType: 'flat',
      interestRate: -0.01,
      interestRatePeriod: 'month',
      frequency: 'daily',
      tenureCount: 10,
      startDate: START,
    }),
  );
});

// ─── Edge case: monthly front-loaded (money lender style) ──────────────

test('Edge: Money lender ₹25K at 3%/month flat, 6 monthly installments', () => {
  const input: ComputeLoanTermsInput = {
    disbursedAmount: 25000,
    repaymentType: 'principal_plus_interest',
    interestType: 'flat',
    interestRate: 0.03,
    interestRatePeriod: 'month',
    frequency: 'monthly',
    tenureCount: 6,
    startDate: START,
  };
  const result = computeLoanTerms(input);
  // 25000 × 0.03 × 6 = 4500 interest
  approxEqual(result.totalInterest, 4500, 5);
  approxEqual(result.totalRepayment, 29500, 5);
  // 6 monthly installments
  assert.equal(result.installments, 6);
  approxEqual(result.emiAmount, 4916, 5);
});

// ─── Summary ────────────────────────────────────────────────────────────

// eslint-disable-next-line no-console
console.log(`\nloanCalc tests: ${passCount} passed, ${failCount} failed\n`);
if (failCount > 0) {
  process.exit(1);
}
