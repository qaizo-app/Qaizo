// src/services/dataService.js
// ПРОСЛОЙКА — единственная точка входа в базу данных
// Когда будем мигрировать с Firebase на PostgreSQL — меняем ТОЛЬКО этот файл
// Всё остальное приложение продолжит работать без изменений

// For now: uses local AsyncStorage (works offline!)
// Later: will connect to Firebase Firestore
// Even later: can switch to Supabase/PostgreSQL

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  TRANSACTIONS: 'qaizo_transactions',
  ACCOUNTS: 'qaizo_accounts',
  INVESTMENTS: 'qaizo_investments',
  CATEGORIES: 'qaizo_categories',
  SETTINGS: 'qaizo_settings',
};

// ─── DEFAULT DATA ──────────────────────────────────────────
const DEFAULT_ACCOUNTS = [
  { id: 'bank1', name: 'Bank 1', type: 'bank', icon: '🏦', balance: 0, currency: '₪' },
  { id: 'bank2', name: 'Bank 2', type: 'bank', icon: '🏦', balance: 0, currency: '₪' },
  { id: 'cc1', name: 'Visa', type: 'credit', icon: '💳', balance: 0, currency: '₪' },
  { id: 'cc2', name: 'Mastercard', type: 'credit', icon: '💳', balance: 0, currency: '₪' },
  { id: 'cash_ils', name: 'Cash ₪', type: 'cash', icon: '💵', balance: 0, currency: '₪' },
  { id: 'cash_usd', name: 'Cash $', type: 'cash', icon: '💵', balance: 0, currency: '$' },
  { id: 'cash_eur', name: 'Cash €', type: 'cash', icon: '💶', balance: 0, currency: '€' },
];

const DEFAULT_INVESTMENTS = [
  { id: 'pension', name: 'Pension', type: 'pension', icon: '🏛️', balance: 0, monthly: 0, currency: '₪' },
  { id: 'kupat_gemel', name: 'Kupat Gemel', type: 'gemel', icon: '📊', balance: 0, monthly: 0, currency: '₪' },
  { id: 'keren_employer', name: 'Keren Hishtalmut (employer)', type: 'hishtalmut', icon: '📈', balance: 0, monthly: 0, currency: '₪' },
  { id: 'keren_personal', name: 'Keren Hishtalmut (personal)', type: 'hishtalmut', icon: '📈', balance: 0, monthly: 0, currency: '₪' },
];

const DEFAULT_CATEGORIES = {
  income: [
    { id: 'salary_me', icon: '💼', color: '#22c55e' },
    { id: 'salary_spouse', icon: '💼', color: '#10b981' },
    { id: 'handyman', icon: '🔧', color: '#34d399' },
    { id: 'sales', icon: '📦', color: '#6ee7b7' },
    { id: 'rental_income', icon: '🏠', color: '#059669' },
    { id: 'other_income', icon: '💰', color: '#a7f3d0' },
  ],
  expense: [
    { id: 'food', icon: '🛒', color: '#ef4444' },
    { id: 'transport', icon: '🚗', color: '#f97316' },
    { id: 'fuel', icon: '⛽', color: '#fb923c' },
    { id: 'insurance', icon: '🛡️', color: '#eab308' },
    { id: 'phone', icon: '📱', color: '#8b5cf6' },
    { id: 'utilities', icon: '💡', color: '#3b82f6' },
    { id: 'health', icon: '🏥', color: '#ec4899' },
    { id: 'kids', icon: '👶', color: '#f472b6' },
    { id: 'clothing', icon: '👕', color: '#a855f7' },
    { id: 'entertainment', icon: '🎬', color: '#06b6d4' },
    { id: 'education', icon: '📚', color: '#14b8a6' },
    { id: 'rent', icon: '🏠', color: '#dc2626' },
    { id: 'arnona', icon: '🏘️', color: '#b91c1c' },
    { id: 'vaad', icon: '🏢', color: '#991b1b' },
    { id: 'restaurant', icon: '🍽️', color: '#e11d48' },
    { id: 'household', icon: '🏡', color: '#7c3aed' },
    { id: 'electronics', icon: '📱', color: '#2563eb' },
    { id: 'cosmetics', icon: '💄', color: '#db2777' },
    { id: 'other', icon: '📋', color: '#6b7280' },
  ],
};

const DEFAULT_SETTINGS = {
  language: 'ru',
  currency: '₪',
  theme: 'dark',
};

// ─── HELPER ────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── DATA SERVICE API ──────────────────────────────────────
// This is what the rest of the app uses.
// NEVER import AsyncStorage or Firebase directly in screens/components.
// ALWAYS go through dataService.

const dataService = {

  // ─── TRANSACTIONS ──────────────────────────────────────
  async getTransactions() {
    try {
      const data = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error loading transactions:', e);
      return [];
    }
  },

  async addTransaction(transaction) {
    try {
      const transactions = await this.getTransactions();
      const newTx = {
        ...transaction,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const updated = [newTx, ...transactions];
      await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(updated));
      return newTx;
    } catch (e) {
      console.error('Error adding transaction:', e);
      return null;
    }
  },

  async deleteTransaction(id) {
    try {
      const transactions = await this.getTransactions();
      const updated = transactions.filter(t => t.id !== id);
      await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(updated));
      return true;
    } catch (e) {
      console.error('Error deleting transaction:', e);
      return false;
    }
  },

  async updateTransaction(id, changes) {
    try {
      const transactions = await this.getTransactions();
      const updated = transactions.map(t => t.id === id ? { ...t, ...changes } : t);
      await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(updated));
      return true;
    } catch (e) {
      console.error('Error updating transaction:', e);
      return false;
    }
  },

  // ─── ACCOUNTS ──────────────────────────────────────────
  async getAccounts() {
    try {
      const data = await AsyncStorage.getItem(KEYS.ACCOUNTS);
      return data ? JSON.parse(data) : DEFAULT_ACCOUNTS;
    } catch (e) {
      return DEFAULT_ACCOUNTS;
    }
  },

  async saveAccounts(accounts) {
    try {
      await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts));
      return true;
    } catch (e) {
      return false;
    }
  },

  async addAccount(account) {
    try {
      const accounts = await this.getAccounts();
      const newAccount = { ...account, id: generateId() };
      accounts.push(newAccount);
      await this.saveAccounts(accounts);
      return newAccount;
    } catch (e) {
      return null;
    }
  },

  async updateAccount(id, changes) {
    try {
      const accounts = await this.getAccounts();
      const updated = accounts.map(a => a.id === id ? { ...a, ...changes } : a);
      await this.saveAccounts(updated);
      return true;
    } catch (e) {
      return false;
    }
  },

  async deleteAccount(id) {
    try {
      const accounts = await this.getAccounts();
      const updated = accounts.filter(a => a.id !== id);
      await this.saveAccounts(updated);
      return true;
    } catch (e) {
      return false;
    }
  },

  // ─── INVESTMENTS ───────────────────────────────────────
  async getInvestments() {
    try {
      const data = await AsyncStorage.getItem(KEYS.INVESTMENTS);
      return data ? JSON.parse(data) : DEFAULT_INVESTMENTS;
    } catch (e) {
      return DEFAULT_INVESTMENTS;
    }
  },

  async saveInvestments(investments) {
    try {
      await AsyncStorage.setItem(KEYS.INVESTMENTS, JSON.stringify(investments));
      return true;
    } catch (e) {
      return false;
    }
  },

  // ─── CATEGORIES ────────────────────────────────────────
  async getCategories() {
    try {
      const data = await AsyncStorage.getItem(KEYS.CATEGORIES);
      return data ? JSON.parse(data) : DEFAULT_CATEGORIES;
    } catch (e) {
      return DEFAULT_CATEGORIES;
    }
  },

  async saveCategories(categories) {
    try {
      await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
      return true;
    } catch (e) {
      return false;
    }
  },

  // ─── SETTINGS ──────────────────────────────────────────
  async getSettings() {
    try {
      const data = await AsyncStorage.getItem(KEYS.SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings) {
    try {
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (e) {
      return false;
    }
  },

  // ─── UTILITIES ─────────────────────────────────────────
  async clearAllData() {
    try {
      await AsyncStorage.multiRemove(Object.values(KEYS));
      return true;
    } catch (e) {
      return false;
    }
  },

  async exportData() {
    try {
      const transactions = await this.getTransactions();
      const accounts = await this.getAccounts();
      const investments = await this.getInvestments();
      const categories = await this.getCategories();
      const settings = await this.getSettings();
      return { transactions, accounts, investments, categories, settings, exportedAt: new Date().toISOString() };
    } catch (e) {
      return null;
    }
  },

  async importData(data) {
    try {
      if (data.transactions) await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(data.transactions));
      if (data.accounts) await AsyncStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(data.accounts));
      if (data.investments) await AsyncStorage.setItem(KEYS.INVESTMENTS, JSON.stringify(data.investments));
      if (data.categories) await AsyncStorage.setItem(KEYS.CATEGORIES, JSON.stringify(data.categories));
      if (data.settings) await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(data.settings));
      return true;
    } catch (e) {
      return false;
    }
  },
};

export default dataService;
