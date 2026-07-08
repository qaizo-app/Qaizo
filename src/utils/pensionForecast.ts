// src/utils/pensionForecast.ts
// Pure pension-forecast math. No React, no Firebase — fully unit-tested.
// Simplifications are deliberate (stated in the in-app disclaimer): whole
// calendar years for age, no fees/inflation/tax, single editable annuity
// coefficient instead of actuarial tables.

import type { Transaction } from '../types';

export const DEFAULT_ANNUAL_RETURN_PCT = 4;
export const DEFAULT_ANNUITY_COEF = 200;

export function monthlyRate(annualPct: number): number {
  const pct = Number.isFinite(annualPct) ? annualPct : 0;
  return Math.pow(1 + pct / 100, 1 / 12) - 1;
}

// FV = balance·(1+r)^n + deposit·((1+r)^n − 1)/r ; r=0 → balance + deposit·n
export function projectSavings(balance: number, monthlyDeposit: number, months: number, annualPct: number): number {
  const n = Math.max(0, Math.round(months));
  const b = Number.isFinite(balance) ? balance : 0;
  const d = Number.isFinite(monthlyDeposit) ? monthlyDeposit : 0;
  if (n === 0) return Math.round(b);
  const r = monthlyRate(annualPct);
  if (r === 0) return Math.round(b + d * n);
  const growth = Math.pow(1 + r, n);
  return Math.round(b * growth + d * ((growth - 1) / r));
}

// Mean of the last 3 FULL months of income-type transactions (transfer
// income legs included) landing on the given accounts. The current month is
// partial and would understate the figure, so it is excluded. Not rounded.
export function avgMonthlyDeposit(transactions: Transaction[], accountIds: string[], now: Date = new Date()): number {
  if (!accountIds || accountIds.length === 0) return 0;
  const idSet = new Set(accountIds);
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1); // exclusive
  let total = 0;
  for (const t of transactions || []) {
    if (t.type !== 'income') continue;
    if (!t.account || !idSet.has(t.account)) continue;
    const td = new Date(t.date || t.createdAt || 0);
    if (isNaN(td.getTime()) || td < start || td >= end) continue;
    total += t.amount || 0;
  }
  return total / 3;
}
