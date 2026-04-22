// src/services/dataService.js
// Firestore (залогинен) ←→ AsyncStorage (гостевой режим)

import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import authService from './authService';

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

const DEFAULT_ACCOUNTS = [
  { id: 'cash_ils', name: 'Cash ₪', type: 'cash', icon: 'wallet-outline', balance: 0, currency: '₪', isActive: true },
];

const DEFAULT_CATEGORIES = {
  income: [
    { id: 'salary_me', icon: 'briefcase', color: '#22c55e' },
    { id: 'salary_spouse', icon: 'briefcase', color: '#10b981' },
    { id: 'handyman', icon: 'tool', color: '#34d399' },
    { id: 'sales', icon: 'package', color: '#6ee7b7' },
    { id: 'rental_income', icon: 'home', color: '#059669' },
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

const DEFAULT_SETTINGS = { language: 'ru', currency: '₪', theme: 'dark', weekStart: 'sunday' };

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Firestore helpers ────────────────────────────────────
function getUid() {
  return authService.getUid();
}

function userDoc(path) {
  const uid = getUid();
  const parts = path.split('/');
  let ref = firestore().collection('users').doc(uid);
  for (let i = 0; i < parts.length; i++) {
    ref = i % 2 === 0 ? ref.collection(parts[i]) : ref.doc(parts[i]);
  }
  return ref;
}

function userCol(colName) {
  const uid = getUid();
  return firestore().collection('users').doc(uid).collection(colName);
}

// ─── Чтение / запись одного документа (settings, budgets, categories, tags) ──
async function getDocData(colName, defaultVal) {
  try {
    const snap = await userDoc(colName + '/data').get();
    return snap.exists ? snap.data().value : defaultVal;
  } catch (e) {
    if (__DEV__) console.error(`Firestore getDocData(${colName}):`, e);
    return defaultVal;
  }
}

async function setDocData(colName, value) {
  try {
    await userDoc(colName + '/data').set({ value, updatedAt: new Date().toISOString() });
    return true;
  } catch (e) {
    if (__DEV__) console.error(`Firestore setDocData(${colName}):`, e);
    return false;
  }
}

// ─── Чтение / запись коллекции (transactions, accounts, investments, recurring) ──
async function getColDocs(colName, defaultVal = []) {
  try {
    const snap = await userCol(colName).orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) {
    try {
      const snap = await userCol(colName).get();
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      return items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (e2) {
      if (__DEV__) console.error(`Firestore getColDocs(${colName}):`, e2);
      return defaultVal;
    }
  }
}

// ─── Обновить баланс счёта ────────────────────────────────
async function updateAccountBalance(accountId, amount, type) {
  const uid = getUid();
  try {
    if (uid) {
      const ref = firestore().collection('users').doc(uid).collection('accounts').doc(accountId);
      const snap = await ref.get();
      if (snap.exists) {
        let bal = snap.data().balance || 0;
        if (type === 'income') bal += amount;
        else if (type === 'expense') bal -= amount;
        await ref.update({ balance: bal });
      }
    } else {
      const data = await AsyncStorage.getItem(KEYS.ACCOUNTS);
      const accounts = data ? JSON.parse(data) : DEFAULT_ACCOUNTS;
      const updated = accounts.map(a => {
        if (a.id === accountId) {
          let newBalance = a.balance || 0;
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

// ─────────────────────────────────────────────────────────
const dataService = {

  // ─── TRANSACTIONS ────────────────────────────────────────
  async getTransactions() {
    const uid = getUid();
    if (uid) return getColDocs('transactions');
    try {
      const data = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
      const txs = data ? JSON.parse(data) : [];
      return txs;
    } catch (e) { if (__DEV__) console.error('getTransactions error:', e); return []; }
  },

  async addTransaction(transaction) {
    const uid = getUid();
    const newTx = { ...transaction, createdAt: new Date().toISOString() };
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
      return newTx;
    } catch (e) { if (__DEV__) console.error('addTransaction:', e); return null; }
  },

  async deleteTransaction(id) {
    const uid = getUid();
    try {
      if (uid) {
        const ref = firestore().collection('users').doc(uid).collection('transactions').doc(id);
        const snap = await ref.get();
        const tx = snap.exists ? { ...snap.data(), id } : null;
        await ref.delete();
        if (tx && tx.account) {
          const reverseType = tx.type === 'income' ? 'expense' : 'income';
          await updateAccountBalance(tx.account, tx.amount, reverseType);
        }
        // Каскадное удаление парной транзакции перевода
        if (tx && tx.transferPairId) {
          const allSnap = await userCol('transactions').get();
          const pair = allSnap.docs.find(d => d.data().transferPairId === tx.transferPairId && d.id !== id);
          if (pair) {
            const pairData = pair.data();
            await pair.ref.delete();
            if (pairData.account) {
              const pairReverse = pairData.type === 'income' ? 'expense' : 'income';
              await updateAccountBalance(pairData.account, pairData.amount, pairReverse);
            }
          }
        }
      } else {
        const txs = await this.getTransactions();
        const tx = txs.find(t => t.id === id);
        let filtered = txs.filter(t => t.id !== id);
        if (tx && tx.account) {
          const reverseType = tx.type === 'income' ? 'expense' : 'income';
          await updateAccountBalance(tx.account, tx.amount, reverseType);
        }
        // Каскадное удаление парной транзакции перевода
        if (tx && tx.transferPairId) {
          const pair = filtered.find(t => t.transferPairId === tx.transferPairId);
          if (pair) {
            filtered = filtered.filter(t => t.id !== pair.id);
            if (pair.account) {
              const pairReverse = pair.type === 'income' ? 'expense' : 'income';
              await updateAccountBalance(pair.account, pair.amount, pairReverse);
            }
          }
        }
        await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(filtered));
      }
      return true;
    } catch (e) { if (__DEV__) console.error('deleteTransaction:', e); return false; }
  },

  async updateTransaction(id, changes) {
    const uid = getUid();
    try {
      if (uid) {
        const ref = firestore().collection('users').doc(uid).collection('transactions').doc(id);
        const snap = await ref.get();
        const oldTx = snap.exists ? { ...snap.data(), id } : null;
        await ref.update(changes);
        // Пересчёт балансов
        if (oldTx && oldTx.account) {
          const reverseType = oldTx.type === 'income' ? 'expense' : 'income';
          await updateAccountBalance(oldTx.account, oldTx.amount, reverseType);
        }
        const newTx = { ...oldTx, ...changes };
        if (newTx.account) await updateAccountBalance(newTx.account, newTx.amount, newTx.type);
      } else {
        const txs = await this.getTransactions();
        const oldTx = txs.find(t => t.id === id);
        await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(txs.map(t => t.id === id ? { ...t, ...changes } : t)));
        if (oldTx && oldTx.account) {
          const reverseType = oldTx.type === 'income' ? 'expense' : 'income';
          await updateAccountBalance(oldTx.account, oldTx.amount, reverseType);
        }
        const newTx = { ...oldTx, ...changes };
        if (newTx.account) await updateAccountBalance(newTx.account, newTx.amount, newTx.type);
      }
      return true;
    } catch (e) { if (__DEV__) console.error('updateTransaction:', e); return false; }
  },

  // ─── ACCOUNTS ────────────────────────────────────────────
  async getAccounts() {
    const uid = getUid();
    if (uid) {
      try {
        const snap = await userCol('accounts').get();
        const accs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        // Sort by 'order' field (manual ordering); fallback to original order
        accs.sort((a, b) => {
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

  async saveAccounts(accounts) {
    const uid = getUid();
    if (uid) {
      try {
        // Перезаписываем все документы с явным порядком
        const snap = await userCol('accounts').get();
        const deletes = snap.docs.map(d => d.ref.delete());
        await Promise.all(deletes);
        const writes = accounts.map((a, i) => {
          const { id, ...rest } = a;
          return firestore().collection('users').doc(uid).collection('accounts').doc(id).set({ ...rest, order: i });
        });
        await Promise.all(writes);
        return true;
      } catch (e) { if (__DEV__) console.error('saveAccounts:', e); return false; }
    }
    try { await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts)); return true; } catch (e) { return false; }
  },

  async addAccount(account) {
    const uid = getUid();
    try {
      if (uid) {
        const id = generateId();
        const { id: _, ...rest } = account;
        await firestore().collection('users').doc(uid).collection('accounts').doc(id).set({ ...rest, createdAt: new Date().toISOString() });
        return { ...account, id };
      } else {
        const accounts = await this.getAccounts();
        const newAcc = { ...account, id: generateId() };
        accounts.push(newAcc);
        await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts));
        return newAcc;
      }
    } catch (e) { return null; }
  },

  async updateAccount(id, changes) {
    const uid = getUid();
    try {
      if (uid) {
        await firestore().collection('users').doc(uid).collection('accounts').doc(id).update(changes);
      } else {
        const accounts = await this.getAccounts();
        await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts.map(a => a.id === id ? { ...a, ...changes } : a)));
      }
      return true;
    } catch (e) { return false; }
  },

  async deleteAccount(id) {
    const uid = getUid();
    try {
      if (uid) {
        await firestore().collection('users').doc(uid).collection('accounts').doc(id).delete();
      } else {
        const accounts = await this.getAccounts();
        await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts.filter(a => a.id !== id)));
      }
      return true;
    } catch (e) { return false; }
  },

  // ─── INVESTMENTS ─────────────────────────────────────────
  async getInvestments() {
    const uid = getUid();
    if (uid) return getColDocs('investments');
    try { const data = await AsyncStorage.getItem(KEYS.INVESTMENTS); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },

  async saveInvestments(investments) {
    const uid = getUid();
    if (uid) {
      try {
        const snap = await userCol('investments').get();
        await Promise.all(snap.docs.map(d => d.ref.delete()));
        await Promise.all(investments.map(inv => {
          const { id, ...rest } = inv;
          return firestore().collection('users').doc(uid).collection('investments').doc(id || generateId()).set({ ...rest, createdAt: rest.createdAt || new Date().toISOString() });
        }));
        return true;
      } catch (e) { return false; }
    }
    try { await AsyncStorage.setItem(KEYS.INVESTMENTS, JSON.stringify(investments)); return true; } catch (e) { return false; }
  },

  // ─── CATEGORIES ──────────────────────────────────────────
  async getCategories() {
    const uid = getUid();
    if (uid) return getDocData('categories', DEFAULT_CATEGORIES);
    try { const data = await AsyncStorage.getItem(KEYS.CATEGORIES); return data ? JSON.parse(data) : DEFAULT_CATEGORIES; } catch (e) { return DEFAULT_CATEGORIES; }
  },

  async saveCategories(categories) {
    const uid = getUid();
    if (uid) return setDocData('categories', categories);
    try { await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories)); return true; } catch (e) { return false; }
  },

  // ─── BUDGETS ─────────────────────────────────────────────
  async getBudgets() {
    const uid = getUid();
    if (uid) return getDocData('budgets', {});
    try { const data = await AsyncStorage.getItem(KEYS.BUDGETS); return data ? JSON.parse(data) : {}; } catch (e) { return {}; }
  },

  async saveBudgets(budgets) {
    const uid = getUid();
    if (uid) return setDocData('budgets', budgets);
    try { await AsyncStorage.setItem(KEYS.BUDGETS, JSON.stringify(budgets)); return true; } catch (e) { return false; }
  },

  async setBudget(categoryId, limit) {
    try {
      const budgets = await this.getBudgets();
      if (limit > 0) budgets[categoryId] = limit;
      else delete budgets[categoryId];
      await this.saveBudgets(budgets);
      return true;
    } catch (e) { return false; }
  },

  async deleteBudget(categoryId) {
    return this.setBudget(categoryId, 0);
  },

  // ─── PROJECTS ────────────────────────────────────────────
  async getProjects() {
    const uid = getUid();
    if (uid) return getDocData('projects', []);
    try { const data = await AsyncStorage.getItem(KEYS.PROJECTS); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },

  async saveProjects(projects) {
    const uid = getUid();
    if (uid) return setDocData('projects', projects);
    try { await AsyncStorage.setItem(KEYS.PROJECTS, JSON.stringify(projects)); return true; } catch (e) { return false; }
  },

  async addProject(project) {
    const projects = await this.getProjects();
    const newProject = { ...project, id: generateId(), createdAt: new Date().toISOString() };
    projects.push(newProject);
    await this.saveProjects(projects);
    return newProject;
  },

  async updateProject(id, changes) {
    const projects = await this.getProjects();
    const idx = projects.findIndex(p => p.id === id);
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], ...changes };
      await this.saveProjects(projects);
    }
    return projects;
  },

  async deleteProject(id) {
    const projects = await this.getProjects();
    await this.saveProjects(projects.filter(p => p.id !== id));
  },

  // ─── GOALS (מטרות חיסכון) ─────────────────────────────────
  async getGoals() {
    const uid = getUid();
    if (uid) return getDocData('goals', []);
    try { const data = await AsyncStorage.getItem(KEYS.GOALS); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },

  async saveGoals(goals) {
    const uid = getUid();
    if (uid) return setDocData('goals', goals);
    try { await AsyncStorage.setItem(KEYS.GOALS, JSON.stringify(goals)); return true; } catch (e) { return false; }
  },

  async addGoal(goal) {
    const goals = await this.getGoals();
    const newGoal = { ...goal, id: generateId(), createdAt: new Date().toISOString(), deposits: [] };
    goals.push(newGoal);
    await this.saveGoals(goals);
    return newGoal;
  },

  async updateGoal(id, changes) {
    const goals = await this.getGoals();
    const idx = goals.findIndex(g => g.id === id);
    if (idx >= 0) {
      goals[idx] = { ...goals[idx], ...changes };
      await this.saveGoals(goals);
    }
    return goals;
  },

  async deleteGoal(id) {
    const goals = await this.getGoals();
    await this.saveGoals(goals.filter(g => g.id !== id));
  },

  async addGoalDeposit(goalId, amount, note) {
    const goals = await this.getGoals();
    const idx = goals.findIndex(g => g.id === goalId);
    if (idx >= 0) {
      const deposit = { id: generateId(), amount, note: note || '', date: new Date().toISOString() };
      goals[idx].deposits = [...(goals[idx].deposits || []), deposit];
      await this.saveGoals(goals);
      return deposit;
    }
    return null;
  },

  // ─── RECURRING PAYMENTS ──────────────────────────────────
  async getRecurring() {
    const uid = getUid();
    if (uid) {
      try {
        const snap = await userCol('recurring').get();
        const items = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        return items.sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''));
      } catch (e) { return []; }
    }
    try { const data = await AsyncStorage.getItem(KEYS.RECURRING); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },

  async saveRecurring(items) {
    const uid = getUid();
    if (uid) {
      try {
        const snap = await userCol('recurring').get();
        await Promise.all(snap.docs.map(d => d.ref.delete()));
        await Promise.all(items.map(r => {
          const { id, ...rest } = r;
          return firestore().collection('users').doc(uid).collection('recurring').doc(id || generateId()).set(rest);
        }));
        return true;
      } catch (e) { return false; }
    }
    try { await AsyncStorage.setItem(KEYS.RECURRING, JSON.stringify(items)); return true; } catch (e) { return false; }
  },

  async addRecurring(item) {
    const uid = getUid();
    const newItem = { ...item, completedCount: 0, isActive: true, createdAt: new Date().toISOString() };
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

  async updateRecurring(id, changes) {
    const uid = getUid();
    try {
      if (uid) {
        await firestore().collection('users').doc(uid).collection('recurring').doc(id).update(changes);
      } else {
        const items = await this.getRecurring();
        await AsyncStorage.setItem(KEYS.RECURRING, JSON.stringify(items.map(r => r.id === id ? { ...r, ...changes } : r)));
      }
      return true;
    } catch (e) { return false; }
  },

  async deleteRecurring(id) {
    const uid = getUid();
    try {
      if (uid) {
        await firestore().collection('users').doc(uid).collection('recurring').doc(id).delete();
      } else {
        const items = await this.getRecurring();
        await AsyncStorage.setItem(KEYS.RECURRING, JSON.stringify(items.filter(r => r.id !== id)));
      }
      return true;
    } catch (e) { return false; }
  },

  async confirmRecurring(id) {
    try {
      const uid = getUid();
      let rec;
      if (uid) {
        const snap = await firestore().collection('users').doc(uid).collection('recurring').doc(id).get();
        rec = snap.exists ? { ...snap.data(), id } : null;
      } else {
        const items = await this.getRecurring();
        rec = items.find(r => r.id === id);
      }
      if (!rec) return false;

      await this.addTransaction({
        type: rec.type,
        amount: rec.amount,
        categoryId: rec.categoryId,
        icon: rec.icon || 'repeat',
        recipient: rec.recipient || '',
        note: rec.note || '',
        currency: rec.currency || '₪',
        date: new Date().toISOString(),
        account: rec.account,
        tags: rec.tags || [],
      });

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

  async skipRecurring(id) {
    try {
      const uid = getUid();
      let rec;
      if (uid) {
        const snap = await firestore().collection('users').doc(uid).collection('recurring').doc(id).get();
        rec = snap.exists ? { ...snap.data(), id } : null;
      } else {
        const items = await this.getRecurring();
        rec = items.find(r => r.id === id);
      }
      if (!rec) return false;

      const next = new Date(rec.nextDate);
      next.setMonth(next.getMonth() + (rec.intervalMonths || 1));

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
  async getTags() {
    const uid = getUid();
    if (uid) return getDocData('tags', []);
    try { const data = await AsyncStorage.getItem(KEYS.TAGS); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },

  async saveTags(tags) {
    const uid = getUid();
    if (uid) return setDocData('tags', tags);
    try { await AsyncStorage.setItem(KEYS.TAGS, JSON.stringify(tags)); return true; } catch (e) { return false; }
  },

  async addTag(tag) {
    try {
      const tags = await this.getTags();
      if (!tags.includes(tag)) {
        tags.push(tag);
        await this.saveTags(tags);
      }
      return true;
    } catch (e) { return false; }
  },

  async deleteTag(tag) {
    try {
      const tags = await this.getTags();
      await this.saveTags(tags.filter(t => t !== tag));
      return true;
    } catch (e) { return false; }
  },

  // ─── QUICK TEMPLATES ─────────────────────────────────────
  async getQuickTemplates() {
    const uid = getUid();
    if (uid) return getDocData('quickTemplates', []);
    try { const data = await AsyncStorage.getItem(KEYS.QUICK_TEMPLATES); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },

  async saveQuickTemplates(templates) {
    const uid = getUid();
    if (uid) return setDocData('quickTemplates', templates);
    try { await AsyncStorage.setItem(KEYS.QUICK_TEMPLATES, JSON.stringify(templates)); return true; } catch (e) { return false; }
  },

  // ─── SHOPPING LIST ────────────────────────────────────────
  // Stored as { manualItems: [{name, price?, quantity?}], listItems: {name:true},
  // checkedItems: {name:true} } — survives app restart and cross-device sync.
  async getShoppingList() {
    const uid = getUid();
    const defaults = { manualItems: [], listItems: {}, checkedItems: {} };
    if (uid) return getDocData('shoppingList', defaults);
    try { const data = await AsyncStorage.getItem(KEYS.SHOPPING_LIST); return data ? JSON.parse(data) : defaults; } catch (e) { return defaults; }
  },

  async saveShoppingList(state) {
    const uid = getUid();
    if (uid) return setDocData('shoppingList', state);
    try { await AsyncStorage.setItem(KEYS.SHOPPING_LIST, JSON.stringify(state)); return true; } catch (e) { return false; }
  },

  // ─── STREAKS ──────────────────────────────────────────────
  async getStreaks() {
    const uid = getUid();
    const defaults = { currentStreak: 0, longestStreak: 0, lastActiveDate: null, underBudgetStreak: 0, longestUnderBudget: 0, milestones: [] };
    if (uid) return getDocData('streaks', defaults);
    try { const data = await AsyncStorage.getItem(KEYS.STREAKS); return data ? JSON.parse(data) : defaults; } catch (e) { return defaults; }
  },

  async saveStreaks(streaks) {
    const uid = getUid();
    if (uid) return setDocData('streaks', streaks);
    try { await AsyncStorage.setItem(KEYS.STREAKS, JSON.stringify(streaks)); return true; } catch (e) { return false; }
  },

  // ─── SETTINGS ────────────────────────────────────────────
  async getSettings() {
    const uid = getUid();
    if (uid) return getDocData('settings', DEFAULT_SETTINGS);
    try { const data = await AsyncStorage.getItem(KEYS.SETTINGS); return data ? JSON.parse(data) : DEFAULT_SETTINGS; } catch (e) { return DEFAULT_SETTINGS; }
  },

  async saveSettings(settings) {
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
          await Promise.all(snap.docs.map(d => d.ref.delete()));
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

  async importData(data) {
    const uid = getUid();
    try {
      if (uid) {
        // Коллекции
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
        // Документы
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

  // Миграция: перенести данные из AsyncStorage в Firestore
  async migrateToFirestore() {
    const uid = getUid();
    if (!uid) return false;
    try {
      const localData = {};
      for (const [key, storageKey] of Object.entries(KEYS)) {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) localData[key.toLowerCase()] = JSON.parse(raw);
      }
      if (Object.keys(localData).length === 0) return false; // нечего мигрировать
      await this.importData(localData);
      // Очищаем AsyncStorage после успешной миграции
      await AsyncStorage.multiRemove(Object.values(KEYS));
      return true;
    } catch (e) { if (__DEV__) console.error('Migration error:', e); return false; }
  },

  async recalculateBalances() {
    try {
      const transactions = await this.getTransactions();
      const accounts = await this.getAccounts();
      const balances = {};
      accounts.forEach(a => { balances[a.id] = 0; });
      transactions.forEach(tx => {
        if (tx.account && balances[tx.account] !== undefined) {
          if (tx.type === 'income') balances[tx.account] += tx.amount;
          else if (tx.type === 'expense') balances[tx.account] -= tx.amount;
        }
      });
      const updated = accounts.map(a => ({ ...a, balance: balances[a.id] !== undefined ? balances[a.id] : a.balance }));
      await this.saveAccounts(updated);
      return true;
    } catch (e) { return false; }
  },
};

export default dataService;
