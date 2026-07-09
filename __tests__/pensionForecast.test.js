// Tests for the pure pension forecast math.
const {
  monthlyRate, projectSavings, avgMonthlyDeposit, forecastProfile, forecastFamily,
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

  test('boundary days: 1st of a window month included, 1st of current month excluded', () => {
    const t = [
      { type: 'income', account: 'a1', amount: 600, date: '2026-04-01' },
      { type: 'income', account: 'a1', amount: 900, date: '2026-07-01' },
    ];
    expect(avgMonthlyDeposit(t, ['a1'], now)).toBe(200); // only the 600 counts
  });

  test('fractional average is not rounded', () => {
    const t = [{ type: 'income', account: 'a1', amount: 100, date: '2026-05-10' }];
    expect(avgMonthlyDeposit(t, ['a1'], now)).toBeCloseTo(33.3333, 3);
  });
});

describe('forecastProfile', () => {
  const now = new Date(2026, 6, 8); // age = 2026 - birthYear
  const accounts = [
    { id: 'pen1', type: 'investment', balance: 100000 },
    { id: 'cap1', type: 'investment', balance: 50000 },
  ];
  const baseProfile = {
    id: 'p1', name: 'Alex', birthYear: 1980, retireAge: 56, // age 46 → 120 months
    annualReturnPct: 4, annuityCoef: 200,
    links: [
      { accountId: 'pen1', basket: 'pension' },
      { accountId: 'cap1', basket: 'capital' },
      { accountId: 'ghost', basket: 'pension' }, // deleted account — ignored
    ],
  };

  test('no deposits: balances grow, annuity = projected/coef', () => {
    const f = forecastProfile(baseProfile, accounts, [], now);
    expect(f.currentAge).toBe(46);
    expect(f.months).toBe(120);
    expect(f.alreadyEligible).toBe(false);
    expect(f.pension.current).toBe(100000);
    expect(f.pension.projected).toBe(148024);           // ×1.04^10
    expect(f.pension.annuity).toBe(Math.round(148024 / 200)); // 740
    expect(f.capital.projected).toBe(74012);            // 50000 ×1.04^10
  });

  test('auto deposits flow into the right basket', () => {
    const txs = [
      { type: 'income', account: 'pen1', amount: 3000, date: '2026-05-10' },
      { type: 'income', account: 'cap1', amount: 1500, date: '2026-06-10' },
    ];
    const f = forecastProfile(baseProfile, accounts, txs, now);
    expect(f.monthlyAuto).toEqual({ pension: 1000, capital: 500 });
    expect(f.monthlyUsed).toEqual({ pension: 1000, capital: 500 });
  });

  test('monthlyOverride replaces the total, split ∝ auto shares', () => {
    const txs = [
      { type: 'income', account: 'pen1', amount: 9000, date: '2026-05-10' }, // auto 3000
      { type: 'income', account: 'cap1', amount: 3000, date: '2026-06-10' }, // auto 1000
    ];
    const f = forecastProfile({ ...baseProfile, monthlyOverride: 2000 }, accounts, txs, now);
    expect(f.monthlyUsed).toEqual({ pension: 1500, capital: 500 });
  });

  test('override with zero auto shares → all to pension', () => {
    const f = forecastProfile({ ...baseProfile, monthlyOverride: 1200 }, accounts, [], now);
    expect(f.monthlyUsed).toEqual({ pension: 1200, capital: 0 });
  });

  test('retireAgeOverride recomputes without touching the profile', () => {
    const f = forecastProfile(baseProfile, accounts, [], now, 66); // 240 months
    expect(f.months).toBe(240);
  });

  test('already eligible: projected = current, annuity from current pot', () => {
    const f = forecastProfile({ ...baseProfile, birthYear: 1950 }, accounts, [], now); // age 76 > 56
    expect(f.alreadyEligible).toBe(true);
    expect(f.months).toBe(0);
    expect(f.pension.projected).toBe(100000);
    expect(f.pension.annuity).toBe(500); // 100000/200
  });

  test('defaults: return 4%, coef 200 when fields absent', () => {
    const p = { id: 'p2', name: 'X', birthYear: 1980, retireAge: 56, links: [{ accountId: 'pen1', basket: 'pension' }] };
    const f = forecastProfile(p, accounts, [], now);
    expect(f.pension.projected).toBe(148024);
    expect(f.pension.annuity).toBe(740);
  });

  test('inactive accounts are ignored even when linked (matches dashboard convention)', () => {
    const accountsWithInactive = [...accounts, { id: 'dead1', type: 'investment', balance: 77777, isActive: false }];
    const profile = { ...baseProfile, links: [...baseProfile.links, { accountId: 'dead1', basket: 'pension' }] };
    const f = forecastProfile(profile, accountsWithInactive, [], now);
    expect(f.pension.current).toBe(100000); // dead1's 77777 excluded
  });

  test('retireAge missing on profile defaults to 67', () => {
    const p = { id: 'p3', name: 'Z', birthYear: 1980, links: [] }; // no retireAge field
    const f = forecastProfile(p, accounts, [], now);
    expect(f.months).toBe(252); // (67-46)*12
  });
});

describe('forecastFamily', () => {
  const now = new Date(2026, 6, 8);
  const accounts = [
    { id: 'pen1', type: 'investment', balance: 100000 },
    { id: 'pen2', type: 'investment', balance: 100000 },
  ];
  const p1 = { id: 'p1', name: 'A', birthYear: 1980, retireAge: 56, annualReturnPct: 4, annuityCoef: 200, links: [{ accountId: 'pen1', basket: 'pension' }] };
  const p2 = { id: 'p2', name: 'B', birthYear: 1980, retireAge: 56, annualReturnPct: 0, annuityCoef: 200, links: [{ accountId: 'pen2', basket: 'pension' }] };

  test('sums per-profile results at each profile own settings', () => {
    const fam = forecastFamily([p1, p2], accounts, [], now);
    expect(fam.pension.current).toBe(200000);
    expect(fam.pension.projected).toBe(148024 + 100000);
    expect(fam.pension.annuity).toBe(740 + 500);
  });
});
