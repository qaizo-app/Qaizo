// src/utils/statementReconcile.ts
// Pure reconciliation: classify each extracted statement line against
// transactions already in the app and active recurring templates.
//
// Caller responsibilities:
//   - `existing` is pre-filtered to the same account (typically last 60 days).
//   - `recurring` is pre-filtered to the same account and active.
//   - `extracted.amount` may be signed (negative = charge); we compare absolute values.
import type { Recurring, Transaction } from '../types';
import { fuzzyPayee } from './payeeMatch';

export interface ExtractedTx {
  date: string;
  amount: number;
  payee: string;
  notes?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export type ReconcileResult =
  | { kind: 'exact';     extracted: ExtractedTx; match: Transaction }
  | { kind: 'similar';   extracted: ExtractedTx; candidates: Transaction[] }
  | { kind: 'recurring'; extracted: ExtractedTx; recurring: Recurring; diffPct: number; ambiguous?: Recurring[] }
  | { kind: 'new';       extracted: ExtractedTx };

const DAY_MS = 86_400_000;
const NEAR_DAYS = 2;
const RECURRING_DAYS = 3;
// Recurring templates whose nextDate has already passed (user forgot to
// confirm an upcoming charge) need a wider date window — the bank already
// executed the payment, so the statement row will be days/weeks AFTER the
// scheduled date. Keep this generous enough to catch "missed a month" but
// not so wide it sucks in unrelated past transactions.
const RECURRING_OVERDUE_DAYS = 35;

function dayDiff(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round(Math.abs(da - db) / DAY_MS);
}

function sameAmount(a: number, b: number): boolean {
  return Math.abs(Math.abs(a) - Math.abs(b)) < 0.005;
}

export function reconcile(
  extracted: ExtractedTx[],
  existing: Transaction[],
  recurring: Recurring[],
): ReconcileResult[] {
  return extracted.map((e): ReconcileResult => {
    // 1. exact (amount + date)
    const exact = existing.find(t => sameAmount(t.amount, e.amount) && t.date.slice(0, 10) === e.date);
    if (exact) return { kind: 'exact', extracted: e, match: exact };

    // 2. similar (amount + date within ±NEAR_DAYS)
    const similar = existing.filter(t => sameAmount(t.amount, e.amount) && dayDiff(t.date.slice(0, 10), e.date) <= NEAR_DAYS);
    if (similar.length > 0) return { kind: 'similar', extracted: e, candidates: similar };

    // 3. recurring (active + payee fuzzy; amount IGNORED).
    // Date matching has two cases:
    //   A) on-schedule — statement row is within ±RECURRING_DAYS of nextDate
    //      (the normal "this is my monthly transfer" case)
    //   B) overdue — nextDate is already in the past (user missed confirming)
    //      and the statement row is AFTER nextDate, within RECURRING_OVERDUE_DAYS.
    //      This catches "I forgot to confirm the kupat gemel transfer last
    //      month and now it's on the bank statement" — we want the user to
    //      confirm it through the recurring template so the schedule advances,
    //      not paste it in as a one-off transaction.
    const recHits = recurring.filter(r => {
      if (!r.isActive) return false;
      if (!fuzzyPayee(r.recipient, e.payee)) return false;
      const next = r.nextDate.slice(0, 10);
      const stmt = e.date;
      const diff = dayDiff(next, stmt);
      if (diff <= RECURRING_DAYS) return true;
      if (stmt > next && diff <= RECURRING_OVERDUE_DAYS) return true;
      return false;
    });
    if (recHits.length === 1) {
      const r = recHits[0];
      const diffPct = r.amount > 0 ? Math.abs(r.amount - Math.abs(e.amount)) / r.amount : 0;
      return { kind: 'recurring', extracted: e, recurring: r, diffPct };
    }
    if (recHits.length > 1) {
      const r = recHits[0];
      const diffPct = r.amount > 0 ? Math.abs(r.amount - Math.abs(e.amount)) / r.amount : 0;
      return { kind: 'recurring', extracted: e, recurring: r, diffPct, ambiguous: recHits };
    }

    // 4. nothing matched
    return { kind: 'new', extracted: e };
  });
}
