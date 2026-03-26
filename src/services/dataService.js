// src/services/dataService.js
// ПРОСЛОЙКА — единственная точка входа в базу данных
// ОБНОВЛЕНО: мигрировано с AsyncStorage на Firebase Firestore
// MERGED: добавлены Budgets и Recurring Payments (от Alex)

import { db } from '../config/firebase';
import {
  collection, doc,
  getDocs, getDoc,
  addDoc, setDoc, updateDoc, deleteDoc,
  writeBatch, increment,
} from 'firebase/firestore';

// ─── User ID ──────────────────────────────────────────────
// Phase 2: replace with auth.currentUser.uid when Firebase Auth is added
const USER_ID = 'test-user-001';

// ─── Helpers ──────────────────────────────────────────────
const col = (name) => collection(db, 'users', USER_ID, name);
const dref = (name, id) => doc(db, 'users', USER_ID, name, id);

// ─── Defaults ─────────────────────────────────────────────
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

const DEFAULT_SETTINGS = { language: 'ru', currency: '₪', theme: 'dark' };

// ─── Normalize a Firestore Timestamp or string to ISO string ──
function normalizeDate(value) {
  if (!value) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return value;
}

// ─── Update account balance atomically ────────────────────
async function _updateAccountBalance(accountId, amount, type) {
  try {
    const delta = type === 'income' ? amount : type === 'expense' ? -amount : 0;
    if (delta === 0) return;
    await updateDoc(dref('accounts', accountId), { balance: increment(delta) });
  } catch (e) {
    console.error('Error updating account balance:', e);
  }
}

// ─── Map a Firestore transaction snapshot doc to a plain object ──
function mapTx(d) {
  const data = d.data();
  return {
    ...data,
    id: d.id,
    date: normalizeDate(data.date),
    createdAt: normalizeDate(data.createdAt),
  };
}

const dataService = {

  // ─── TRANSACTIONS ──────────────────────────────────────
  async getTransactions() {
    try {
      const snap = await getDocs(col('transactions'));
      const txs = snap.docs.map(mapTx);
      txs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return txs;
    } catch (e) { return []; }
  },

  async addTransaction(transaction) {
    try {
      const { id: _id, ...data } = transaction;
      const newData = { ...data, createdAt: new Date().toISOString() };
      const ref = await addDoc(col('transactions'), newData);
      const newTx = { ...newData, id: ref.id };
      if (newTx.account) {
        await _updateAccountBalance(newTx.account, newTx.amount, newTx.type);
      }
      return newTx;
    } catch (e) { return null; }
  },

  async deleteTransaction(id) {
    try {
      const snap = await getDoc(dref('transactions', id));
      if (!snap.exists()) return false;
      const tx = mapTx(snap);
      await deleteDoc(dref('transactions', id));
      if (tx.account) {
        const reverseType = tx.type === 'income' ? 'expense' : 'income';
        await _updateAccountBalance(tx.account, tx.amount, reverseType);
      }
      return true;
    } catch (e) { return false; }
  },

  async updateTransaction(id, changes) {
    try {
      const snap = await getDoc(dref('transactions', id));
      if (!snap.exists()) return false;
      const oldTx = mapTx(snap);
      const { id: _id, ...updateData } = changes;
      await updateDoc(dref('transactions', id), updateData);
      // Reverse old balance effect, apply new
      if (oldTx.account) {
        const reverseType = oldTx.type === 'income' ? 'expense' : 'income';
        await _updateAccountBalance(oldTx.account, oldTx.amount, reverseType);
      }
      const newTx = { ...oldTx, ...changes };
      if (newTx.account) {
        await _updateAccountBalance(newTx.account, newTx.amount, newTx.type);
      }
      return true;
    } catch (e) { return false; }
  },

  // ─── ACCOUNTS ──────────────────────────────────────────
  async getAccounts() {
    try {
      const snap = await getDocs(col('accounts'));
      if (snap.empty) return DEFAULT_ACCOUNTS;
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return DEFAULT_ACCOUNTS; }
  },

  async saveAccounts(accounts) {
    try {
      const existing = await getDocs(col('accounts'));
      const batch = writeBatch(db);
      existing.docs.forEach(d => batch.delete(d.ref));
      accounts.forEach(account => {
        const { id, ...data } = account;
        const ref = id ? dref('accounts', id) : doc(col('accounts'));
        batch.set(ref, data);
      });
      await batch.commit();
      return true;
    } catch (e) { return false; }
  },

  async addAccount(account) {
    try {
      const { id: _id, ...data } = account;
      const ref = await addDoc(col('accounts'), data);
      return { ...data, id: ref.id };
    } catch (e) { return null; }
  },

  async updateAccount(id, changes) {
    try {
      const { id: _id, ...data } = changes;
      await updateDoc(dref('accounts', id), data);
      return true;
    } catch (e) { return false; }
  },

  async deleteAccount(id) {
    try {
      await deleteDoc(dref('accounts', id));
      return true;
    } catch (e) { return false; }
  },

  // ─── INVESTMENTS ───────────────────────────────────────
  async getInvestments() {
    try {
      const snap = await getDocs(col('investments'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
  },

  async saveInvestments(investments) {
    try {
      const existing = await getDocs(col('investments'));
      const batch = writeBatch(db);
      existing.docs.forEach(d => batch.delete(d.ref));
      investments.forEach(inv => {
        const { id, ...data } = inv;
        const ref = id ? dref('investments', id) : doc(col('investments'));
        batch.set(ref, data);
      });
      await batch.commit();
      return true;
    } catch (e) { return false; }
  },

  // ─── CATEGORIES ────────────────────────────────────────
  async getCategories() {
    try {
      const snap = await getDoc(dref('categories', 'config'));
      if (!snap.exists()) return DEFAULT_CATEGORIES;
      const data = snap.data();
      if (!data.income || !data.expense) return DEFAULT_CATEGORIES;
      return data;
    } catch (e) { return DEFAULT_CATEGORIES; }
  },

  async saveCategories(categories) {
    try {
      await setDoc(dref('categories', 'config'), categories);
      return true;
    } catch (e) { return false; }
  },

  // ─── BUDGETS ───────────────────────────────────────────
  // Формат: { food: 2000, transport: 500, ... } — лимит в шекелях на месяц
  async getBudgets() {
    try {
      const snap = await getDoc(dref('budgets', 'config'));
      if (!snap.exists()) return {};
      return snap.data();
    } catch (e) { return {}; }
  },

  async saveBudgets(budgets) {
    try {
      await setDoc(dref('budgets', 'config'), budgets);
      return true;
    } catch (e) { return false; }
  },

  async setBudget(categoryId, limit) {
    try {
      const budgets = await this.getBudgets();
      if (limit > 0) {
        budgets[categoryId] = limit;
      } else {
        delete budgets[categoryId];
      }
      await this.saveBudgets(budgets);
      return true;
    } catch (e) { return false; }
  },

  async deleteBudget(categoryId) {
    return this.setBudget(categoryId, 0);
  },

  // ─── RECURRING PAYMENTS ─────────────────────────────────
  // Формат: массив объектов с intervalMonths, startDate, endType, nextDate
  async getRecurring() {
    try {
      const snap = await getDocs(col('recurring'));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { return []; }
  },

  async saveRecurring(items) {
    try {
      const existing = await getDocs(col('recurring'));
      const batch = writeBatch(db);
      existing.docs.forEach(d => batch.delete(d.ref));
      items.forEach(item => {
        const { id, ...data } = item;
        const ref = id ? dref('recurring', id) : doc(col('recurring'));
        batch.set(ref, data);
      });
      await batch.commit();
      return true;
    } catch (e) { return false; }
  },

  async addRecurring(item) {
    try {
      const { id: _id, ...data } = item;
      const newData = { ...data, completedCount: 0, isActive: true, createdAt: new Date().toISOString() };
      const ref = await addDoc(col('recurring'), newData);
      return { ...newData, id: ref.id };
    } catch (e) { return null; }
  },

  async updateRecurring(id, changes) {
    try {
      const { id: _id, ...data } = changes;
      await updateDoc(dref('recurring', id), data);
      return true;
    } catch (e) { return false; }
  },

  async deleteRecurring(id) {
    try {
      await deleteDoc(dref('recurring', id));
      return true;
    } catch (e) { return false; }
  },

  // Подтвердить платёж: создать транзакцию + сдвинуть nextDate
  async confirmRecurring(id) {
    try {
      const snap = await getDoc(dref('recurring', id));
      if (!snap.exists()) return false;
      const rec = { id: snap.id, ...snap.data() };

      // Создаём транзакцию
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

      // Считаем следующую дату
      const next = new Date(rec.nextDate);
      next.setMonth(next.getMonth() + (rec.intervalMonths || 1));
      const newCount = (rec.completedCount || 0) + 1;

      // Проверяем конец
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

  // Пропустить платёж: сдвинуть nextDate без создания транзакции
  async skipRecurring(id) {
    try {
      const snap = await getDoc(dref('recurring', id));
      if (!snap.exists()) return false;
      const rec = { id: snap.id, ...snap.data() };

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

  // ─── SETTINGS ──────────────────────────────────────────
  async getSettings() {
    try {
      const snap = await getDoc(dref('settings', 'config'));
      if (!snap.exists()) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...snap.data() };
    } catch (e) { return DEFAULT_SETTINGS; }
  },

  async saveSettings(settings) {
    try {
      await setDoc(dref('settings', 'config'), settings, { merge: true });
      return true;
    } catch (e) { return false; }
  },

  // ─── UTILITIES ─────────────────────────────────────────
  async clearAllData() {
    try {
      const batch = writeBatch(db);
      const collectionNames = ['transactions', 'accounts', 'investments', 'recurring'];
      for (const name of collectionNames) {
        const snap = await getDocs(col(name));
        snap.docs.forEach(d => batch.delete(d.ref));
      }
      batch.delete(dref('settings', 'config'));
      batch.delete(dref('categories', 'config'));
      batch.delete(dref('budgets', 'config'));
      await batch.commit();
      return true;
    } catch (e) { return false; }
  },

  async exportData() {
    try {
      const [transactions, accounts, investments, categories, settings, budgets, recurring] = await Promise.all([
        this.getTransactions(), this.getAccounts(), this.getInvestments(),
        this.getCategories(), this.getSettings(), this.getBudgets(), this.getRecurring(),
      ]);
      return { transactions, accounts, investments, categories, settings, budgets, recurring, exportedAt: new Date().toISOString() };
    } catch (e) { return null; }
  },

  async importData(data) {
    try {
      const ops = [];
      if (data.accounts)    ops.push(this.saveAccounts(data.accounts));
      if (data.investments) ops.push(this.saveInvestments(data.investments));
      if (data.categories)  ops.push(this.saveCategories(data.categories));
      if (data.settings)    ops.push(this.saveSettings(data.settings));
      if (data.budgets)     ops.push(this.saveBudgets(data.budgets));
      if (data.recurring)   ops.push(this.saveRecurring(data.recurring));
      if (data.transactions) {
        ops.push((async () => {
          const existing = await getDocs(col('transactions'));
          const batch = writeBatch(db);
          existing.docs.forEach(d => batch.delete(d.ref));
          data.transactions.forEach(tx => {
            const { id, ...txData } = tx;
            const ref = id ? dref('transactions', id) : doc(col('transactions'));
            batch.set(ref, txData);
          });
          await batch.commit();
        })());
      }
      await Promise.all(ops);
      return true;
    } catch (e) { return false; }
  },

  // Пересчитать балансы всех счетов из транзакций (для починки)
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
      const batch = writeBatch(db);
      accounts.forEach(a => {
        if (balances[a.id] !== undefined) {
          batch.update(dref('accounts', a.id), { balance: balances[a.id] });
        }
      });
      await batch.commit();
      return true;
    } catch (e) { return false; }
  },
};

export default dataService;
