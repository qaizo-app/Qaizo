// Tests for the pure pension forecast math.
const {
  monthlyRate, projectSavings, avgMonthlyDeposit,
} = require('../src/utils/pensionForecast');

describe('monthlyRate', () => {
  test('4% annual → ~0.327% monthly (compound)', () => {
    expect(monthlyRate(4)).toBeCloseTo(0.0032737, 6);
  });
  test('0% → 0', () => {
    expect(monthlyRate(0)).toBe(0);
  });
});

describe('projectSavings', () => {
  test('zero return: balance + deposits linearly', () => {
    expect(projectSavings(100000, 0, 12, 0)).toBe(100000);
    expect(projectSavings(100000, 1000, 12, 0)).toBe(112000);
  });

  test('balance-only growth at 4% over 10 years ≈ ×1.4802', () => {
    expect(projectSavings(100000, 0, 120, 4)).toBe(148024);
  });

  test('deposits-only at 4% over 12 months ≈ 12 218', () => {
    expect(projectSavings(0, 1000, 12, 4)).toBe(12218);
  });

  test('zero months → balance as is', () => {
    expect(projectSavings(55555, 9999, 0, 4)).toBe(55555);
  });

  test('garbage inputs treated as zeros', () => {
    expect(projectSavings(NaN, NaN, 12, 0)).toBe(0);
  });
});

describe('avgMonthlyDeposit', () => {
  // Fixed "now": 2026-07-08 → full months are Apr, May, Jun 2026
  const now = new Date(2026, 6, 8);
  const txs = [
    { type: 'income', account: 'a1', amount: 1000, date: '2026-04-15' },
    { type: 'income', account: 'a1', amount: 2000, date: '2026-06-01', isTransfer: true }, // transfer leg counts
    { type: 'income', account: 'a1', amount: 500,  date: '2026-07-05' },  // current month — excluded
    { type: 'income', account: 'a1', amount: 999,  date: '2026-03-31' },  // too old — excluded
    { type: 'expense', account: 'a1', amount: 700, date: '2026-05-10' },  // not income — excluded
    { type: 'income', account: 'a2', amount: 900,  date: '2026-05-10' },  // other account — excluded
  ];

  test('averages the last 3 full months on the linked accounts', () => {
    expect(avgMonthlyDeposit(txs, ['a1'], now)).toBe(1000); // (1000+2000)/3
  });

  test('several linked accounts are summed', () => {
    expect(avgMonthlyDeposit(txs, ['a1', 'a2'], now)).toBe(1300); // (1000+2000+900)/3
  });

  test('no linked accounts → 0', () => {
    expect(avgMonthlyDeposit(txs, [], now)).toBe(0);
  });

  test('falls back to createdAt when date is missing', () => {
    const t = [{ type: 'income', account: 'a1', amount: 300, createdAt: '2026-05-02T10:00:00Z' }];
    expect(avgMonthlyDeposit(t, ['a1'], now)).toBe(100);
  });
});
