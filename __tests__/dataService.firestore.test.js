// __tests__/dataService.firestore.test.js
// Тесты dataService в режиме залогиненного пользователя (Firestore)

// Залогиненный пользователь — uid != null
jest.mock('../src/services/authService', () => ({
  default: { getUid: () => 'test-user' },
  getUid: () => 'test-user',
}));

jest.mock('../src/config/firebase', () => ({
  db: { name: 'mockDb' }, auth: { currentUser: { uid: 'test-user' } },
}));

// In-memory Firestore mock — must be defined inside jest.mock factory (Jest hoisting rule)
jest.mock('firebase/firestore', () => {
  const state = {
    collections: {}, // { 'users/test-user/transactions': [{id, ...data}] }
    docs: {},        // { 'users/test-user/budgets/data': { value: {...} } }
  };

  const pathFromArgs = (args) => {
    if (args[0] && args[0].name === 'mockDb') return args.slice(1).join('/');
    return args.join('/');
  };

  const mod = {
    __state: state, // expose for test reset
    initializeFirestore: jest.fn(() => ({})),
    persistentLocalCache: jest.fn(),
    collection: jest.fn((...args) => ({ __type: 'collection', path: pathFromArgs(args) })),
    doc: jest.fn((...args) => {
      if (args[0] && args[0].__type === 'collection') {
        return { __type: 'doc', path: `${args[0].path}/${args[1]}` };
      }
      return { __type: 'doc', path: pathFromArgs(args) };
    }),
    getDoc: jest.fn(async (ref) => {
      // First try standalone docs (settings, budgets, etc)
      let data = state.docs[ref.path];
      // If not found, try as a doc inside a collection
      if (data === undefined) {
        const segments = ref.path.split('/');
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
        exists: () => data !== undefined,
        data: () => data,
        id: ref.path.split('/').pop(),
      };
    }),
    getDocs: jest.fn(async (qOrCol) => {
      const path = qOrCol.__type === 'query' ? qOrCol.colPath : qOrCol.path;
      const items = state.collections[path] || [];
      return {
        docs: items.map(item => ({
          id: item.id,
          data: () => { const { id, ...rest } = item; return rest; },
          ref: { __type: 'doc', path: `${path}/${item.id}` },
        })),
      };
    }),
    addDoc: jest.fn(async (col, data) => {
      const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      if (!state.collections[col.path]) state.collections[col.path] = [];
      state.collections[col.path].push({ id, ...data });
      return { id };
    }),
    setDoc: jest.fn(async (ref, data) => {
      const segments = ref.path.split('/');
      const id = segments.pop();
      const colPath = segments.join('/');
      // Determine if this is a "single doc" or "doc in collection" path
      // Collection paths in Qaizo: users/{uid}/transactions, users/{uid}/accounts, users/{uid}/recurring, users/{uid}/investments
      const isCollectionDoc = /^users\/[^/]+\/(transactions|accounts|recurring|investments)$/.test(colPath);
      if (isCollectionDoc) {
        if (!state.collections[colPath]) state.collections[colPath] = [];
        const idx = state.collections[colPath].findIndex(i => i.id === id);
        if (idx >= 0) state.collections[colPath][idx] = { id, ...data };
        else state.collections[colPath].push({ id, ...data });
      } else {
        state.docs[ref.path] = data;
      }
    }),
    updateDoc: jest.fn(async (ref, data) => {
      const segments = ref.path.split('/');
      const id = segments.pop();
      const colPath = segments.join('/');
      if (state.collections[colPath]) {
        const idx = state.collections[colPath].findIndex(i => i.id === id);
        if (idx >= 0) state.collections[colPath][idx] = { ...state.collections[colPath][idx], ...data };
      } else if (state.docs[ref.path]) {
        state.docs[ref.path] = { ...state.docs[ref.path], ...data };
      }
    }),
    deleteDoc: jest.fn(async (ref) => {
      const segments = ref.path.split('/');
      const id = segments.pop();
      const colPath = segments.join('/');
      if (state.collections[colPath]) {
        state.collections[colPath] = state.collections[colPath].filter(i => i.id !== id);
      }
      delete state.docs[ref.path];
    }),
    orderBy: jest.fn((field, direction) => ({ field, direction })),
    query: jest.fn((col, ...mods) => ({ __type: 'query', colPath: col.path, mods })),
  };
  return mod;
});

const dataService = require('../src/services/dataService').default;
const { invalidateTxCache } = require('../src/services/dataService');
const firestoreMock = require('firebase/firestore');

beforeEach(() => {
  firestoreMock.__state.collections = {};
  firestoreMock.__state.docs = {};
  invalidateTxCache();
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

  // ─── CLEAR ──────────────────────────────────
  test('clearAllData removes everything in firestore', async () => {
    await dataService.addTransaction({ type: 'expense', amount: 100, categoryId: 'food' });
    await dataService.setBudget('food', 500);

    await dataService.clearAllData();
    expect((await dataService.getTransactions()).length).toBe(0);
    expect(await dataService.getBudgets()).toEqual({});
  });
});
