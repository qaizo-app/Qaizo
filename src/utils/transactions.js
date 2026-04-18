// src/utils/transactions.js
// Merge transfer pairs into single rows (expense side shown, income side hidden)

export function mergeTransferPairs(txs) {
  const pairMap = {};
  for (const tx of txs) {
    if (tx.isTransfer && tx.transferPairId) {
      if (!pairMap[tx.transferPairId]) pairMap[tx.transferPairId] = {};
      pairMap[tx.transferPairId][tx.type] = tx;
    }
  }
  const skipIds = new Set();
  const result = [];
  for (const tx of txs) {
    if (skipIds.has(tx.id)) continue;
    if (tx.isTransfer && tx.transferPairId) {
      const pair = pairMap[tx.transferPairId];
      if (pair.expense && pair.income) {
        skipIds.add(pair.expense.id);
        skipIds.add(pair.income.id);
        result.push({
          ...pair.expense,
          _mergedTransfer: true,
          _fromAccountName: pair.income.recipient,
          _toAccountName: pair.expense.recipient,
        });
      } else {
        result.push(tx);
      }
    } else {
      result.push(tx);
    }
  }
  return result;
}
