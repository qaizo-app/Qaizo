// __tests__/statementReconcile.test.js
const { reconcile } = require('../src/utils/statementReconcile');

// Helpers
const tx = (overrides) => ({
  id: overrides.id || 'tx_' + Math.random().toString(36).slice(2, 8),
  type: 'expense',
  amount: 100,
  date: '2026-05-20',
  account: 'acc1',
  categoryId: 'food',
  recipient: 'Shop',
  ...overrides,
});

const rec = (overrides) => ({
  id: overrides.id || 'rec_' + Math.random().toString(36).slice(2, 8),
  type: 'expense',
  amount: 150,
  account: 'acc1',
  categoryId: 'phone',
  recipient: 'Cellcom',
  nextDate: '2026-05-28',
  isActive: true,
  ...overrides,
});

describe('reconcile', () => {
  test('exact match: same amount and same date', () => {
    const extracted = [{ date: '2026-05-20', amount: -100, payee: 'Shop' }];
    const existing = [tx({ amount: 100, date: '2026-05-20' })];
    const r = reconcile(extracted, existing, []);
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('exact');
    expect(r[0].match.id).toBe(existing[0].id);
  });

  test('similar match: same amount, date within ±2 days', () => {
    const extracted = [{ date: '2026-05-22', amount: -100, payee: 'Shop' }];
    const existing = [tx({ amount: 100, date: '2026-05-20' })];
    const r = reconcile(extracted, existing, []);
    expect(r[0].kind).toBe('similar');
    expect(r[0].candidates).toHaveLength(1);
  });

  test('similar match collects multiple candidates within window', () => {
    const extracted = [{ date: '2026-05-21', amount: -100, payee: 'Shop' }];
    const existing = [
      tx({ id: 'a', amount: 100, date: '2026-05-20' }),
      tx({ id: 'b', amount: 100, date: '2026-05-22' }),
    ];
    const r = reconcile(extracted, existing, []);
    expect(r[0].kind).toBe('similar');
    expect(r[0].candidates.map(t => t.id).sort()).toEqual(['a', 'b']);
  });

  test('beyond ±2 days is NOT similar', () => {
    const extracted = [{ date: '2026-05-25', amount: -100, payee: 'Shop' }];
    const existing = [tx({ amount: 100, date: '2026-05-20' })];
    const r = reconcile(extracted, existing, []);
    expect(r[0].kind).toBe('new');
  });

  test('recurring match: payee + date within ±3 days, amount different', () => {
    const extracted = [{ date: '2026-05-29', amount: -152, payee: 'Cellcom *124' }];
    const recurring = [rec({ recipient: 'Cellcom', amount: 150, nextDate: '2026-05-28' })];
    const r = reconcile(extracted, [], recurring);
    expect(r[0].kind).toBe('recurring');
    expect(r[0].recurring.id).toBe(recurring[0].id);
    expect(r[0].diffPct).toBeCloseTo(0.0133, 3);
  });

  test('recurring match: inactive templates are ignored', () => {
    const extracted = [{ date: '2026-05-28', amount: -150, payee: 'Cellcom' }];
    const recurring = [rec({ recipient: 'Cellcom', isActive: false })];
    const r = reconcile(extracted, [], recurring);
    expect(r[0].kind).toBe('new');
  });

  test('recurring match: ambiguous when 2+ templates match', () => {
    const extracted = [{ date: '2026-05-28', amount: -250, payee: 'Hapoalim' }];
    const recurring = [
      rec({ id: 'r1', recipient: 'Hapoalim Bank Fee', amount: 50, nextDate: '2026-05-28' }),
      rec({ id: 'r2', recipient: 'Hapoalim Loan', amount: 1200, nextDate: '2026-05-28' }),
    ];
    const r = reconcile(extracted, [], recurring);
    expect(r[0].kind).toBe('recurring');
    expect(r[0].ambiguous?.map(x => x.id).sort()).toEqual(['r1', 'r2']);
  });

  test('recurring overdue: statement after nextDate by 10 days still matches', () => {
    // Real scenario: user has a kupat-gemel transfer scheduled for 2026-05-05
    // but forgot to confirm. Bank executed anyway, statement shows 2026-05-15.
    // Without the overdue window this falls to 'new' and the recurring schedule
    // never advances.
    const extracted = [{ date: '2026-05-15', amount: -1000, payee: 'Kupat Gemel' }];
    const recurring = [rec({ recipient: 'Kupat Gemel', amount: 1000, nextDate: '2026-05-05' })];
    const r = reconcile(extracted, [], recurring);
    expect(r[0].kind).toBe('recurring');
    expect(r[0].recurring.id).toBe(recurring[0].id);
  });

  test('recurring overdue: statement 40 days after nextDate does NOT match', () => {
    // Too long ago — this is more likely an unrelated past transaction, not
    // the missed execution of this recurring.
    const extracted = [{ date: '2026-06-15', amount: -1000, payee: 'Kupat Gemel' }];
    const recurring = [rec({ recipient: 'Kupat Gemel', amount: 1000, nextDate: '2026-05-05' })];
    const r = reconcile(extracted, [], recurring);
    expect(r[0].kind).toBe('new');
  });

  test('recurring future: statement BEFORE nextDate by 10 days does NOT match', () => {
    // The recurring is not yet due. A row 10 days before its scheduled date
    // is too far to be the upcoming execution — keep narrow window in this
    // direction to avoid false positives.
    const extracted = [{ date: '2026-05-18', amount: -1000, payee: 'Kupat Gemel' }];
    const recurring = [rec({ recipient: 'Kupat Gemel', amount: 1000, nextDate: '2026-05-28' })];
    const r = reconcile(extracted, [], recurring);
    expect(r[0].kind).toBe('new');
  });

  test('no match → new', () => {
    const extracted = [{ date: '2026-05-20', amount: -42, payee: 'Random Shop' }];
    const r = reconcile(extracted, [], []);
    expect(r[0].kind).toBe('new');
  });

  test('exact match precedence over similar', () => {
    const extracted = [{ date: '2026-05-20', amount: -100, payee: 'Shop' }];
    const existing = [
      tx({ id: 'a', amount: 100, date: '2026-05-20' }),
      tx({ id: 'b', amount: 100, date: '2026-05-21' }),
    ];
    const r = reconcile(extracted, existing, []);
    expect(r[0].kind).toBe('exact');
    expect(r[0].match.id).toBe('a');
  });

  test('exact match precedence over recurring', () => {
    const extracted = [{ date: '2026-05-28', amount: -150, payee: 'Cellcom' }];
    const existing = [tx({ amount: 150, date: '2026-05-28', recipient: 'Cellcom' })];
    const recurring = [rec({ recipient: 'Cellcom', amount: 150, nextDate: '2026-05-28' })];
    const r = reconcile(extracted, existing, recurring);
    expect(r[0].kind).toBe('exact');
  });

  test('extracted.amount sign is normalized (negative = charge)', () => {
    // Caller may pass signed amounts; reconcile compares by absolute amount.
    const extracted = [{ date: '2026-05-20', amount: -100, payee: 'Shop' }];
    const existing = [tx({ amount: 100, date: '2026-05-20' })];
    const r = reconcile(extracted, existing, []);
    expect(r[0].kind).toBe('exact');
  });

  test('multiple extracted entries handled independently', () => {
    const extracted = [
      { date: '2026-05-20', amount: -100, payee: 'A' },
      { date: '2026-05-21', amount: -50,  payee: 'B' },
    ];
    const existing = [tx({ amount: 100, date: '2026-05-20' })];
    const r = reconcile(extracted, existing, []);
    expect(r).toHaveLength(2);
    expect(r[0].kind).toBe('exact');
    expect(r[1].kind).toBe('new');
  });

  test('empty inputs return empty result', () => {
    expect(reconcile([], [], [])).toEqual([]);
  });
});
