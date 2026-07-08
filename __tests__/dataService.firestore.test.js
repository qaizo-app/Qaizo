// __tests__/dataService.firestore.test.js
// Тесты dataService в режиме залогиненного пользователя (Firestore)

// Залогиненный пользователь — uid != null
jest.mock('../src/services/authService', () => ({
  default: { getUid: () => 'test-user' },
  getUid: () => 'test-user',
}));

// Seedable AsyncStorage — migrateToFirestore reads guest data from here.
const mockStorage = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(key => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key, val) => { mockStorage[key] = val; return Promise.resolve(); }),
  removeItem: jest.fn(key => { delete mockStorage[key]; return Promise.resolve(); }),
  multiRemove: jest.fn(keys => { keys.forEach(k => delete mockStorage[k]); return Promise.resolve(); }),
}));

// In-memory Firestore mock for @react-native-firebase/firestore (chained API)
jest.mock('@react-native-firebase/firestore', () => {
  const state = {
    collections: {}, // { 'users/test-user/transactions': [{id, ...data}] }
    docs: {},        // { 'users/test-user/budgets/data': { value: {...} } }
  };

  function makeDocRef(path) {
    return {
      __type: 'doc',
      path,
      collection: (subCol) => makeColRef(`${path}/${subCol}`),
      get: async () => {
        // First try standalone docs (settings, budgets, etc)
        let data = state.docs[path];
        // If not found, try as a doc inside a collection
        if (data === undefined) {
          const segments = path.split('/');
          const id = segments.pop();
          const colPath = segments.join('/');
          const col = state.collections[colPath];
          if (col) {
            const found = col.find(i => i.id === id);
            if (found) {
              const { id: _, ...rest } = found;
              data = rest;
            }
          }
        }
        return {
          // RN Firebase v24: exists is a METHOD, not a boolean property.
          // Mirroring that here exercises the real production code path
          // (a boolean property would mask the snapExists bug).
          exists: () => data !== undefined,
          data: () => data,
          id: path.split('/').pop(),
        };
      },
      set: async (data) => {
        if (state.hangWrites) return new Promise(() => {});
        const segments = path.split('/');
        const id = segments.pop();
        const colPath = segments.join('/');
        const isCollectionDoc = /^users\/[^/]+\/(transactions|accounts|recurring|investments)$/.test(colPath);
        if (isCollectionDoc) {
          if (!state.collections[colPath]) state.collections[colPath] = [];
          const idx = state.collections[colPath].findIndex(i => i.id === id);
          if (idx >= 0) state.collections[colPath][idx] = { id, ...data };
          else state.collections[colPath].push({ id, ...data });
        } else {
          state.docs[path] = data;
        }
      },
      update: async (data) => {
        if (state.hangWrites) return new Promise(() => {});
        const segments = path.split('/');
        const id = segments.pop();
        const colPath = segments.join('/');
        // Resolve FieldValue sentinels (e.g. increment) against the current value.
        const applyOps = (current) => {
          const out = { ...current };
          for (const [k, v] of Object.entries(data)) {
            if (v && v.__fieldValue === 'increment') out[k] = (current[k] || 0) + v.operand;
            else out[k] = v;
          }
          return out;
        };
        if (state.collections[colPath]) {
          const idx = state.collections[colPath].findIndex(i => i.id === id);
          if (idx >= 0) state.collections[colPath][idx] = applyOps(state.collections[colPath][idx]);
        } else if (state.docs[path]) {
          state.docs[path] = applyOps(state.docs[path]);
        }
      },
      delete: async () => {
        if (state.hangWrites) return new Promise(() => {});
        const segments = path.split('/');
        const id = segments.pop();
        const colPath = segments.join('/');
        if (state.collections[colPath]) {
          state.collections[colPath] = state.collections[colPath].filter(i => i.id !== id);
        }
        delete state.docs[path];
      },
    };
  }

  function makeColRef(path) {
    return {
      __type: 'collection',
      path,
      doc: (id) => makeDocRef(`${path}/${id}`),
      add: async (data) => {
        // Simulate a stuck Firestore gRPC stream: the write promise never settles.
        if (state.hangWrites) return new Promise(() => {});
        const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        if (!state.collections[path]) state.collections[path] = [];
        state.collections[path].push({ id, ...data });
        return { id };
      },
      get: async () => {
        const items = state.collections[path] || [];
        return {
          docs: items.map(item => ({
            id: item.id,
            data: () => { const { id, ...rest } = item; return rest; },
            ref: makeDocRef(`${path}/${item.id}`),
          })),
        };
      },
      orderBy: function (_field, _direction) {
        // Return the same colRef so .get() still works on the chain
        return this;
      },
    };
  }

  const firestoreFn = () => ({
    collection: (name) => makeColRef(name),
  });

  // Atomic field operations — mirror firestore.FieldValue.increment(n).
  firestoreFn.FieldValue = {
    increment: (operand) => ({ __fieldValue: 'increment', operand }),
  };

  firestoreFn.__state = state; // expose for test reset

  return { __esModule: true, default: firestoreFn };
});

const dataService = require('../src/services/dataService').default;
const firestoreMock = require('@react-native-firebase/firestore').default;

beforeEach(() => {
  firestoreMock.__state.collections = {};
  firestoreMock.__state.docs = {};
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
});

describe('dataService (firestore mode)', () => {
  // ─── TRANSACTIONS ────────────────────────────
  test('addTransaction creates doc in transactions collection', async () => {
    const tx = await dataService.addTransaction({
      type: 'expense', amount: 100, categoryId: 'food',
      date: '2026-01-01T00:00:00.000Z',
    });
    expect(tx).not.toBeNull();
    expect(tx.id).toBeDefined();

    const txs = await dataService.getTransactions();
    expect(txs.length).toBe(1);
    expect(txs[0].amount).toBe(100);
  });

  test('addTransaction with a clientId is idempotent — retry with same id does not duplicate', async () => {
    // Simulates the double-press after a timed-out save: the same logical
    // transaction is sent twice with the same client key. It must land on the
    // same document, never create two rows.
    const first = await dataService.addTransaction({
      type: 'expense', amount: 100, categoryId: 'food',
    }, 'cli_abc');
    const second = await dataService.addTransaction({
      type: 'expense', amount: 100, categoryId: 'food',
    }, 'cli_abc');

    expect(first.id).toBe('cli_abc');
    expect(second.id).toBe('cli_abc');

    const txs = await dataService.getTransactions();
    expect(txs.length).toBe(1);
  });

  test('updateTransaction modifies firestore doc', async () => {
    const tx = await dataService.addTransaction({ type: 'expense', amount: 50, categoryId: 'food' });
    await dataService.updateTransaction(tx.id, { amount: 75 });
    const txs = await dataService.getTransactions();
    expect(txs[0].amount).toBe(75);
  });

  test('deleteTransaction removes from firestore', async () => {
    const tx = await dataService.addTransaction({ type: 'expense', amount: 100, categoryId: 'food' });
    expect((await dataService.getTransactions()).length).toBe(1);
    await dataService.deleteTransaction(tx.id);
    expect((await dataService.getTransactions()).length).toBe(0);
  });

  test('deleteTransaction cascades transfer pair in firestore', async () => {
    const pairId = 'pair_xyz';
    await dataService.addTransaction({
      type: 'expense', amount: 200, categoryId: 'transfer',
      isTransfer: true, transferPairId: pairId,
    });
    await dataService.addTransaction({
      type: 'income', amount: 200, categoryId: 'transfer',
      isTransfer: true, transferPairId: pairId,
    });

    const txs = await dataService.getTransactions();
    expect(txs.length).toBe(2);

    await dataService.deleteTransaction(txs[0].id);
    expect((await dataService.getTransactions()).length).toBe(0);
  });

  // ─── ACCOUNTS ────────────────────────────────
  test('addAccount creates account doc', async () => {
    const acc = await dataService.addAccount({
      name: 'Bank Hapoalim', type: 'bank', balance: 5000, currency: '₪',
    });
    expect(acc.id).toBeDefined();

    const accs = await dataService.getAccounts();
    expect(accs.find(a => a.id === acc.id)).toBeDefined();
  });

  test('getAccounts returns defaults when empty', async () => {
    const accs = await dataService.getAccounts();
    expect(accs.length).toBeGreaterThan(0);
    // First call should populate defaults
  });

  test('updateAccount modifies firestore', async () => {
    const acc = await dataService.addAccount({ name: 'Test', type: 'cash', balance: 100, currency: '₪' });
    await dataService.updateAccount(acc.id, { name: 'Updated', balance: 999 });
    const accs = await dataService.getAccounts();
    const updated = accs.find(a => a.id === acc.id);
    expect(updated.name).toBe('Updated');
    expect(updated.balance).toBe(999);
  });

  test('addTransaction adjusts account balance via atomic increment', async () => {
    const acc = await dataService.addAccount({ name: 'Wallet', type: 'cash', balance: 1000, currency: '₪' });

    await dataService.addTransaction({ type: 'expense', amount: 100, categoryId: 'food', account: acc.id });
    let accs = await dataService.getAccounts();
    expect(accs.find(a => a.id === acc.id).balance).toBe(900);

    await dataService.addTransaction({ type: 'income', amount: 250, categoryId: 'salary_me', account: acc.id });
    accs = await dataService.getAccounts();
    expect(accs.find(a => a.id === acc.id).balance).toBe(1150);
  });

  test('back-to-back saves do not lose a balance update (no read-modify-write race)', async () => {
    const acc = await dataService.addAccount({ name: 'Race', type: 'cash', balance: 0, currency: '₪' });
    await Promise.all([
      dataService.addTransaction({ type: 'income', amount: 10, categoryId: 'salary_me', account: acc.id }),
      dataService.addTransaction({ type: 'income', amount: 20, categoryId: 'salary_me', account: acc.id }),
      dataService.addTransaction({ type: 'income', amount: 30, categoryId: 'salary_me', account: acc.id }),
    ]);
    const accs = await dataService.getAccounts();
    expect(accs.find(a => a.id === acc.id).balance).toBe(60);
  });

  test('addAccount resolves to null (does not hang) when the Firestore write never settles', async () => {
    firestoreMock.__state.hangWrites = true;
    try {
      const result = await dataService.addAccount({ name: 'Stuck', type: 'cash', balance: 0, currency: '₪' });
      expect(result).toBeNull();
    } finally {
      firestoreMock.__state.hangWrites = false;
    }
  }, 15000);

  test('deleteAccount removes from firestore', async () => {
    const acc = await dataService.addAccount({ name: 'Trash', type: 'cash', balance: 0, currency: '₪' });
    await dataService.deleteAccount(acc.id);
    const accs = await dataService.getAccounts();
    expect(accs.find(a => a.id === acc.id)).toBeUndefined();
  });

  // ─── BUDGETS ─────────────────────────────────
  test('budgets get/save in firestore', async () => {
    expect(await dataService.getBudgets()).toEqual({});
    await dataService.setBudget('food', 1500);
    expect((await dataService.getBudgets()).food).toBe(1500);
  });

  test('deleteBudget in firestore', async () => {
    await dataService.setBudget('food', 1000);
    await dataService.deleteBudget('food');
    expect(await dataService.getBudgets()).toEqual({});
  });

  // ─── SETTINGS ───────────────────────────────
  test('settings get/save in firestore', async () => {
    const s = await dataService.getSettings();
    expect(s.language).toBe('ru'); // default
    await dataService.saveSettings({ ...s, language: 'he' });
    expect((await dataService.getSettings()).language).toBe('he');
  });

  // ─── RECURRING ──────────────────────────────
  test('recurring CRUD in firestore', async () => {
    const rec = await dataService.addRecurring({
      name: 'Spotify', amount: 30, type: 'expense',
      categoryId: 'entertainment', frequency: 'monthly',
      nextDate: '2026-05-01',
    });
    expect(rec.id).toBeDefined();

    const items = await dataService.getRecurring();
    expect(items.length).toBe(1);

    await dataService.updateRecurring(rec.id, { amount: 35 });
    const updated = await dataService.getRecurring();
    expect(updated[0].amount).toBe(35);

    await dataService.deleteRecurring(rec.id);
    expect((await dataService.getRecurring()).length).toBe(0);
  });

  test('addRecurring resolves to null (does not hang) when the Firestore write never settles', async () => {
    // Stuck gRPC stream: add() never settles. withTimeout must reject internally
    // so addRecurring returns null instead of leaving the save modal frozen.
    firestoreMock.__state.hangWrites = true;
    try {
      const result = await dataService.addRecurring({
        type: 'expense', amount: 100, categoryId: 'rent', frequency: 'monthly', nextDate: '2026-07-01',
      });
      expect(result).toBeNull();
    } finally {
      firestoreMock.__state.hangWrites = false;
    }
  }, 15000);

  test('confirmRecurring creates transaction in firestore', async () => {
    const rec = await dataService.addRecurring({
      name: 'Rent', amount: 4000, type: 'expense',
      categoryId: 'rent', frequency: 'monthly',
      nextDate: '2026-04-01', intervalMonths: 1,
    });

    const ok = await dataService.confirmRecurring(rec.id);
    expect(ok).toBe(true);

    const txs = await dataService.getTransactions();
    expect(txs.length).toBe(1);
    expect(txs[0].amount).toBe(4000);
  });

  test('skipRecurring advances date in firestore', async () => {
    const rec = await dataService.addRecurring({
      name: 'Phone', amount: 100, type: 'expense',
      categoryId: 'phone', frequency: 'monthly',
      nextDate: '2026-04-15', intervalMonths: 1,
    });

    const ok = await dataService.skipRecurring(rec.id);
    expect(ok).toBe(true);

    const items = await dataService.getRecurring();
    expect(items[0].nextDate).toBe('2026-05-15');
    expect((await dataService.getTransactions()).length).toBe(0);
  });

  // ─── EXPORT ─────────────────────────────────
  test('exportData includes firestore data', async () => {
    await dataService.addTransaction({ type: 'expense', amount: 50, categoryId: 'food' });
    await dataService.setBudget('food', 500);

    const data = await dataService.exportData();
    expect(data.transactions.length).toBe(1);
    expect(data.budgets.food).toBe(500);
    expect(data.exportedAt).toBeDefined();
  });

  // ─── IMPORT ─────────────────────────────────
  test('importData restores entities to firestore', async () => {
    const payload = {
      transactions: [{ id: 'tx1', type: 'expense', amount: 200, categoryId: 'food' }],
      accounts: [{ id: 'acc1', name: 'Imported', type: 'cash', balance: 1000, currency: '₪' }],
      budgets: { food: 800 },
    };
    const ok = await dataService.importData(payload);
    expect(ok).toBe(true);

    const txs = await dataService.getTransactions();
    expect(txs.length).toBeGreaterThanOrEqual(1);
    expect((await dataService.getBudgets()).food).toBe(800);
  });

  test('importData restores streaks and quick templates', async () => {
    const ok = await dataService.importData({
      streaks: { currentStreak: 5, longestStreak: 9 },
      quickTemplates: [{ id: 'qt1', categoryId: 'food' }],
    });
    expect(ok).toBe(true);

    expect((await dataService.getStreaks()).currentStreak).toBe(5);
    expect((await dataService.getQuickTemplates()).length).toBe(1);
  });

  test('exportData includes quick templates', async () => {
    await dataService.saveQuickTemplates([{ id: 'qt1', categoryId: 'food' }]);

    const data = await dataService.exportData();
    expect(data.quickTemplates.length).toBe(1);
  });

  // ─── MIGRATION ──────────────────────────────
  test('migrateToFirestore preserves streaks and quick templates', async () => {
    mockStorage['qaizo_transactions'] = JSON.stringify([{ id: 't1', type: 'expense', amount: 10, categoryId: 'food' }]);
    mockStorage['qaizo_streaks'] = JSON.stringify({ currentStreak: 5, longestStreak: 9 });
    mockStorage['qaizo_quick_templates'] = JSON.stringify([{ id: 'qt1', categoryId: 'food' }]);

    const ok = await dataService.migrateToFirestore();
    expect(ok).toBe(true);

    // The guest data must land in Firestore — not silently vanish after the
    // post-migration AsyncStorage wipe.
    expect((await dataService.getStreaks()).currentStreak).toBe(5);
    expect((await dataService.getQuickTemplates()).length).toBe(1);
  });

  // ─── CLEAR ──────────────────────────────────
  test('clearAllData removes everything in firestore', async () => {
    await dataService.addTransaction({ type: 'expense', amount: 100, categoryId: 'food' });
    await dataService.setBudget('food', 500);

    await dataService.clearAllData();
    expect((await dataService.getTransactions()).length).toBe(0);
    expect(await dataService.getBudgets()).toEqual({});
  });

  test('clearAllData also removes quick templates', async () => {
    await dataService.saveQuickTemplates([{ id: 'qt1', categoryId: 'food' }]);

    await dataService.clearAllData();
    expect(await dataService.getQuickTemplates()).toEqual([]);
  });
});
