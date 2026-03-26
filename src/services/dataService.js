// src/services/dataService.js
// ПРОСЛОЙКА — единственная точка входа в базу данных

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  TRANSACTIONS: 'qaizo_transactions',
  ACCOUNTS: 'qaizo_accounts',
  INVESTMENTS: 'qaizo_investments',
  CATEGORIES: 'qaizo_categories',
  SETTINGS: 'qaizo_settings',
  BUDGETS: 'qaizo_budgets',
  RECURRING: 'qaizo_recurring',
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

const DEFAULT_SETTINGS = { language: 'ru', currency: '₪', theme: 'dark' };

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Обновить баланс счёта ──────────────────────────────
async function updateAccountBalance(accountId, amount, type) {
  try {
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
  } catch (e) {
    console.error('Error updating account balance:', e);
  }
}

const dataService = {

  // ─── TRANSACTIONS ──────────────────────────────────────
  async getTransactions() {
    try {
      const data = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  },

  async addTransaction(transaction) {
    try {
      const transactions = await this.getTransactions();
      const newTx = { ...transaction, id: generateId(), createdAt: new Date().toISOString() };
      const updated = [newTx, ...transactions];
      await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(updated));
      if (newTx.account) {
        await updateAccountBalance(newTx.account, newTx.amount, newTx.type);
      }
      return newTx;
    } catch (e) { return null; }
  },

  async deleteTransaction(id) {
    try {
      const transactions = await this.getTransactions();
      const tx = transactions.find(t => t.id === id);
      const updated = transactions.filter(t => t.id !== id);
      await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(updated));
      if (tx && tx.account) {
        const reverseType = tx.type === 'income' ? 'expense' : 'income';
        await updateAccountBalance(tx.account, tx.amount, reverseType);
      }
      return true;
    } catch (e) { return false; }
  },

  async updateTransaction(id, changes) {
    try {
      const transactions = await this.getTransactions();
      const oldTx = transactions.find(t => t.id === id);
      const updated = transactions.map(t => t.id === id ? { ...t, ...changes } : t);
      await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(updated));
      if (oldTx && oldTx.account) {
        const reverseType = oldTx.type === 'income' ? 'expense' : 'income';
        await updateAccountBalance(oldTx.account, oldTx.amount, reverseType);
      }
      const newTx = { ...oldTx, ...changes };
      if (newTx.account) {
        await updateAccountBalance(newTx.account, newTx.amount, newTx.type);
      }
      return true;
    } catch (e) { return false; }
  },

  // ─── ACCOUNTS ──────────────────────────────────────────
  async getAccounts() {
    try {
      const data = await AsyncStorage.getItem(KEYS.ACCOUNTS);
      return data ? JSON.parse(data) : DEFAULT_ACCOUNTS;
    } catch (e) { return DEFAULT_ACCOUNTS; }
  },

  async saveAccounts(accounts) {
    try { await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts)); return true; } catch (e) { return false; }
  },

  async addAccount(account) {
    try {
      const accounts = await this.getAccounts();
      const newAccount = { ...account, id: generateId() };
      accounts.push(newAccount);
      await this.saveAccounts(accounts);
      return newAccount;
    } catch (e) { return null; }
  },

  async updateAccount(id, changes) {
    try {
      const accounts = await this.getAccounts();
      const updated = accounts.map(a => a.id === id ? { ...a, ...changes } : a);
      await this.saveAccounts(updated);
      return true;
    } catch (e) { return false; }
  },

  async deleteAccount(id) {
    try {
      const accounts = await this.getAccounts();
      const updated = accounts.filter(a => a.id !== id);
      await this.saveAccounts(updated);
      return true;
    } catch (e) { return false; }
  },

  // ─── INVESTMENTS ───────────────────────────────────────
  async getInvestments() {
    try { const data = await AsyncStorage.getItem(KEYS.INVESTMENTS); return data ? JSON.parse(data) : []; } catch (e) { return []; }
  },
  async saveInvestments(investments) {
    try { await AsyncStorage.setItem(KEYS.INVESTMENTS, JSON.stringify(investments)); return true; } catch (e) { return false; }
  },

  // ─── CATEGORIES ────────────────────────────────────────
  async getCategories() {
    try { const data = await AsyncStorage.getItem(KEYS.CATEGORIES); return data ? JSON.parse(data) : DEFAULT_CATEGORIES; } catch (e) { return DEFAULT_CATEGORIES; }
  },
  async saveCategories(categories) {
    try { await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories)); return true; } catch (e) { return false; }
  },

  // ─── BUDGETS ───────────────────────────────────────────
  // Формат: { food: 2000, transport: 500, ... } — лимит в шекелях на месяц
  async getBudgets() {
    try {
      const data = await AsyncStorage.getItem(KEYS.BUDGETS);
      return data ? JSON.parse(data) : {};
    } catch (e) { return {}; }
  },

  async saveBudgets(budgets) {
    try {
      await AsyncStorage.setItem(KEYS.BUDGETS, JSON.stringify(budgets));
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
      const data = await AsyncStorage.getItem(KEYS.RECURRING);
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  },

  async saveRecurring(items) {
    try { await AsyncStorage.setItem(KEYS.RECURRING, JSON.stringify(items)); return true; } catch (e) { return false; }
  },

  async addRecurring(item) {
    try {
      const items = await this.getRecurring();
      const newItem = { ...item, id: generateId(), completedCount: 0, isActive: true, createdAt: new Date().toISOString() };
      items.push(newItem);
      await this.saveRecurring(items);
      return newItem;
    } catch (e) { return null; }
  },

  async updateRecurring(id, changes) {
    try {
      const items = await this.getRecurring();
      const updated = items.map(r => r.id === id ? { ...r, ...changes } : r);
      await this.saveRecurring(updated);
      return true;
    } catch (e) { return false; }
  },

  async deleteRecurring(id) {
    try {
      const items = await this.getRecurring();
      await this.saveRecurring(items.filter(r => r.id !== id));
      return true;
    } catch (e) { return false; }
  },

  // Подтвердить платёж: создать транзакцию + сдвинуть nextDate
  async confirmRecurring(id) {
    try {
      const items = await this.getRecurring();
      const rec = items.find(r => r.id === id);
      if (!rec) return false;

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
      const items = await this.getRecurring();
      const rec = items.find(r => r.id === id);
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

  // ─── SETTINGS ──────────────────────────────────────────
  async getSettings() {
    try { const data = await AsyncStorage.getItem(KEYS.SETTINGS); return data ? JSON.parse(data) : DEFAULT_SETTINGS; } catch (e) { return DEFAULT_SETTINGS; }
  },
  async saveSettings(settings) {
    try { await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings)); return true; } catch (e) { return false; }
  },

  // ─── UTILITIES ─────────────────────────────────────────
  async clearAllData() {
    try { await AsyncStorage.multiRemove(Object.values(KEYS)); return true; } catch (e) { return false; }
  },
  async exportData() {
    try {
      const [transactions, accounts, investments, categories, settings, budgets, recurring] = await Promise.all([
        this.getTransactions(), this.getAccounts(), this.getInvestments(), this.getCategories(), this.getSettings(), this.getBudgets(), this.getRecurring()
      ]);
      return { transactions, accounts, investments, categories, settings, budgets, recurring, exportedAt: new Date().toISOString() };
    } catch (e) { return null; }
  },
  async importData(data) {
    try {
      if (data.transactions) await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(data.transactions));
      if (data.accounts) await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(data.accounts));
      if (data.investments) await AsyncStorage.setItem(KEYS.INVESTMENTS, JSON.stringify(data.investments));
      if (data.categories) await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(data.categories));
      if (data.settings) await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
      if (data.budgets) await AsyncStorage.setItem(KEYS.BUDGETS, JSON.stringify(data.budgets));
      if (data.recurring) await AsyncStorage.setItem(KEYS.RECURRING, JSON.stringify(data.recurring));
      return true;
    } catch (e) { return false; }
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