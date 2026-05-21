// src/services/dataService.ts
// Firestore (signed-in) ←→ AsyncStorage (guest).
//
// This module is intentionally loosely typed: it is the dual-backend bridge,
// so most public methods return `any` for now (step 10b will tighten them to
// the domain types from `src/types`). The tightening intentionally lands in
// a separate commit because every already-typed service downstream will
// then see new errors.

import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import authService from './authService';
import type {
  Account,
  Goal,
  GoalDeposit,
  Investment,
  Project,
  QuickTemplate,
  Recurring,
  Settings,
  StreakData,
  Transaction,
} from '../types';

// ─── Ключи для AsyncStorage (гостевой режим) ─────────────
const KEYS = {
  TRANSACTIONS: 'qaizo_transactions',
  ACCOUNTS: 'qaizo_accounts',
  INVESTMENTS: 'qaizo_investments',
  CATEGORIES: 'qaizo_categories',
  SETTINGS: 'qaizo_settings',
  BUDGETS: 'qaizo_budgets',
  RECURRING: 'qaizo_recurring',
  TAGS: 'qaizo_tags',
  STREAKS: 'qaizo_streaks',
  QUICK_TEMPLATES: 'qaizo_quick_templates',
  PROJECTS: 'qaizo_projects',
  GOALS: 'qaizo_goals',
  SHOPPING_LIST: 'qaizo_shopping_list',
};

const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'cash_ils', name: 'Cash ₪', type: 'cash', icon: 'wallet-outline', balance: 0, currency: '₪', isActive: true },
];

const DEFAULT_CATEGORIES = {
  income: [
    { id: 'salary_me', icon: 'briefcase', color: '#22c55e' },
    { id: 'salary_spouse', icon: 'briefcase', color: '#10b981' },
    { id: 'handyman', icon: 'tool', color: '#34d399' },
    { id: 'sales', icon: 'package', color: '#6ee7b7' },
    { id: 'rental_income', icon: 'home', color: '#059669' },
    { id: 'keren_hishtalmut', icon: 'trending-up', color: '#14b8a6' },
    { id: 'pension', icon: 'umbrella', color: '#0891b2' },
    { id: 'other_income', icon: 'plus-circle', color: '#a7f3d0' },
  ],
  expense: [
    { id: 'food', icon: 'shopping-cart', color: '#ef4444' },
    { id: 'transport', icon: 'navigation', color: '#f97316' },
    { id: 'fuel', icon: 'droplet', color: '#f59e0b' },
    { id: 'insurance', icon: 'shield', color: '#eab308' },
    { id: 'phone', icon: 'smartphone', color: '#8b5cf6' },
    { id: 'utilities', icon: 'zap', color: '#3b82f6' },
    { id: 'health', icon: 'heart', color: '#ec4899' },
    { id: 'kids', icon: 'smile', color: '#f472b6' },
    { id: 'clothing', icon: 'shopping-bag', color: '#a855f7' },
    { id: 'entertainment', icon: 'film', color: '#06b6d4' },
    { id: 'education', icon: 'book-open', color: '#14b8a6' },
    { id: 'rent', icon: 'key', color: '#dc2626' },
    { id: 'arnona', icon: 'map-pin', color: '#ef4444' },
    { id: 'vaad', icon: 'users', color: '#991b1b' },
    { id: 'restaurant', icon: 'coffee', color: '#e11d48' },
    { id: 'household', icon: 'home', color: '#7c3aed' },
    { id: 'electronics', icon: 'cpu', color: '#2563eb' },
    { id: 'cosmetics', icon: 'scissors', color: '#db2777' },
    { id: 'other', icon: 'more-horizontal', color: '#6b7280' },
  ],
};

const DEFAULT_SETTINGS: Settings = { language: 'ru', currency: '₪', weekStart: 'sunday' };

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Firestore helpers ────────────────────────────────────
function getUid(): string | null {
  return authService.getUid();
}

// Walks `a/b/c/d/...` alternating .collection / .doc. Returns `any` because
// the type alternates between CollectionReference and DocumentReference as
// we descend — modeling that precisely is more noise than value here.
function userDoc(path: string): any {
  const uid = getUid();
  const parts = path.split('/');
  let ref: any = firestore().collection('users').doc(uid as string);
  for (let i = 0; i < parts.length; i++) {
    ref = i % 2 === 0 ? ref.collection(parts[i]) : ref.doc(parts[i]);
  }
  return ref;
}

function userCol(colName: string): any {
  const uid = getUid();
  return firestore().collection('users').doc(uid as string).collection(colName);
}

// ─── Single-document read/write (settings, budgets, categories, tags) ────
async function getDocData(colName: string, defaultVal: any): Promise<any> {
  try {
    const snap = await userDoc(colName + '/data').get();
    return (snap as any).exists ? (snap.data() as any)?.value : defaultVal;
  } catch (e) {
    if (__DEV__) console.error(`Firestore getDocData(${colName}):`, e);
    return defaultVal;
  }
}

async function setDocData(colName: string, value: any): Promise<boolean> {
  try {
    await userDoc(colName + '/data').set({ value, updatedAt: new Date().toISOString() });
    return true;
  } catch (e) {
    if (__DEV__) console.error(`Firestore setDocData(${colName}):`, e);
    return false;
  }
}

// ─── Collection read/write (transactions, accounts, investments, recurring) ──
async function getColDocs(colName: string, defaultVal: any[] = []): Promise<any[]> {
  try {
    const snap = await userCol(colName).orderBy('createdAt', 'desc').get();
    return snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
  } catch (e) {
    try {
      const snap = await userCol(colName).get();
      const items = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
      return items.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (e2) {
      if (__DEV__) console.error(`Firestore getColDocs(${colName}):`, e2);
      return defaultVal;
    }
  }
}

// ─── Account balance update ───────────────────────────────
async function updateAccountBalance(accountId: string, amount: number, type: string): Promise<void> {
  const uid = getUid();
  try {
    if (uid) {
      const ref = firestore().collection('users').doc(uid).collection('accounts').doc(accountId);
      const snap = await ref.get();
      if ((snap as any).exists) {
        const data = snap.data() as any;
        let bal: number = (data?.balance) || 0;
        if (type === 'income') bal += amount;
        else if (type === 'expense') bal -= amount;
        await ref.update({ balance: bal });
      }
    } else {
      const data = await AsyncStorage.getItem(KEYS.ACCOUNTS);
      const accounts: any[] = data ? JSON.parse(data) : DEFAULT_ACCOUNTS;
      const updated = accounts.map((a: any) => {
        if (a.id === accountId) {
          let newBalance: number = a.balance || 0;
          if (type === 'income') newBalance += amount;
          else if (type === 'expense') newBalance -= amount;
          return { ...a, balance: newBalance };
        }
        return a;
      });
      await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(updated));
    }
  } catch (e) {
    if (__DEV__) console.error('Error updating account balance:', e);
  }
}

// ─── Change broadcaster ──────────────────────────────────
// Screens subscribe so they refresh balances/lists right after a write,
// without depending on focus events that don't fire when a modal closes
// over an already-focused screen (e.g. the "+" add-tx modal opened from
// AppNavigator).
type ChangeListener = () => void;
const _changeListeners = new Set<ChangeListener>();
function onChange(fn: ChangeListener): () => void {
  _changeListeners.add(fn);
  return () => { _changeListeners.delete(fn); };
}
function emitChange(): void {
  _changeListeners.forEach((fn) => { try { fn(); } catch (e) {} });
}

// ─────────────────────────────────────────────────────────
const dataService = {
  onChange,

  // ─── TRANSACTIONS ────────────────────────────────────────
  async getTransactions(): Promise<Transaction[]> {
    const uid = getUid();
    if (uid) return getColDocs('transactions') as Promise<Transaction[]>;
    try {
      const data = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
      const txs: Transaction[] = data ? JSON.parse(data) : [];
      return txs;
    } catch (e) { if (__DEV__) console.error('getTransactions error:', e); return []; }
  },

  async addTransaction(transaction: Partial<Transaction>): Promise<Transaction | null> {
    const uid = getUid();
    const newTx: any = { ...transaction, createdAt: new Date().toISOString() };
    try {
      if (uid) {
        const ref = await userCol('transactions').add(newTx);
        newTx.id = ref.id;
      } else {
        newTx.id = generateId();
        const txs = await this.getTransactions();
        await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify([newTx, ...txs]));
      }
      if (newTx.account) await updateAccountBalance(newTx.account, newTx.amount, newTx.type);
      // Fire-and-forget project budget threshold check (does not block transaction save)
      if (newTx.projectId && newTx.type === 'expense') {
        try {
          const notif = require('./notificationService').default;
          notif.notifyProjectBudgetThreshold(newTx.projectId).catch(() => {});
        } catch (e) { /* noop — notifications optional */ }
      }
      // Quick-template suggestion: stash it in AsyncStorage so the Dashboard
      // can pick it up on next focus and prompt the user. Doesn't block the
      // save flow.
      if (newTx.type === 'expense') {
        this.suggestQuickTemplate(newTx).then(s => {
          if (s) AsyncStorage.setItem('pending_template_suggestion', JSON.stringify(s)).catch(() => {});
        }).catch(() => {});
      }
      emitChange();
      return newTx;
    } catch (e) { if (__DEV__) console.error('addTransaction:', e); return null; }
  },

  async deleteTransaction(id: string): Promise<boolean> {
    const uid = getUid();
    try {
      if (uid) {
        const ref = firestore().collection('users').doc(uid).collection('transactions').doc(id);
        const snap = await ref.get();
        const tx: any = (snap as any).exists ? { ...snap.data(), id } : null;
        await ref.delete();
        if (tx && tx.account) {
          const reverseType = tx.type === 'income' ? 'expense' : 'income';
          await updateAccountBalance(tx.account, tx.amount, reverseType);
        }
        // Cascade-delete the paired transfer side
        if (tx && tx.transferPairId) {
          const allSnap = await userCol('transactions').get();
          const pair = allSnap.docs.find((d: any) => (d.data() as any).transferPairId === tx.transferPairId && d.id !== id);
          if (pair) {
            const pairData = pair.data() as any;
            await pair.ref.delete();
            if (pairData.account) {
              const pairReverse = pairData.type === 'income' ? 'expense' : 'income';
              await updateAccountBalance(pairData.account, pairData.amount, pairReverse);
            }
          }
        }
      } else {
        const txs = await this.getTransactions();
        const tx: any = txs.find((t: any) => t.id === id);
        let filtered = txs.filter((t: any) => t.id !== id);
        if (tx && tx.account) {
          const reverseType = tx.type === 'income' ? 'expense' : 'income';
          await updateAccountBalance(tx.account, tx.amount, reverseType);
        }
        // Cascade-delete the paired transfer side
        if (tx && tx.transferPairId) {
          const pair: any = filtered.find((t: any) => t.transferPairId === tx.transferPairId);
          if (pair) {
            filtered = filtered.filter((t: any) => t.id !== pair.id);
            if (pair.account) {
              const pairReverse = pair.type === 'income' ? 'expense' : 'income';
              await updateAccountBalance(pair.account, pair.amount, pairReverse);
            }
          }
        }
        await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(filtered));
      }
      emitChange();
      return true;
    } catch (e) { if (__DEV__) console.error('deleteTransaction:', e); return false; }
  },

  async updateTransaction(id: string, changes: Partial<Transaction>): Promise<boolean> {
    const uid = getUid();
    try {
      if (uid) {
        const ref = firestore().collection('users').doc(uid).collection('transactions').doc(id);
        const snap = await ref.get();
        const oldTx: any = (snap as any).exists ? { ...snap.data(), id } : null;
        await ref.update(changes);
        // Recompute balances
        if (oldTx && oldTx.account) {
          const reverseType = oldTx.type === 'income' ? 'expense' : 'income';
          await updateAccountBalance(oldTx.account, oldTx.amount, reverseType);
        }
        const newTx: any = { ...oldTx, ...changes };
        if (newTx.account) await updateAccountBalance(newTx.account, newTx.amount, newTx.type);
      } else {
        const txs = await this.getTransactions();
        const oldTx: any = txs.find((t: any) => t.id === id);
        await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs.map((t: any) => t.id === id ? { ...t, ...changes } : t)));
        if (oldTx && oldTx.account) {
          const reverseType = oldTx.type === 'income' ? 'expense' : 'income';
          await updateAccountBalance(oldTx.account, oldTx.amount, reverseType);
        }
        const newTx: any = { ...oldTx, ...changes };
        if (newTx.account) await updateAccountBalance(newTx.account, newTx.amount, newTx.type);
      }
      emitChange();
      return true;
    } catch (e) { if (__DEV__) console.error('updateTransaction:', e); return false; }
  },

  // ─── ACCOUNTS ────────────────────────────────────────────
  async getAccounts(): Promise<Account[]> {
    const uid = getUid();
    if (uid) {
      try {
        const snap = await userCol('accounts').get();
        const accs: any[] = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
        // Sort by 'order' field (manual ordering); fallback to original order
        accs.sort((a: any, b: any) => {
          if (typeof a.order === 'number' && typeof b.order === 'number') return a.order - b.order;
          if (typeof a.order === 'number') return -1;
          if (typeof b.order === 'number') return 1;
          return 0;
        });
        return accs.length > 0 ? accs : DEFAULT_ACCOUNTS;
      } catch (e) { return DEFAULT_ACCOUNTS; }
    }
    try {
      const data = await AsyncStorage.getItem(KEYS.ACCOUNTS);
      return data ? JSON.parse(data) : DEFAULT_ACCOUNTS;
    } catch (e) { return DEFAULT_ACCOUNTS; }
  },

  // Smart Input helper: find the most recently used account of a given type
  // (e.g. user said "paid with credit" but has 3 credit cards).
  async getLastUsedAccountByType(type: string): Promise<string | null> {
    const [txs, accs] = await Promise.all([this.getTransactions(), this.getAccounts()]);
    const typeAccountIds = new Set<string>(accs.filter((a: any) => a.type === type && a.isActive !== false).map((a: any) => a.id));
    if (typeAccountIds.size === 0) return null;
    if (typeAccountIds.size === 1) return [...typeAccountIds][0];
    const sorted = [...txs].sort((a: any, b: any) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
    for (const tx of sorted) {
      if (tx.account && typeAccountIds.has(tx.account)) return tx.account;
    }
    return [...typeAccountIds][0]; // fallback to first of type
  },

  async saveAccounts(accounts: Account[]): Promise<boolean> {
    const uid = getUid();
    if (uid) {
      try {
        // Rewrite all documents with explicit ordering
        const snap = await userCol('accounts').get();
        const deletes = snap.docs.map((d: any) => d.ref.delete());
        await Promise.all(deletes);
        const writes = accounts.map((a: any, i: number) => {
          const { id, ...rest } = a;
          return firestore().collection('users').doc(uid).collection('accounts').doc(id).set({ ...rest, order: i });
        });
        await Promise.all(writes);
        return true;
      } catch (e) { if (__DEV__) console.error('saveAccounts:', e); return false; }
    }
    try { await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts)); return true; } catch (e) { return false; }
  },

  async addAccount(account: Partial<Account>): Promise<Account | null> {
    const uid = getUid();
    try {
      if (uid) {
        const id = generateId();
        const { id: _id, ...rest } = account;
        await firestore().collection('users').doc(uid).collection('accounts').doc(id).set({ ...rest, createdAt: new Date().toISOString() });
        emitChange();
        return { ...account, id } as Account;
      } else {
        const accounts = await this.getAccounts();
        const newAcc = { ...account, id: generateId() } as Account;
        accounts.push(newAcc);
        await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts));
        emitChange();
        return newAcc;
      }
    } catch (e) { return null; }
  },

  async updateAccount(id: string, changes: Partial<Account>): Promise<boolean> {
    const uid = getUid();
    try {
      if (uid) {
        await firestore().collection('users').doc(uid).collection('accounts').doc(id).update(changes);
      } else {
        const accounts = await this.getAccounts();
        await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts.map((a: any) => a.id === id ? { ...a, ...changes } : a)));
      }
      emitChange();
      return true;
    } catch (e) { return false; }
  },

  async deleteAccount(id: string): Promise<boolean> {
    const uid = getUid();
    try {
      if (uid) {
        await firestore().collection('users').doc(uid).collection('accounts').doc(id).delete();
      } else {
        const accounts = await this.getAccounts();
        await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts.filter((a: any) => a.id !== id)));
      }
      emitChange();
      return true;
    } catch (e) { return false; }
  },

  // ─── INVESTMENTS ─────────────────────────────────────────
  async getInvestments(): Promise<Investment[]> {
    const uid = getUid();
    if (uid) return getColDocs('investments');
    try { const data = await AsyncStorage.getItem(KEYS.INVESTMENTS); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },

  async saveInvestments(investments: Investment[]): Promise<boolean> {
    const uid = getUid();
    if (uid) {
      try {
        const snap = await userCol('investments').get();
        await Promise.all(snap.docs.map((d: any) => d.ref.delete()));
        await Promise.all(investments.map((inv: any) => {
          const { id, ...rest } = inv;
          return firestore().collection('users').doc(uid).collection('investments').doc(id || generateId()).set({ ...rest, createdAt: rest.createdAt || new Date().toISOString() });
        }));
        return true;
      } catch (e) { return false; }
    }
    try { await AsyncStorage.setItem(KEYS.INVESTMENTS, JSON.stringify(investments)); return true; } catch (e) { return false; }
  },

  // ─── CATEGORIES ──────────────────────────────────────────
  async getCategories(): Promise<any> {
    const uid = getUid();
    if (uid) return getDocData('categories', DEFAULT_CATEGORIES);
    try { const data = await AsyncStorage.getItem(KEYS.CATEGORIES); return data ? JSON.parse(data) : DEFAULT_CATEGORIES; } catch (e) { return DEFAULT_CATEGORIES; }
  },

  async saveCategories(categories: any) {
    const uid = getUid();
    if (uid) return setDocData('categories', categories);
    try { await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories)); return true; } catch (e) { return false; }
  },

  // ─── BUDGETS ─────────────────────────────────────────────
  async getBudgets(): Promise<Record<string, number>> {
    const uid = getUid();
    if (uid) return getDocData('budgets', {});
    try { const data = await AsyncStorage.getItem(KEYS.BUDGETS); return data ? JSON.parse(data) : {}; } catch (e) { return {}; }
  },

  async saveBudgets(budgets: Record<string, number>): Promise<boolean> {
    const uid = getUid();
    if (uid) return setDocData('budgets', budgets);
    try { await AsyncStorage.setItem(KEYS.BUDGETS, JSON.stringify(budgets)); return true; } catch (e) { return false; }
  },

  async setBudget(categoryId: string, limit: number): Promise<boolean> {
    try {
      const budgets = await this.getBudgets();
      if (limit > 0) budgets[categoryId] = limit;
      else delete budgets[categoryId];
      await this.saveBudgets(budgets);
      return true;
    } catch (e) { return false; }
  },

  async deleteBudget(categoryId: string) {
    return this.setBudget(categoryId, 0);
  },

  // ─── PROJECTS ────────────────────────────────────────────
  async getProjects(): Promise<Project[]> {
    const uid = getUid();
    if (uid) return getDocData('projects', []);
    try { const data = await AsyncStorage.getItem(KEYS.PROJECTS); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },

  async saveProjects(projects: Project[]): Promise<boolean> {
    const uid = getUid();
    if (uid) return setDocData('projects', projects);
    try { await AsyncStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects)); return true; } catch (e) { return false; }
  },

  async addProject(project: Partial<Project>): Promise<Project> {
    const projects = await this.getProjects();
    const newProject = { ...project, id: generateId(), createdAt: new Date().toISOString() } as Project;
    projects.push(newProject);
    await this.saveProjects(projects);
    return newProject;
  },

  async updateProject(id: string, changes: Partial<Project>): Promise<Project[]> {
    const projects = await this.getProjects();
    const idx = projects.findIndex((p: any) => p.id === id);
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], ...changes };
      await this.saveProjects(projects);
    }
    return projects;
  },

  async deleteProject(id: string): Promise<void> {
    const projects = await this.getProjects();
    await this.saveProjects(projects.filter((p: any) => p.id !== id));
  },

  // ─── GOALS (מטרות חיסכון) ─────────────────────────────────
  async getGoals(): Promise<Goal[]> {
    const uid = getUid();
    if (uid) return getDocData('goals', []);
    try { const data = await AsyncStorage.getItem(KEYS.GOALS); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },

  async saveGoals(goals: Goal[]): Promise<boolean> {
    const uid = getUid();
    if (uid) return setDocData('goals', goals);
    try { await AsyncStorage.setItem(KEYS.GOALS, JSON.stringify(goals)); return true; } catch (e) { return false; }
  },

  async addGoal(goal: Partial<Goal>): Promise<Goal> {
    const goals = await this.getGoals();
    const newGoal = { ...goal, id: generateId(), createdAt: new Date().toISOString(), deposits: [] } as Goal;
    goals.push(newGoal);
    await this.saveGoals(goals);
    return newGoal;
  },

  async updateGoal(id: string, changes: Partial<Goal>): Promise<Goal[]> {
    const goals = await this.getGoals();
    const idx = goals.findIndex((g: any) => g.id === id);
    if (idx >= 0) {
      goals[idx] = { ...goals[idx], ...changes };
      await this.saveGoals(goals);
    }
    return goals;
  },

  async deleteGoal(id: string): Promise<void> {
    const goals = await this.getGoals();
    await this.saveGoals(goals.filter((g: any) => g.id !== id));
  },

  async addGoalDeposit(goalId: string, amount: number, note?: string): Promise<GoalDeposit | null> {
    const goals = await this.getGoals();
    const idx = goals.findIndex((g: any) => g.id === goalId);
    if (idx >= 0) {
      const deposit = { id: generateId(), amount, note: note || '', date: new Date().toISOString() };
      goals[idx].deposits = [...(goals[idx].deposits || []), deposit];
      await this.saveGoals(goals);
      return deposit;
    }
    return null;
  },

  // ─── RECURRING PAYMENTS ──────────────────────────────────
  async getRecurring(): Promise<Recurring[]> {
    const uid = getUid();
    if (uid) {
      try {
        const snap = await userCol('recurring').get();
        const items: any[] = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
        return items.sort((a: any, b: any) => (a.nextDate || '').localeCompare(b.nextDate || ''));
      } catch (e) { return []; }
    }
    try { const data = await AsyncStorage.getItem(KEYS.RECURRING); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },

  async saveRecurring(items: Recurring[]): Promise<boolean> {
    const uid = getUid();
    if (uid) {
      try {
        const snap = await userCol('recurring').get();
        await Promise.all(snap.docs.map((d: any) => d.ref.delete()));
        await Promise.all(items.map((r: any) => {
          const { id, ...rest } = r;
          return firestore().collection('users').doc(uid).collection('recurring').doc(id || generateId()).set(rest);
        }));
        return true;
      } catch (e) { return false; }
    }
    try { await AsyncStorage.setItem(KEYS.RECURRING, JSON.stringify(items)); return true; } catch (e) { return false; }
  },

  async addRecurring(item: Partial<Recurring>): Promise<Recurring | null> {
    const uid = getUid();
    const newItem: any = { ...item, completedCount: 0, isActive: true, createdAt: new Date().toISOString() };
    try {
      if (uid) {
        const ref = await userCol('recurring').add(newItem);
        newItem.id = ref.id;
      } else {
        newItem.id = generateId();
        const items = await this.getRecurring();
        items.push(newItem);
        await AsyncStorage.setItem(KEYS.RECURRING, JSON.stringify(items));
      }
      return newItem;
    } catch (e) { return null; }
  },

  async updateRecurring(id: string, changes: Partial<Recurring>): Promise<boolean> {
    const uid = getUid();
    try {
      if (uid) {
        await firestore().collection('users').doc(uid).collection('recurring').doc(id).update(changes);
      } else {
        const items = await this.getRecurring();
        await AsyncStorage.setItem(KEYS.RECURRING, JSON.stringify(items.map((r: any) => r.id === id ? { ...r, ...changes } : r)));
      }
      return true;
    } catch (e) { return false; }
  },

  async deleteRecurring(id: string): Promise<boolean> {
    const uid = getUid();
    try {
      if (uid) {
        await firestore().collection('users').doc(uid).collection('recurring').doc(id).delete();
      } else {
        const items = await this.getRecurring();
        await AsyncStorage.setItem(KEYS.RECURRING, JSON.stringify(items.filter((r: any) => r.id !== id)));
      }
      return true;
    } catch (e) { return false; }
  },

  async confirmRecurring(id: string, overrides: { amount?: number; account?: string; toAccount?: string; date?: string } = {}): Promise<boolean> {
    try {
      const uid = getUid();
      let rec: any;
      if (uid) {
        const snap = await firestore().collection('users').doc(uid).collection('recurring').doc(id).get();
        rec = (snap as any).exists ? { ...snap.data(), id } : null;
      } else {
        const items = await this.getRecurring();
        rec = items.find((r: any) => r.id === id);
      }
      if (!rec) return false;

      const amount = overrides.amount != null ? overrides.amount : rec.amount;
      const account = overrides.account || rec.account;
      const toAccount = overrides.toAccount || rec.toAccount;
      const date = overrides.date || new Date().toISOString();

      if (rec.isTransfer && toAccount) {
        // Scheduled transfer: materialize as a linked expense/income pair
        // so running balances and account filters behave like a one-off
        // transfer created from AddTransactionModal.
        const pairId = generateId();
        const accs = await this.getAccounts();
        const fromName = accs.find((a: any) => a.id === account)?.name || '';
        const toName = accs.find((a: any) => a.id === toAccount)?.name || '';
        await this.addTransaction({
          type: 'expense', amount, categoryId: 'transfer', icon: 'repeat',
          recipient: toName, note: rec.note || `→ ${toName}`,
          currency: rec.currency || '₪', date,
          account, isTransfer: true, transferPairId: pairId,
          tags: rec.tags || [],
        });
        await this.addTransaction({
          type: 'income', amount, categoryId: 'transfer', icon: 'repeat',
          recipient: fromName, note: rec.note || `← ${fromName}`,
          currency: rec.currency || '₪', date,
          account: toAccount, isTransfer: true, transferPairId: pairId,
          tags: rec.tags || [],
        });
      } else {
        await this.addTransaction({
          type: rec.type,
          amount,
          categoryId: rec.categoryId,
          icon: rec.icon || 'repeat',
          recipient: rec.recipient || '',
          note: rec.note || '',
          currency: rec.currency || '₪',
          date,
          account,
          tags: rec.tags || [],
        });
      }

      const next = new Date(rec.nextDate);
      next.setMonth(next.getMonth() + (rec.intervalMonths || 1));
      const newCount = (rec.completedCount || 0) + 1;

      let stillActive = true;
      if (rec.endType === 'count' && newCount >= (rec.totalCount || 1)) stillActive = false;
      if (rec.endType === 'date' && rec.endDate && next > new Date(rec.endDate)) stillActive = false;

      await this.updateRecurring(id, {
        nextDate: next.toISOString().slice(0, 10),
        completedCount: newCount,
        isActive: stillActive,
      });
      return true;
    } catch (e) { return false; }
  },

  // Auto-execute due recurring payments. Loops over active recurring items
  // and confirms (creates a transaction + advances nextDate) any whose
  // nextDate has passed AND have autoConfirm=true.
  // Designed to be called once at app startup. Returns count of confirmed.
  // Loops until no more due items exist (handles the case where multiple
  // intervals were missed while the app was closed).
  async autoExecuteRecurring(): Promise<number> {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      let confirmed = 0;
      // Safety limit so a misconfigured item can't loop forever
      const MAX_ITERATIONS = 100;
      for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        const items = await this.getRecurring();
        const due = items.filter((r: any) =>
          r.isActive !== false &&
          r.autoConfirm === true &&
          r.nextDate &&
          r.nextDate <= todayStr
        );
        if (due.length === 0) break;
        for (const rec of due) {
          // Use the nextDate as the transaction date so missed-month
          // catchups land on the correct historical month.
          await this.confirmRecurring(rec.id, { date: new Date(rec.nextDate).toISOString() });
          confirmed++;
        }
      }
      if (__DEV__ && confirmed > 0) console.log('[autoExecuteRecurring] confirmed:', confirmed);
      return confirmed;
    } catch (e) {
      if (__DEV__) console.error('autoExecuteRecurring:', e);
      return 0;
    }
  },

  async skipRecurring(id: string, overrides: { nextDate?: string } = {}): Promise<boolean> {
    try {
      const uid = getUid();
      let rec: any;
      if (uid) {
        const snap = await firestore().collection('users').doc(uid).collection('recurring').doc(id).get();
        rec = (snap as any).exists ? { ...snap.data(), id } : null;
      } else {
        const items = await this.getRecurring();
        rec = items.find((r: any) => r.id === id);
      }
      if (!rec) return false;

      // If caller supplied an explicit next-occurrence date, honor it.
      // Otherwise shift forward by one interval from the current nextDate.
      let next;
      if (overrides.nextDate) {
        next = new Date(overrides.nextDate);
      } else {
        next = new Date(rec.nextDate);
        next.setMonth(next.getMonth() + (rec.intervalMonths || 1));
      }

      let stillActive = true;
      if (rec.endType === 'date' && rec.endDate && next > new Date(rec.endDate)) stillActive = false;

      await this.updateRecurring(id, {
        nextDate: next.toISOString().slice(0, 10),
        isActive: stillActive,
      });
      return true;
    } catch (e) { return false; }
  },

  // ─── TAGS ────────────────────────────────────────────────
  async getTags(): Promise<string[]> {
    const uid = getUid();
    if (uid) return getDocData('tags', []);
    try { const data = await AsyncStorage.getItem(KEYS.TAGS); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },

  async saveTags(tags: string[]): Promise<boolean> {
    const uid = getUid();
    if (uid) return setDocData('tags', tags);
    try { await AsyncStorage.setItem(KEYS.TAGS, JSON.stringify(tags)); return true; } catch (e) { return false; }
  },

  async addTag(tag: string): Promise<boolean> {
    try {
      const tags = await this.getTags();
      if (!tags.includes(tag)) {
        tags.push(tag);
        await this.saveTags(tags);
      }
      return true;
    } catch (e) { return false; }
  },

  async deleteTag(tag: string): Promise<boolean> {
    try {
      const tags = await this.getTags();
      await this.saveTags(tags.filter((t: string) => t !== tag));
      return true;
    } catch (e) { return false; }
  },

  // ─── QUICK TEMPLATES ─────────────────────────────────────
  // After a transaction is saved, check whether the user has repeated the same
  // pattern (categoryId + account) at least 3 times in the last 30 days, has
  // no matching template yet, and hasn't dismissed this exact pattern before.
  // Returns { categoryId, account } or null.
  async suggestQuickTemplate(justAdded: any) {
    try {
      if (!justAdded || !justAdded.categoryId || justAdded.type !== 'expense') return null;
      const [txs, templates, dismissedRaw] = await Promise.all([
        this.getTransactions(),
        this.getQuickTemplates(),
        AsyncStorage.getItem('quick_template_suggest_dismissed'),
      ]);
      const dismissed: string[] = dismissedRaw ? JSON.parse(dismissedRaw) : [];
      const patternKey = `${justAdded.categoryId}|${justAdded.account || ''}`;

      // Already a template for this exact pattern? Skip.
      const exists = templates.some((t: any) => t.categoryId === justAdded.categoryId && (t.account || '') === (justAdded.account || ''));
      if (exists) return null;

      // Already dismissed this pattern? Skip.
      if (dismissed.includes(patternKey)) return null;

      // Count matching transactions in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const matches = txs.filter((t: any) =>
        t.type === 'expense' &&
        t.categoryId === justAdded.categoryId &&
        (t.account || '') === (justAdded.account || '') &&
        new Date(t.date || t.createdAt || 0) >= thirtyDaysAgo
      );
      if (matches.length < 3) return null;

      return { categoryId: justAdded.categoryId, account: justAdded.account || null, count: matches.length };
    } catch (e) {
      if (__DEV__) console.error('suggestQuickTemplate:', e);
      return null;
    }
  },

  async dismissQuickTemplateSuggestion(categoryId: string, account?: string) {
    try {
      const raw = await AsyncStorage.getItem('quick_template_suggest_dismissed');
      const list: string[] = raw ? JSON.parse(raw) : [];
      const key = `${categoryId}|${account || ''}`;
      if (!list.includes(key)) list.push(key);
      await AsyncStorage.setItem('quick_template_suggest_dismissed', JSON.stringify(list));
    } catch (e) { /* noop */ }
  },

  // Manual product-name overrides for ShoppingList grouping.
  // Stored as { "lower-case alias name": "Canonical Display Name" }.
  // When the matcher sees "lower-case alias name", it's treated as belonging
  // to whichever group already has that canonical display name.
  async getProductMergeOverrides(): Promise<Record<string, string>> {
    try {
      const raw = await AsyncStorage.getItem('product_merge_overrides');
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  },

  async saveProductMergeOverride(aliasName: string, canonicalName?: string) {
    try {
      const raw = await AsyncStorage.getItem('product_merge_overrides');
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      const key = String(aliasName || '').trim().toLowerCase();
      if (!key) return;
      if (canonicalName) map[key] = String(canonicalName).trim();
      else delete map[key];
      await AsyncStorage.setItem('product_merge_overrides', JSON.stringify(map));
    } catch (e) { /* noop */ }
  },

  async getQuickTemplates(): Promise<QuickTemplate[]> {
    const uid = getUid();
    if (uid) return getDocData('quickTemplates', []);
    try { const data = await AsyncStorage.getItem(KEYS.QUICK_TEMPLATES); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },

  async saveQuickTemplates(templates: QuickTemplate[]): Promise<boolean> {
    const uid = getUid();
    if (uid) return setDocData('quickTemplates', templates);
    try { await AsyncStorage.setItem(KEYS.QUICK_TEMPLATES, JSON.stringify(templates)); return true; } catch (e) { return false; }
  },

  // ─── SHOPPING LIST ────────────────────────────────────────
  // Stored as { manualItems: [{name, price?, quantity?}], listItems: {name:true},
  // checkedItems: {name:true} } — survives app restart and cross-device sync.
  async getShoppingList(): Promise<any> {
    const uid = getUid();
    const defaults = { manualItems: [], listItems: {}, checkedItems: {} };
    if (uid) return getDocData('shoppingList', defaults);
    try { const data = await AsyncStorage.getItem(KEYS.SHOPPING_LIST); return data ? JSON.parse(data) : defaults; } catch (e) { return defaults; }
  },

  async saveShoppingList(state: any) {
    const uid = getUid();
    if (uid) return setDocData('shoppingList', state);
    try { await AsyncStorage.setItem(KEYS.SHOPPING_LIST, JSON.stringify(state)); return true; } catch (e) { return false; }
  },

  // ─── STREAKS ──────────────────────────────────────────────
  async getStreaks(): Promise<StreakData> {
    const uid = getUid();
    const defaults = { currentStreak: 0, longestStreak: 0, lastActiveDate: null, underBudgetStreak: 0, longestUnderBudget: 0, milestones: [] };
    if (uid) return getDocData('streaks', defaults);
    try { const data = await AsyncStorage.getItem(KEYS.STREAKS); return data ? JSON.parse(data) : defaults; } catch (e) { return defaults; }
  },

  async saveStreaks(streaks: StreakData): Promise<boolean> {
    const uid = getUid();
    if (uid) return setDocData('streaks', streaks);
    try { await AsyncStorage.setItem(KEYS.STREAKS, JSON.stringify(streaks)); return true; } catch (e) { return false; }
  },

  // ─── SETTINGS ────────────────────────────────────────────
  async getSettings(): Promise<Settings> {
    const uid = getUid();
    if (uid) return getDocData('settings', DEFAULT_SETTINGS);
    try { const data = await AsyncStorage.getItem(KEYS.SETTINGS); return data ? JSON.parse(data) : DEFAULT_SETTINGS; } catch (e) { return DEFAULT_SETTINGS; }
  },

  async saveSettings(settings: Partial<Settings>): Promise<boolean> {
    const uid = getUid();
    if (uid) return setDocData('settings', settings);
    try { await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings)); return true; } catch (e) { return false; }
  },

  // ─── UTILITIES ───────────────────────────────────────────
  async clearAllData() {
    const uid = getUid();
    if (uid) {
      try {
        const collections = ['transactions', 'accounts', 'investments', 'recurring'];
        for (const col of collections) {
          const snap = await userCol(col).get();
          await Promise.all(snap.docs.map((d: any) => d.ref.delete()));
        }
        const singleDocs = ['categories', 'budgets', 'settings', 'tags', 'streaks', 'projects', 'goals'];
        for (const name of singleDocs) {
          try { await userDoc(name + '/data').delete(); } catch (e) {}
        }
        return true;
      } catch (e) { return false; }
    }
    try { await AsyncStorage.multiRemove(Object.values(KEYS)); return true; } catch (e) { return false; }
  },

  async exportData() {
    try {
      const [transactions, accounts, investments, categories, settings, budgets, recurring, tags, streaks, projects, goals] = await Promise.all([
        this.getTransactions(), this.getAccounts(), this.getInvestments(),
        this.getCategories(), this.getSettings(), this.getBudgets(),
        this.getRecurring(), this.getTags(), this.getStreaks(), this.getProjects(), this.getGoals(),
      ]);
      return { transactions, accounts, investments, categories, settings, budgets, recurring, tags, streaks, projects, goals, exportedAt: new Date().toISOString() };
    } catch (e) { return null; }
  },

  async importData(data: any) {
    const uid = getUid();
    try {
      if (uid) {
        // Collections
        if (data.transactions) {
          for (const tx of data.transactions) {
            const { id, ...rest } = tx;
            await firestore().collection('users').doc(uid).collection('transactions').doc(id || generateId()).set(rest);
          }
        }
        if (data.accounts) {
          for (const acc of data.accounts) {
            const { id, ...rest } = acc;
            await firestore().collection('users').doc(uid).collection('accounts').doc(id || generateId()).set(rest);
          }
        }
        if (data.investments) await this.saveInvestments(data.investments);
        if (data.recurring) {
          for (const r of data.recurring) {
            const { id, ...rest } = r;
            await firestore().collection('users').doc(uid).collection('recurring').doc(id || generateId()).set(rest);
          }
        }
        // Documents
        if (data.categories) await this.saveCategories(data.categories);
        if (data.settings) await this.saveSettings(data.settings);
        if (data.budgets) await this.saveBudgets(data.budgets);
        if (data.tags) await this.saveTags(data.tags);
        if (data.projects) await this.saveProjects(data.projects);
        if (data.goals) await this.saveGoals(data.goals);
      } else {
        if (data.transactions) await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(data.transactions));
        if (data.accounts) await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(data.accounts));
        if (data.investments) await AsyncStorage.setItem(KEYS.INVESTMENTS, JSON.stringify(data.investments));
        if (data.categories) await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(data.categories));
        if (data.settings) await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
        if (data.budgets) await AsyncStorage.setItem(KEYS.BUDGETS, JSON.stringify(data.budgets));
        if (data.recurring) await AsyncStorage.setItem(KEYS.RECURRING, JSON.stringify(data.recurring));
        if (data.tags) await AsyncStorage.setItem(KEYS.TAGS, JSON.stringify(data.tags));
        if (data.projects) await AsyncStorage.setItem(KEYS.PROJECTS, JSON.stringify(data.projects));
        if (data.goals) await AsyncStorage.setItem(KEYS.GOALS, JSON.stringify(data.goals));
      }
      return true;
    } catch (e) { return false; }
  },

  // Migration: move data from AsyncStorage into Firestore.
  async migrateToFirestore() {
    const uid = getUid();
    if (!uid) return false;
    try {
      const localData: Record<string, any> = {};
      for (const [key, storageKey] of Object.entries(KEYS)) {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) localData[key.toLowerCase()] = JSON.parse(raw);
      }
      if (Object.keys(localData).length === 0) return false; // nothing to migrate
      await this.importData(localData);
      // Clear AsyncStorage after a successful migration.
      await AsyncStorage.multiRemove(Object.values(KEYS));
      return true;
    } catch (e) { if (__DEV__) console.error('Migration error:', e); return false; }
  },

  async recalculateBalances() {
    try {
      const transactions = await this.getTransactions();
      const accounts = await this.getAccounts();
      const balances: Record<string, number> = {};
      accounts.forEach((a: any) => { balances[a.id] = 0; });
      transactions.forEach((tx: any) => {
        if (tx.account && balances[tx.account] !== undefined) {
          if (tx.type === 'income') balances[tx.account] += tx.amount;
          else if (tx.type === 'expense') balances[tx.account] -= tx.amount;
        }
      });
      const updated = accounts.map((a: any) => ({ ...a, balance: balances[a.id] !== undefined ? balances[a.id] : a.balance }));
      await this.saveAccounts(updated);
      return true;
    } catch (e) { return false; }
  },
};

export default dataService;
