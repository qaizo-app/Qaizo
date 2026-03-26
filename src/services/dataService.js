// src/services/dataService.js
// ПРОСЛОЙКА — единственная точка входа в базу данных
// ИСПРАВЛЕНО: баланс счёта обновляется автоматически при добавлении/удалении транзакций

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  TRANSACTIONS: 'qaizo_transactions',
  ACCOUNTS: 'qaizo_accounts',
  INVESTMENTS: 'qaizo_investments',
  CATEGORIES: 'qaizo_categories',
  SETTINGS: 'qaizo_settings',
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
      // Обновляем баланс счёта
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
      // Откатываем баланс счёта
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
      // Откатываем старый баланс, применяем новый
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
      const [transactions, accounts, investments, categories, settings] = await Promise.all([
        this.getTransactions(), this.getAccounts(), this.getInvestments(), this.getCategories(), this.getSettings()
      ]);
      return { transactions, accounts, investments, categories, settings, exportedAt: new Date().toISOString() };
    } catch (e) { return null; }
  },
  async importData(data) {
    try {
      if (data.transactions) await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(data.transactions));
      if (data.accounts) await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(data.accounts));
      if (data.investments) await AsyncStorage.setItem(KEYS.INVESTMENTS, JSON.stringify(data.investments));
      if (data.categories) await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(data.categories));
      if (data.settings) await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
      return true;
    } catch (e) { return false; }
  },

  // Пересчитать балансы всех счетов из транзакций (для починки)
  async recalculateBalances() {
    try {
      const transactions = await this.getTransactions();
      const accounts = await this.getAccounts();
      // Сбросить все балансы
      const balances = {};
      accounts.forEach(a => { balances[a.id] = 0; });
      // Посчитать из транзакций
      transactions.forEach(tx => {
        if (tx.account && balances[tx.account] !== undefined) {
          if (tx.type === 'income') balances[tx.account] += tx.amount;
          else if (tx.type === 'expense') balances[tx.account] -= tx.amount;
        }
      });
      // Обновить счета
      const updated = accounts.map(a => ({ ...a, balance: balances[a.id] !== undefined ? balances[a.id] : a.balance }));
      await this.saveAccounts(updated);
      return true;
    } catch (e) { return false; }
  },
};

export default dataService;