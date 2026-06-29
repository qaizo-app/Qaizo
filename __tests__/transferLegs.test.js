// Tests for buildTransferLegs — the pure helper that turns a transfer form
// into its two ledger legs (expense on source, income on destination).
const { buildTransferLegs } = require('../src/utils/transferLegs');

const base = {
  transferPairId: 'pair123',
  date: '2026-06-29',
  tags: ['trip'],
};

describe('buildTransferLegs', () => {
  test('same currency: both legs carry the same amount and currency', () => {
    const [expense, income] = buildTransferLegs({
      ...base,
      fromAcc: { id: 'a1', name: 'Cash ₪', currency: '₪' },
      toAcc: { id: 'a2', name: 'Bank ₪', currency: '₪' },
      sourceAmount: 500,
      toAmount: 500,
    });

    expect(expense.amount).toBe(500);
    expect(expense.currency).toBe('₪');
    expect(income.amount).toBe(500);
    expect(income.currency).toBe('₪');
  });

  test('different currency: each leg uses its own account amount + currency', () => {
    const [expense, income] = buildTransferLegs({
      ...base,
      fromAcc: { id: 'a1', name: 'Cash ₪', currency: '₪' },
      toAcc: { id: 'a2', name: 'Cash $', currency: '$' },
      sourceAmount: 600,
      toAmount: 168.3,
    });

    // Source leg: debited in shekels
    expect(expense.type).toBe('expense');
    expect(expense.account).toBe('a1');
    expect(expense.amount).toBe(600);
    expect(expense.currency).toBe('₪');

    // Destination leg: credited in dollars (user-edited / converted amount)
    expect(income.type).toBe('income');
    expect(income.account).toBe('a2');
    expect(income.amount).toBe(168.3);
    expect(income.currency).toBe('$');
  });

  test('both legs share transferPairId, isTransfer, transfer category, repeat icon, date, tags', () => {
    const [expense, income] = buildTransferLegs({
      ...base,
      fromAcc: { id: 'a1', name: 'Cash ₪', currency: '₪' },
      toAcc: { id: 'a2', name: 'Cash $', currency: '$' },
      sourceAmount: 600,
      toAmount: 168.3,
    });

    for (const leg of [expense, income]) {
      expect(leg.transferPairId).toBe('pair123');
      expect(leg.isTransfer).toBe(true);
      expect(leg.categoryId).toBe('transfer');
      expect(leg.icon).toBe('repeat');
      expect(leg.date).toBe('2026-06-29');
      expect(leg.tags).toEqual(['trip']);
    }
  });

  test('recipient and default notes point at the partner account', () => {
    const [expense, income] = buildTransferLegs({
      ...base,
      fromAcc: { id: 'a1', name: 'Cash ₪', currency: '₪' },
      toAcc: { id: 'a2', name: 'Cash $', currency: '$' },
      sourceAmount: 600,
      toAmount: 168.3,
    });

    expect(expense.recipient).toBe('Cash $');
    expect(expense.note).toBe('→ Cash $');
    expect(income.recipient).toBe('Cash ₪');
    expect(income.note).toBe('← Cash ₪');
  });

  test('explicit note overrides the default arrow note on both legs', () => {
    const [expense, income] = buildTransferLegs({
      ...base,
      note: 'savings move',
      fromAcc: { id: 'a1', name: 'Cash ₪', currency: '₪' },
      toAcc: { id: 'a2', name: 'Cash $', currency: '$' },
      sourceAmount: 600,
      toAmount: 168.3,
    });

    expect(expense.note).toBe('savings move');
    expect(income.note).toBe('savings move');
  });
});
