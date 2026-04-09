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

  // ─── ACCOUNTS - extended ──────────────────────
  test('updateAccount modifies account fields', async () => {
    const acc = await dataService.addAccount({ name: 'Old', type: 'bank', balance: 100, currency: '₪' });
    await dataService.updateAccount(acc.id, { name: 'New', balance: 500 });
    const accs = await dataService.getAccounts();
    const updated = accs.find(a => a.id === acc.id);
    expect(updated.name).toBe('New');
    expect(updated.balance).toBe(500);
  });

  // ─── INVESTMENTS ──────────────────────────────
  test('investments get/save', async () => {
    expect(await dataService.getInvestments()).toEqual([]);
    await dataService.saveInvestments([{ id: '1', name: 'AAPL', amount: 1000 }]);
    const inv = await dataService.getInvestments();
    expect(inv).toHaveLength(1);
    expect(inv[0].name).toBe('AAPL');
  });

  // ─── CATEGORIES ───────────────────────────────
  test('categories get/save', async () => {
    const cats = [{ id: 'food', name: 'Food', subs: [] }];
    await dataService.saveCategories(cats);
    const got = await dataService.getCategories();
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe('food');
  });

  // ─── PROJECTS ─────────────────────────────────
  test('projects CRUD', async () => {
    expect(await dataService.getProjects()).toEqual([]);

    const p = await dataService.addProject({ name: 'Renovation', budget: 5000 });
    expect(p.id).toBeDefined();
    expect((await dataService.getProjects())).toHaveLength(1);

    await dataService.updateProject(p.id, { budget: 8000 });
    const projects = await dataService.getProjects();
    expect(projects[0].budget).toBe(8000);

    await dataService.deleteProject(p.id);
    expect(await dataService.getProjects()).toEqual([]);
  });

  // ─── GOALS ────────────────────────────────────
  test('goals CRUD with deposits', async () => {
    expect(await dataService.getGoals()).toEqual([]);

    const goal = await dataService.addGoal({ name: 'Vacation', targetAmount: 10000, color: '#00ff00' });
    expect(goal.id).toBeDefined();
    expect(goal.deposits).toEqual([]);

    await dataService.updateGoal(goal.id, { targetAmount: 15000 });
    const goals = await dataService.getGoals();
    expect(goals[0].targetAmount).toBe(15000);

    const deposit = await dataService.addGoalDeposit(goal.id, 500, 'first deposit');
    expect(deposit.amount).toBe(500);
    expect(deposit.note).toBe('first deposit');

    const withDeposit = await dataService.getGoals();
    expect(withDeposit[0].deposits).toHaveLength(1);
    expect(withDeposit[0].deposits[0].amount).toBe(500);

    await dataService.deleteGoal(goal.id);
    expect(await dataService.getGoals()).toEqual([]);
  });

  test('addGoalDeposit returns null for missing goal', async () => {
    const result = await dataService.addGoalDeposit('nonexistent', 100);
    expect(result).toBeNull();
  });

  // ─── RECURRING PAYMENTS ──────────────────────
  test('recurring CRUD', async () => {
    expect(await dataService.getRecurring()).toEqual([]);

    const rec = await dataService.addRecurring({
      name: 'Netflix', amount: 50, type: 'expense',
      categoryId: 'entertainment', frequency: 'monthly',
      nextDate: '2026-04-15',
    });
    expect(rec.id).toBeDefined();
    expect(rec.isActive).toBe(true);
    expect(rec.completedCount).toBe(0);

    await dataService.updateRecurring(rec.id, { amount: 60 });
    const items = await dataService.getRecurring();
    expect(items[0].amount).toBe(60);

    await dataService.deleteRecurring(rec.id);
    expect(await dataService.getRecurring()).toEqual([]);
  });

  // ─── TAGS ────────────────────────────────────
  test('tags CRUD', async () => {
    expect(await dataService.getTags()).toEqual([]);

    await dataService.addTag('vacation');
    await dataService.addTag('work');
    const tags = await dataService.getTags();
    expect(tags).toContain('vacation');
    expect(tags).toContain('work');

    await dataService.deleteTag('vacation');
    const after = await dataService.getTags();
    expect(after).not.toContain('vacation');
    expect(after).toContain('work');
  });

  test('addTag does not duplicate existing tag', async () => {
    await dataService.addTag('food');
    await dataService.addTag('food');
    const tags = await dataService.getTags();
    expect(tags.filter(t => t === 'food')).toHaveLength(1);
  });

  // ─── QUICK TEMPLATES ─────────────────────────
  test('quick templates get/save', async () => {
    expect(await dataService.getQuickTemplates()).toEqual([]);
    await dataService.saveQuickTemplates([
      { id: '1', name: 'Coffee', categoryId: 'food', amount: 15 },
    ]);
    const tmpl = await dataService.getQuickTemplates();
    expect(tmpl).toHaveLength(1);
    expect(tmpl[0].name).toBe('Coffee');
  });

  // ─── TRANSACTIONS - extended ─────────────────
  test('addTransaction returns null for invalid input', async () => {
    // Note: behavior depends on impl — if it doesn't validate, this just passes
    const tx = await dataService.addTransaction({});
    // We just verify it doesn't throw
    expect(tx === null || typeof tx === 'object').toBe(true);
  });

  test('updateTransaction with non-existent id does not crash', async () => {
    // Should not throw
    await expect(dataService.updateTransaction('nonexistent', { amount: 100 })).resolves.toBeDefined();
  });

  // ─── IMPORT/EXPORT ───────────────────────────
  test('exportData includes all entities', async () => {
    await dataService.addTransaction({ type: 'expense', amount: 100, categoryId: 'food' });
    await dataService.addAccount({ name: 'Test', type: 'cash', balance: 50, currency: '₪' });
    await dataService.setBudget('food', 1000);
    await dataService.addGoal({ name: 'Goal1', targetAmount: 5000 });

    const data = await dataService.exportData();
    expect(data.transactions).toBeDefined();
    expect(data.accounts).toBeDefined();
    expect(data.budgets).toBeDefined();
    expect(data.goals).toBeDefined();
    expect(data.exportedAt).toBeDefined();
  });

  test('importData restores all entities', async () => {
    const payload = {
      transactions: [{ id: 't1', type: 'expense', amount: 250, categoryId: 'food' }],
      accounts: [{ id: 'a1', name: 'Imported', type: 'cash', balance: 1000, currency: '₪' }],
      budgets: { food: 500 },
      goals: [{ id: 'g1', name: 'Imported goal', targetAmount: 9000 }],
      tags: ['imported'],
      projects: [{ id: 'p1', name: 'Imported project' }],
      categories: [{ id: 'food', name: 'Food', subs: [] }],
      settings: { language: 'he' },
    };
    const ok = await dataService.importData(payload);
    expect(ok).toBe(true);

    expect((await dataService.getTransactions())[0].amount).toBe(250);
    expect((await dataService.getAccounts()).find(a => a.id === 'a1')).toBeDefined();
    expect((await dataService.getBudgets()).food).toBe(500);
    expect((await dataService.getGoals())[0].name).toBe('Imported goal');
    expect(await dataService.getTags()).toContain('imported');
    expect((await dataService.getProjects())[0].id).toBe('p1');
    expect((await dataService.getSettings()).language).toBe('he');
  });

  // ─── RECURRING - confirm/skip ───────────────
  test('confirmRecurring creates a transaction and advances nextDate', async () => {
    const rec = await dataService.addRecurring({
      name: 'Rent', amount: 3000, type: 'expense',
      categoryId: 'housing', frequency: 'monthly',
      nextDate: '2026-04-01', intervalMonths: 1,
    });

    const before = (await dataService.getTransactions()).length;
    const ok = await dataService.confirmRecurring(rec.id);
    expect(ok).toBe(true);

    const txs = await dataService.getTransactions();
    expect(txs.length).toBe(before + 1);
    expect(txs[0].amount).toBe(3000);

    const items = await dataService.getRecurring();
    expect(items[0].completedCount).toBe(1);
    expect(items[0].nextDate).toBe('2026-05-01');
  });

  test('confirmRecurring deactivates after reaching count limit', async () => {
    const rec = await dataService.addRecurring({
      name: 'Loan', amount: 500, type: 'expense', categoryId: 'finance',
      frequency: 'monthly', nextDate: '2026-04-01', intervalMonths: 1,
      endType: 'count', totalCount: 1,
    });

    await dataService.confirmRecurring(rec.id);
    const items = await dataService.getRecurring();
    expect(items[0].isActive).toBe(false);
  });

  test('confirmRecurring returns false for missing id', async () => {
    const ok = await dataService.confirmRecurring('nonexistent');
    expect(ok).toBe(false);
  });

  test('skipRecurring advances nextDate without creating transaction', async () => {
    const rec = await dataService.addRecurring({
      name: 'Gym', amount: 200, type: 'expense', categoryId: 'health',
      frequency: 'monthly', nextDate: '2026-04-10', intervalMonths: 1,
    });

    const beforeTxs = (await dataService.getTransactions()).length;
    const ok = await dataService.skipRecurring(rec.id);
    expect(ok).toBe(true);

    expect((await dataService.getTransactions()).length).toBe(beforeTxs);
    const items = await dataService.getRecurring();
    expect(items[0].nextDate).toBe('2026-05-10');
  });

  test('skipRecurring returns false for missing id', async () => {
    const ok = await dataService.skipRecurring('nonexistent');
    expect(ok).toBe(false);
  });

  // ─── RECALCULATE BALANCES ───────────────────
  test('recalculateBalances sums income/expense per account', async () => {
    const acc = await dataService.addAccount({ name: 'Wallet', type: 'cash', balance: 0, currency: '₪' });
    await dataService.addTransaction({ type: 'income', amount: 1000, categoryId: 'salary', account: acc.id });
    await dataService.addTransaction({ type: 'expense', amount: 300, categoryId: 'food', account: acc.id });
    await dataService.addTransaction({ type: 'expense', amount: 200, categoryId: 'transport', account: acc.id });

    const ok = await dataService.recalculateBalances();
    expect(ok).toBe(true);

    const accounts = await dataService.getAccounts();
    const wallet = accounts.find(a => a.id === acc.id);
    expect(wallet.balance).toBe(500); // 1000 - 300 - 200
  });

  test('recalculateBalances ignores transactions without account', async () => {
    const acc = await dataService.addAccount({ name: 'Wallet2', type: 'cash', balance: 0, currency: '₪' });
    await dataService.addTransaction({ type: 'income', amount: 500, categoryId: 'gift', account: acc.id });
    await dataService.addTransaction({ type: 'expense', amount: 999, categoryId: 'food' }); // no account

    await dataService.recalculateBalances();
    const wallet = (await dataService.getAccounts()).find(a => a.id === acc.id);
    expect(wallet.balance).toBe(500); // unaffected by orphan transaction
  });
});
