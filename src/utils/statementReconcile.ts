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

    // 3. recurring (active + payee fuzzy + date within ±RECURRING_DAYS; amount IGNORED)
    const recHits = recurring.filter(r =>
      r.isActive
      && fuzzyPayee(r.recipient, e.payee)
      && dayDiff(r.nextDate.slice(0, 10), e.date) <= RECURRING_DAYS
    );
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
