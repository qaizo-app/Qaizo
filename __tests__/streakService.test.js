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
});
