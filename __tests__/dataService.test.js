// __tests__/dataService.test.js
// Тесты dataService в гостевом режиме (AsyncStorage)

// Гостевой режим — uid = null
jest.mock('../src/services/authService', () => ({
  default: { getUid: () => null },
  getUid: () => null,
}));

jest.mock('../src/config/firebase', () => ({
  db: {}, auth: {},
}));

const mockStorage = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(key => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key, val) => { mockStorage[key] = val; return Promise.resolve(); }),
  removeItem: jest.fn(key => { delete mockStorage[key]; return Promise.resolve(); }),
  multiRemove: jest.fn(keys => { keys.forEach(k => delete mockStorage[k]); return Promise.resolve(); }),
}));

const dataService = require('../src/services/dataService').default;

describe('dataService (guest mode)', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  });

  // ─── TRANSACTIONS ────────────────────────────
  test('getTransactions returns empty array by default', async () => {
    const txs = await dataService.getTransactions();
    expect(txs).toEqual([]);
  });

  test('addTransaction creates and returns transaction', async () => {
    const tx = await dataService.addTransaction({
      type: 'expense', amount: 100, categoryId: 'food',
      date: '2026-01-01T00:00:00.000Z', account: null,
    });
    expect(tx).not.toBeNull();
    expect(tx.id).toBeDefined();
    expect(tx.amount).toBe(100);
    expect(tx.createdAt).toBeDefined();

    const txs = await dataService.getTransactions();
    expect(txs.length).toBe(1);
    expect(txs[0].id).toBe(tx.id);
  });

  test('deleteTransaction removes transaction', async () => {
    const tx = await dataService.addTransaction({
      type: 'expense', amount: 50, categoryId: 'transport',
    });
    expect(await dataService.getTransactions()).toHaveLength(1);

    await dataService.deleteTransaction(tx.id);
    expect(await dataService.getTransactions()).toHaveLength(0);
  });

  test('deleteTransaction cascades transfer pair', async () => {
    const pairId = 'test_pair_123';
    await dataService.addTransaction({
      type: 'expense', amount: 200, categoryId: 'transfer',
      isTransfer: true, transferPairId: pairId,
    });
    await dataService.addTransaction({
      type: 'income', amount: 200, categoryId: 'transfer',
      isTransfer: true, transferPairId: pairId,
    });
    expect(await dataService.getTransactions()).toHaveLength(2);

    const txs = await dataService.getTransactions();
    await dataService.deleteTransaction(txs[0].id);

    // Both should be deleted
    expect(await dataService.getTransactions()).toHaveLength(0);
  });

  test('updateTransaction modifies transaction', async () => {
    const tx = await dataService.addTransaction({
      type: 'expense', amount: 100, categoryId: 'food',
    });
    await dataService.updateTransaction(tx.id, { amount: 200 });

    const txs = await dataService.getTransactions();
    expect(txs[0].amount).toBe(200);
  });

  // ─── ACCOUNTS ─────────────────────────────────
  test('getAccounts returns defaults', async () => {
    const accs = await dataService.getAccounts();
    expect(accs.length).toBeGreaterThan(0);
    expect(accs[0].id).toBe('cash_ils');
  });

  test('addAccount and deleteAccount', async () => {
    const acc = await dataService.addAccount({
      name: 'Test Bank', type: 'bank', balance: 5000, currency: '₪',
    });
    expect(acc.id).toBeDefined();

    const accs = await dataService.getAccounts();
    expect(accs.find(a => a.id === acc.id)).toBeDefined();

    await dataService.deleteAccount(acc.id);
    const after = await dataService.getAccounts();
    expect(after.find(a => a.id === acc.id)).toBeUndefined();
  });

  // ─── BUDGETS ──────────────────────────────────
  test('budgets CRUD', async () => {
    expect(await dataService.getBudgets()).toEqual({});

    await dataService.setBudget('food', 2000);
    const budgets = await dataService.getBudgets();
    expect(budgets.food).toBe(2000);

    await dataService.deleteBudget('food');
    expect(await dataService.getBudgets()).toEqual({});
  });

  // ─── STREAKS ──────────────────────────────────
  test('streaks CRUD', async () => {
    const defaults = await dataService.getStreaks();
    expect(defaults.currentStreak).toBe(0);

    await dataService.saveStreaks({ currentStreak: 5, longestStreak: 10, lastActiveDate: '2026-03-27', underBudgetStreak: 2, longestUnderBudget: 5, milestones: [3] });
    const streaks = await dataService.getStreaks();
    expect(streaks.currentStreak).toBe(5);
    expect(streaks.milestones).toContain(3);
  });

  // ─── SETTINGS ─────────────────────────────────
  test('settings get/save', async () => {
    const s = await dataService.getSettings();
    expect(s.language).toBe('ru');

    await dataService.saveSettings({ ...s, language: 'en', weekStart: 'sunday' });
    const s2 = await dataService.getSettings();
    expect(s2.language).toBe('en');
    expect(s2.weekStart).toBe('sunday');
  });

  // ─── EXPORT/CLEAR ─────────────────────────────
  test('exportData returns all data', async () => {
    await dataService.addTransaction({ type: 'expense', amount: 100, categoryId: 'food' });
    const data = await dataService.exportData();
    expect(data.transactions.length).toBe(1);
    expect(data.accounts).toBeDefined();
    expect(data.exportedAt).toBeDefined();
  });

  test('clearAllData empties everything', async () => {
    await dataService.addTransaction({ type: 'expense', amount: 100, categoryId: 'food' });
    await dataService.setBudget('food', 1000);
    await dataService.clearAllData();
    expect(await dataService.getTransactions()).toEqual([]);
    expect(await dataService.getBudgets()).toEqual({});
  });
});
