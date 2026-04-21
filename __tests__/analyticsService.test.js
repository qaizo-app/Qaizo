// __tests__/analyticsService.test.js
// Тесты для analyticsService — focus на getAccountBalanceHistory
jest.mock('../src/config/firebase', () => ({ db: {}, auth: {} }));
jest.mock('../src/services/authService', () => ({ default: { getUid: () => null }, getUid: () => null }));

const analyticsService = require('../src/services/analyticsService').default;

// Helper: build a tx with sensible defaults
const tx = (opts) => ({
  id: opts.id || Math.random().toString(36),
  account: opts.account || 'acc1',
  type: opts.type || 'expense',
  amount: opts.amount || 0,
  date: opts.date,
  ...opts,
});

describe('getAccountBalanceHistory', () => {
  test('returns empty-ish array when no transactions', () => {
    const result = analyticsService.getAccountBalanceHistory([], 'acc1', 1000, 30);
    expect(result.length).toBe(31);
    // All points equal current balance — no movement
    result.forEach(p => expect(p.balance).toBe(1000));
  });

  test('last point equals currentBalance', () => {
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const txs = [
      tx({ account: 'acc1', type: 'income', amount: 500, date: yesterday.toISOString() }),
    ];
    const result = analyticsService.getAccountBalanceHistory(txs, 'acc1', 1500, 30);
    expect(result[result.length - 1].balance).toBe(1500);
  });

  test('reconstructs balance history backwards from current', () => {
    const now = new Date();
    const d3 = new Date(now); d3.setDate(now.getDate() - 3);
    const d1 = new Date(now); d1.setDate(now.getDate() - 1);
    const txs = [
      tx({ account: 'acc1', type: 'expense', amount: 100, date: d3.toISOString() }), // -100 3 days ago
      tx({ account: 'acc1', type: 'income', amount: 500, date: d1.toISOString() }),  // +500 yesterday
    ];
    // Current balance 1000 → yesterday before income: 500 → 3-days-ago before expense: 600 → before that: 700
    const result = analyticsService.getAccountBalanceHistory(txs, 'acc1', 1000, 5);
    const last = result[result.length - 1];
    const yesterday = result[result.length - 2];
    const dayBeforeYesterday = result[result.length - 3];
    const threeDaysAgo = result[result.length - 4];
    const fourDaysAgo = result[result.length - 5];
    expect(last.balance).toBe(1000);          // today
    expect(yesterday.balance).toBe(1000);     // yesterday (day of +500 — closes at 1000)
    expect(dayBeforeYesterday.balance).toBe(500); // day before yesterday (no tx → inherits from 3-days-ago close)
    expect(threeDaysAgo.balance).toBe(500);   // 3 days ago (day of -100 — closes at 500)
    expect(fourDaysAgo.balance).toBe(600);    // 4 days ago (before the -100)
  });

  test('filters by accountId — other accounts ignored', () => {
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const txs = [
      tx({ account: 'acc1', type: 'income', amount: 100, date: yesterday.toISOString() }),
      tx({ account: 'acc2', type: 'income', amount: 9999, date: yesterday.toISOString() }), // different account
    ];
    const result = analyticsService.getAccountBalanceHistory(txs, 'acc1', 500, 5);
    const last = result[result.length - 1];
    const prev = result[result.length - 3]; // 2 days ago
    expect(last.balance).toBe(500);
    expect(prev.balance).toBe(400); // 500 - 100, only acc1's tx affects
  });

  test('ignores future transactions', () => {
    const now = new Date();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const txs = [
      tx({ account: 'acc1', type: 'income', amount: 500, date: tomorrow.toISOString() }),
    ];
    const result = analyticsService.getAccountBalanceHistory(txs, 'acc1', 1000, 5);
    // Future tx should not affect history
    result.forEach(p => expect(p.balance).toBe(1000));
  });

  test('handles multiple transactions on same day', () => {
    const now = new Date();
    const d1 = new Date(now); d1.setDate(now.getDate() - 1);
    const txs = [
      tx({ account: 'acc1', type: 'income', amount: 100, date: d1.toISOString() }),
      tx({ account: 'acc1', type: 'expense', amount: 30, date: d1.toISOString() }),
    ];
    // Net +70 yesterday. Current 200 → before that: 130
    const result = analyticsService.getAccountBalanceHistory(txs, 'acc1', 200, 5);
    const last = result[result.length - 1];
    const beforeYesterday = result[result.length - 3];
    expect(last.balance).toBe(200);
    expect(beforeYesterday.balance).toBe(130);
  });
});
