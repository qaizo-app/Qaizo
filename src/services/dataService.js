// src/services/dataService.js
// Firestore (залогинен) ←→ AsyncStorage (гостевой режим)

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs,
  orderBy, query, setDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
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
  return doc(db, 'users', uid, ...path.split('/'));
}

function userCol(colName) {
  const uid = getUid();
  return collection(db, 'users', uid, colName);
}

// ─── Чтение / запись одного документа (settings, budgets, categories, tags) ──
async function getDocData(colName, defaultVal) {
  try {
    const snap = await getDoc(userDoc(colName + '/data'));
    return snap.exists() ? snap.data().value : defaultVal;
  } catch (e) {
    console.error(`Firestore getDocData(${colName}):`, e);
    return defaultVal;
  }
}

async function setDocData(colName, value) {
  try {
    await setDoc(userDoc(colName + '/data'), { value, updatedAt: new Date().toISOString() });
    return true;
  } catch (e) {
    console.error(`Firestore setDocData(${colName}):`, e);
    return false;
  }
}

// ─── Чтение / запись коллекции (transactions, accounts, investments, recurring) ──
async function getColDocs(colName, defaultVal = []) {
  try {
    const q = query(userCol(colName), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) {
    // если orderBy не работает (нет индекса), пробуем без сортировки
    try {
      const snap = await getDocs(userCol(colName));
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      return items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (e2) {
      console.error(`Firestore getColDocs(${colName}):`, e2);
      return defaultVal;
    }
  }
}

// ─── Обновить баланс счёта ────────────────────────────────
async function updateAccountBalance(accountId, amount, type) {
  const uid = getUid();
  try {
    if (uid) {
      const ref = doc(db, 'users', uid, 'accounts', accountId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        let bal = snap.data().balance || 0;
        if (type === 'income') bal += amount;
        else if (type === 'expense') bal -= amount;
        await updateDoc(ref, { balance: bal });
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
    console.error('Error updating account balance:', e);
  }
}

// ─────────────────────────────────────────────────────────
const dataService = {

  // ─── TRANSACTIONS ────────────────────────────────────────
  async getTransactions() {
    const uid = getUid();
    console.log('getTransactions uid:', uid ? 'logged in' : 'guest');
    if (uid) return getColDocs('transactions');
    try {
      const data = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
      const txs = data ? JSON.parse(data) : [];
      console.log('getTransactions from AsyncStorage:', txs.length);
      return txs;
    } catch (e) { console.error('getTransactions error:', e); return []; }
  },

  async addTransaction(transaction) {
    const uid = getUid();
    const newTx = { ...transaction, createdAt: new Date().toISOString() };
    try {
      if (uid) {
        const ref = await addDoc(userCol('transactions'), newTx);
        newTx.id = ref.id;
      } else {
        newTx.id = generateId();
        const txs = await this.getTransactions();
        await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify([newTx, ...txs]));
      }
      if (newTx.account) await updateAccountBalance(newTx.account, newTx.amount, newTx.type);
      return newTx;
    } catch (e) { console.error('addTransaction:', e); return null; }
  },

  async deleteTransaction(id) {
    const uid = getUid();
    try {
      if (uid) {
        const ref = doc(db, 'users', uid, 'transactions', id);
        const snap = await getDoc(ref);
        const tx = snap.exists() ? { ...snap.data(), id } : null;
        await deleteDoc(ref);
        if (tx && tx.account) {
          const reverseType = tx.type === 'income' ? 'expense' : 'income';
          await updateAccountBalance(tx.account, tx.amount, reverseType);
        }
        // Каскадное удаление парной транзакции перевода
        if (tx && tx.transferPairId) {
          const allSnap = await getDocs(userCol('transactions'));
          const pair = allSnap.docs.find(d => d.data().transferPairId === tx.transferPairId && d.id !== id);
          if (pair) {
            const pairData = pair.data();
            await deleteDoc(pair.ref);
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
    } catch (e) { console.error('deleteTransaction:', e); return false; }
  },

  async updateTransaction(id, changes) {
    const uid = getUid();
    try {
      if (uid) {
        const ref = doc(db, 'users', uid, 'transactions', id);
        const snap = await getDoc(ref);
        const oldTx = snap.exists() ? { ...snap.data(), id } : null;
        await updateDoc(ref, changes);
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
    } catch (e) { console.error('updateTransaction:', e); return false; }
  },

  // ─── ACCOUNTS ────────────────────────────────────────────
  async getAccounts() {
    const uid = getUid();
    if (uid) {
      try {
        const snap = await getDocs(userCol('accounts'));
        const accs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
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
        // Перезаписываем все документы
        const snap = await getDocs(userCol('accounts'));
        const deletes = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletes);
        const writes = accounts.map(a => {
          const { id, ...rest } = a;
          return setDoc(doc(db, 'users', uid, 'accounts', id), rest);
        });
        await Promise.all(writes);
        return true;
      } catch (e) { console.error('saveAccounts:', e); return false; }
    }
    try { await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts)); return true; } catch (e) { return false; }
  },

  async addAccount(account) {
    const uid = getUid();
    try {
      if (uid) {
        const id = generateId();
        const { id: _, ...rest } = account;
        await setDoc(doc(db, 'users', uid, 'accounts', id), { ...rest, createdAt: new Date().toISOString() });
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
        await updateDoc(doc(db, 'users', uid, 'accounts', id), changes);
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
        await deleteDoc(doc(db, 'users', uid, 'accounts', id));
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
        const snap = await getDocs(userCol('investments'));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
        await Promise.all(investments.map(inv => {
          const { id, ...rest } = inv;
          return setDoc(doc(db, 'users', uid, 'investments', id || generateId()), { ...rest, createdAt: rest.createdAt || new Date().toISOString() });
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

  // ─── RECURRING PAYMENTS ──────────────────────────────────
  async getRecurring() {
    const uid = getUid();
    if (uid) {
      try {
        const snap = await getDocs(userCol('recurring'));
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
        const snap = await getDocs(userCol('recurring'));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
        await Promise.all(items.map(r => {
          const { id, ...rest } = r;
          return setDoc(doc(db, 'users', uid, 'recurring', id || generateId()), rest);
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
        const ref = await addDoc(userCol('recurring'), newItem);
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
        await updateDoc(doc(db, 'users', uid, 'recurring', id), changes);
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
        await deleteDoc(doc(db, 'users', uid, 'recurring', id));
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
        const snap = await getDoc(doc(db, 'users', uid, 'recurring', id));
        rec = snap.exists() ? { ...snap.data(), id } : null;
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
        const snap = await getDoc(doc(db, 'users', uid, 'recurring', id));
        rec = snap.exists() ? { ...snap.data(), id } : null;
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
          const snap = await getDocs(userCol(col));
          await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
        }
        const singleDocs = ['categories', 'budgets', 'settings', 'tags', 'streaks', 'projects'];
        for (const name of singleDocs) {
          try { await deleteDoc(userDoc(name + '/data')); } catch (e) {}
        }
        return true;
      } catch (e) { return false; }
    }
    try { await AsyncStorage.multiRemove(Object.values(KEYS)); return true; } catch (e) { return false; }
  },

  async exportData() {
    try {
      const [transactions, accounts, investments, categories, settings, budgets, recurring, tags, streaks, projects] = await Promise.all([
        this.getTransactions(), this.getAccounts(), this.getInvestments(),
        this.getCategories(), this.getSettings(), this.getBudgets(),
        this.getRecurring(), this.getTags(), this.getStreaks(), this.getProjects(),
      ]);
      return { transactions, accounts, investments, categories, settings, budgets, recurring, tags, streaks, projects, exportedAt: new Date().toISOString() };
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
            await setDoc(doc(db, 'users', uid, 'transactions', id || generateId()), rest);
          }
        }
        if (data.accounts) {
          for (const acc of data.accounts) {
            const { id, ...rest } = acc;
            await setDoc(doc(db, 'users', uid, 'accounts', id || generateId()), rest);
          }
        }
        if (data.investments) await this.saveInvestments(data.investments);
        if (data.recurring) {
          for (const r of data.recurring) {
            const { id, ...rest } = r;
            await setDoc(doc(db, 'users', uid, 'recurring', id || generateId()), rest);
          }
        }
        // Документы
        if (data.categories) await this.saveCategories(data.categories);
        if (data.settings) await this.saveSettings(data.settings);
        if (data.budgets) await this.saveBudgets(data.budgets);
        if (data.tags) await this.saveTags(data.tags);
        if (data.projects) await this.saveProjects(data.projects);
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
    } catch (e) { console.error('Migration error:', e); return false; }
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
