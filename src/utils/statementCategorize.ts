// src/utils/statementCategorize.ts
// Pure categorisation: pick a categoryId for a new statement line by
// consulting the user's recent history → active recurring templates → an
// optional AI keyword hint → 'other' as a last resort.
//
// The caller filters history to whatever window is useful (the design says
// last 6 months, but the function itself is window-agnostic).
import type { Recurring, Transaction } from '../types';
import { fuzzyPayee } from './payeeMatch';

export type CategorySource = 'history' | 'recurring' | 'ai' | 'fallback';

export interface CategoryGuess {
  categoryId: string;
  source: CategorySource;
}

export function categorize(
  payee: string | null | undefined,
  history: Transaction[],
  recurring: Recurring[],
  aiHint?: string,
): CategoryGuess {
  if (!payee || !payee.trim()) {
    return { categoryId: 'other', source: 'fallback' };
  }

  // 1. History: most recent transaction with a matching payee
  let bestHistory: Transaction | null = null;
  for (const t of history) {
    if (!t.recipient) continue;
    if (!fuzzyPayee(t.recipient, payee)) continue;
    if (!bestHistory || (t.date || '') > (bestHistory.date || '')) {
      bestHistory = t;
    }
  }
  if (bestHistory) {
    return { categoryId: bestHistory.categoryId, source: 'history' };
  }

  // 2. Recurring template with matching payee
  const recHit = recurring.find(r => fuzzyPayee(r.recipient, payee));
  if (recHit) {
    return { categoryId: recHit.categoryId, source: 'recurring' };
  }

  // 3. AI hint (the caller likely ran parseTransaction or the AI returned it inline)
  if (aiHint) {
    return { categoryId: aiHint, source: 'ai' };
  }

  // 4. Fallback
  return { categoryId: 'other', source: 'fallback' };
}
