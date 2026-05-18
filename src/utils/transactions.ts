// src/utils/transactions.ts
// Merge transfer pairs into single rows (expense side shown, income side hidden).

import type { Transaction } from '../types';

// A transfer pair after merging carries the two-sided source/target so the
// row can render "Account A → Account B" instead of one half of the pair.
export interface MergedTransfer extends Transaction {
  _mergedTransfer: true;
  _fromAccountName?: string;
  _toAccountName?: string;
}

export function mergeTransferPairs(txs: Transaction[]): (Transaction | MergedTransfer)[] {
  const pairMap: Record<string, { expense?: Transaction; income?: Transaction }> = {};
  for (const tx of txs) {
    if (tx.isTransfer && tx.transferPairId) {
      if (!pairMap[tx.transferPairId]) pairMap[tx.transferPairId] = {};
      // The pair holds the two sides keyed by their transaction type.
      // Transfers only ever have an 'expense' and 'income' side.
      (pairMap[tx.transferPairId] as Record<string, Transaction>)[tx.type] = tx;
    }
  }
  const skipIds = new Set<string>();
  const result: (Transaction | MergedTransfer)[] = [];
  for (const tx of txs) {
    if (skipIds.has(tx.id)) continue;
    if (tx.isTransfer && tx.transferPairId) {
      const pair = pairMap[tx.transferPairId];
      if (pair?.expense && pair?.income) {
        skipIds.add(pair.expense.id);
        skipIds.add(pair.income.id);
        result.push({
          ...pair.expense,
          _mergedTransfer: true,
          _fromAccountName: pair.income.recipient,
          _toAccountName: pair.expense.recipient,
        } as MergedTransfer);
      } else {
        result.push(tx);
      }
    } else {
      result.push(tx);
    }
  }
  return result;
}
