// __tests__/streakService.test.js
// Тесты расчёта стриков — чистые функции без Firebase

// Мокаем dataService
jest.mock('../src/services/dataService', () => ({
  getStreaks: jest.fn(() => Promise.resolve({
    currentStreak: 0, longestStreak: 0, lastActiveDate: null,
    underBudgetStreak: 0, longestUnderBudget: 0, milestones: [],
  })),
  saveStreaks: jest.fn(() => Promise.resolve(true)),
}));

const streakService = require('../src/services/streakService').default;
const dataService = require('../src/services/dataService');

function makeTx(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id: `tx_${daysAgo}`,
    type: 'expense',
    amount: 50,
    categoryId: 'food',
    date: d.toISOString(),
    createdAt: d.toISOString(),
  };
}

describe('streakService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dataService.getStreaks.mockResolvedValue({
      currentStreak: 0, longestStreak: 0, lastActiveDate: null,
      underBudgetStreak: 0, longestUnderBudget: 0, milestones: [],
    });
  });

  test('empty transactions = streak 0', async () => {
    const result = await streakService.updateStreaks([]);
    expect(result.streakData.currentStreak).toBe(0);
  });

  test('transaction today = streak 1', async () => {
    const result = await streakService.updateStreaks([makeTx(0)]);
    expect(result.streakData.currentStreak).toBe(1);
  });

  test('transactions today + yesterday = streak 2', async () => {
    const result = await streakService.updateStreaks([makeTx(0), makeTx(1)]);
    expect(result.streakData.currentStreak).toBe(2);
  });

  test('3 consecutive days = streak 3, milestone triggered', async () => {
    const result = await streakService.updateStreaks([makeTx(0), makeTx(1), makeTx(2)]);
    expect(result.streakData.currentStreak).toBe(3);
    expect(result.newMilestone).toBe(3);
    expect(result.streakData.milestones).toContain(3);
  });

  test('gap breaks streak', async () => {
    // today, yesterday, 3 days ago (skip day 2)
    const result = await streakService.updateStreaks([makeTx(0), makeTx(1), makeTx(3)]);
    expect(result.streakData.currentStreak).toBe(2);
  });

  test('no transaction today but yesterday = streak still alive', async () => {
    const result = await streakService.updateStreaks([makeTx(1), makeTx(2), makeTx(3)]);
    expect(result.streakData.currentStreak).toBe(3);
  });

  test('longestStreak is preserved', async () => {
    dataService.getStreaks.mockResolvedValue({
      currentStreak: 10, longestStreak: 20, lastActiveDate: null,
      underBudgetStreak: 0, longestUnderBudget: 0, milestones: [],
    });
    const result = await streakService.updateStreaks([makeTx(0)]);
    expect(result.streakData.longestStreak).toBe(20);
  });

  test('milestone not re-triggered', async () => {
    dataService.getStreaks.mockResolvedValue({
      currentStreak: 2, longestStreak: 5, lastActiveDate: null,
      underBudgetStreak: 0, longestUnderBudget: 0, milestones: [3],
    });
    const result = await streakService.updateStreaks([makeTx(0), makeTx(1), makeTx(2)]);
    expect(result.streakData.currentStreak).toBe(3);
    expect(result.newMilestone).toBeNull(); // 3 already in milestones
  });

  test('isStreakAtRisk', () => {
    const today = streakService.todayStr();
    // Active today — not at risk
    expect(streakService.isStreakAtRisk({ currentStreak: 5, lastActiveDate: today })).toBe(false);
    // Not active today, streak > 0 — depends on hour (can't control hour in test)
    // Just verify it returns boolean
    const result = streakService.isStreakAtRisk({ currentStreak: 5, lastActiveDate: '2020-01-01' });
    expect(typeof result).toBe('boolean');
  });

  test('isStreakAtRisk returns false when no streak', () => {
    expect(streakService.isStreakAtRisk(null)).toBe(false);
    expect(streakService.isStreakAtRisk({ currentStreak: 0, lastActiveDate: null })).toBe(false);
  });

  test('todayStr returns YYYY-MM-DD format', () => {
    const today = streakService.todayStr();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('getLocalDate converts ISO to YYYY-MM-DD', () => {
    const local = streakService.getLocalDate('2026-04-09T15:30:00.000Z');
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // ─── under-budget streaks ────────────────────
  test('under-budget streak: balance <= 0 returns 0', async () => {
    const txs = [
      { type: 'income', amount: 100, date: new Date().toISOString() },
      { type: 'expense', amount: 200, date: new Date().toISOString() },
    ];
    const result = await streakService.updateStreaks(txs);
    expect(result.streakData.underBudgetStreak).toBe(0);
  });

  test('under-budget streak: positive balance with no spending today', async () => {
    // Income 10000, no expenses → daily budget high → today underBudget=1
    const txs = [
      { type: 'income', amount: 10000, date: new Date().toISOString() },
    ];
    const result = await streakService.updateStreaks(txs);
    expect(result.streakData.underBudgetStreak).toBeGreaterThanOrEqual(1);
  });

  test('under-budget streak: longestUnderBudget preserved', async () => {
    dataService.getStreaks.mockResolvedValue({
      currentStreak: 0, longestStreak: 0, lastActiveDate: null,
      underBudgetStreak: 0, longestUnderBudget: 50, milestones: [],
    });
    const txs = [{ type: 'income', amount: 1000, date: new Date().toISOString() }];
    const result = await streakService.updateStreaks(txs);
    expect(result.streakData.longestUnderBudget).toBeGreaterThanOrEqual(50);
  });

  // ─── milestones progression ──────────────────
  test('multiple milestones: 7-day streak triggers 7 milestone', async () => {
    const txs = Array.from({ length: 7 }, (_, i) => makeTx(i));
    const result = await streakService.updateStreaks(txs);
    expect(result.streakData.currentStreak).toBe(7);
    expect(result.streakData.milestones).toContain(3);
    expect(result.streakData.milestones).toContain(7);
    expect(result.newMilestone).toBe(7);
  });

  // ─── error handling ──────────────────────────
  test('updateStreaks handles dataService errors', async () => {
    dataService.getStreaks.mockRejectedValue(new Error('storage error'));
    const result = await streakService.updateStreaks([makeTx(0)]);
    expect(result.streakData.currentStreak).toBe(0);
    expect(result.newMilestone).toBeNull();
  });

  // ─── save optimization ───────────────────────
  test('does not save when nothing changed', async () => {
    dataService.getStreaks.mockResolvedValue({
      currentStreak: 0, longestStreak: 0, lastActiveDate: null,
      underBudgetStreak: 0, longestUnderBudget: 0, milestones: [],
    });
    await streakService.updateStreaks([]);
    expect(dataService.saveStreaks).not.toHaveBeenCalled();
  });
});
