// src/utils/transferLegs.ts
// Pure helper: turn a transfer form into its two ledger legs — an expense on
// the source account (in the source currency) and an income on the destination
// account (in the destination currency). Keeping the leg shape in one tested
// place means cross-currency transfers always store the correct per-account
// amount instead of a single global amount.

interface TransferAccount {
  id: string;
  name?: string;
  currency?: string;
}

interface TransferLegsInput {
  fromAcc: TransferAccount;
  toAcc: TransferAccount;
  sourceAmount: number; // in fromAcc currency
  toAmount: number;     // in toAcc currency (converted or user-edited)
  transferPairId: string;
  date: string;
  tags?: string[];
  note?: string;
}

export interface TransferLeg {
  type: 'expense' | 'income';
  amount: number;
  categoryId: 'transfer';
  icon: 'repeat';
  recipient: string;
  note: string;
  currency?: string;
  date: string;
  account: string;
  isTransfer: true;
  transferPairId: string;
  tags: string[];
}

export function buildTransferLegs(input: TransferLegsInput): [TransferLeg, TransferLeg] {
  const { fromAcc, toAcc, sourceAmount, toAmount, transferPairId, date, tags = [], note } = input;
  const fromName = fromAcc.name || '';
  const toName = toAcc.name || '';

  const expense: TransferLeg = {
    type: 'expense',
    amount: sourceAmount,
    categoryId: 'transfer',
    icon: 'repeat',
    recipient: toName,
    note: note || `→ ${toName}`,
    currency: fromAcc.currency,
    date,
    account: fromAcc.id,
    isTransfer: true,
    transferPairId,
    tags,
  };

  const income: TransferLeg = {
    type: 'income',
    amount: toAmount,
    categoryId: 'transfer',
    icon: 'repeat',
    recipient: fromName,
    note: note || `← ${fromName}`,
    currency: toAcc.currency,
    date,
    account: toAcc.id,
    isTransfer: true,
    transferPairId,
    tags,
  };

  return [expense, income];
}
