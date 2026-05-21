// src/types/index.ts
// Core domain types — single source of truth for shapes that flow through
// dataService, screens and AI prompts. Keep this file dependency-free so
// utils / services can import from here without circular references.

// ─── Accounts ────────────────────────────────────────────
// `cash` / `bank` / `credit` are everyday-spending accounts the user can pay
// FROM. `investment` / `crypto` / `asset` are deposit-only on the spending
// side but can receive transfers (pension, brokerage, real estate, etc.).
// `loan` / `mortgage` / `debt` are liabilities — money leaves them only as
// the debt grows; balances are typically negative.
export type AccountType =
  | 'cash'
  | 'bank'
  | 'credit'
  | 'investment'
  | 'crypto'
  | 'asset'
  | 'loan'
  | 'mortgage'
  | 'debt';

export interface AccountHolding {
  ticker: string;     // 'BTC', 'AAPL', etc.
  shares: number;
  avgCost?: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;          // symbol — '₪', '$', '€', ...
  icon?: string;
  isActive?: boolean;
  accountNumber?: string;
  overdraft?: number | null;
  billingDay?: number | null;  // credit cards
  holdings?: AccountHolding[]; // crypto / stocks
  order?: number;
  createdAt?: string;
}

// ─── Transactions ────────────────────────────────────────
export type TransactionType = 'income' | 'expense' | 'transfer';

export interface SplitRow {
  amount: string;        // kept as string in UI, parsed on save
  categoryId: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency?: string;
  date: string;          // 'YYYY-MM-DD'
  account: string;       // account id
  categoryId: string;
  categoryName?: string;
  icon?: string;
  recipient?: string;
  note?: string;
  tags?: string[];
  projectId?: string | null;
  isTransfer?: boolean;
  transferPairId?: string;  // links the two sides of a transfer
  createdAt?: string;
}

// ─── Recurring payments ──────────────────────────────────
export type RecurringInterval = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Recurring {
  id: string;
  type: TransactionType;        // 'transfer' supported for recurring transfers
  amount: number;
  currency?: string;
  account: string;              // 'from' side for transfers
  toAccount?: string;           // transfers only
  categoryId: string;
  categoryName?: string;
  icon?: string;
  recipient?: string;
  note?: string;
  interval?: RecurringInterval;
  intervalMonths?: number;       // legacy/runtime: months between executions
  nextDate: string;              // 'YYYY-MM-DD'
  endDate?: string | null;
  endType?: 'never' | 'count' | 'date';
  totalCount?: number;           // when endType='count' — max executions
  completedCount?: number;       // how many times confirmRecurring has fired
  isActive: boolean;
  autoConfirm?: boolean;        // skip the per-execution prompt
  isTransfer?: boolean;          // set when type='transfer'
  notify?: boolean;             // schedule local reminders (default true)
  contractEndDate?: string | null;  // optional contract expiry → 30-day reminder
  projectId?: string | null;
  tags?: string[];
  createdAt?: string;
}

// ─── Categories ──────────────────────────────────────────
// Category data is mostly static (config-driven) but custom categories
// per user live in Firestore / AsyncStorage with this shape.
export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  group?: string;
  type?: 'income' | 'expense';
}

// ─── Projects ────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  budget?: number;       // optional budget cap in user's currency
  createdAt?: string;
}

// ─── Goals ───────────────────────────────────────────────
export interface GoalDeposit {
  id: string;
  amount: number;
  date: string;
  note?: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  initialAmount: number;
  targetDate?: string | null;
  icon?: string;
  color?: string;
  deposits: GoalDeposit[];
  createdAt?: string;
}

// ─── Budgets ─────────────────────────────────────────────
export interface Budget {
  categoryId: string;
  limit: number;          // monthly cap
}

// ─── Investments (separate from "investment" account holdings) ───────────
// Free-form investment tracker — manual entries the user adds to mirror
// brokerage or pension balances they don't want fully modeled as an account.
export type InvestmentType = 'pension' | 'fund' | 'stocks' | 'bonds' | 'realestate' | 'other';

export interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  balance: number;
  monthlyContribution?: number;
  holdings?: AccountHolding[];   // for stocks type
  createdAt?: string;
}

// ─── Settings ────────────────────────────────────────────
export type Language = 'ru' | 'he' | 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ar' | 'zh' | 'hi' | 'ja';
export type WeekStart = 'sunday' | 'monday';
export type ThemeMode = 'dark' | 'light' | 'amoled' | 'auto';

export interface Settings {
  currency?: string;
  language?: Language;
  weekStart?: WeekStart;
  themeMode?: ThemeMode;
  monthlyExtra?: number;       // recurring "other income" surplus
  // Layout, voice, and consent live alongside but are loaded by their own
  // services — keep them out of the canonical Settings shape for now.
}

// ─── Quick templates ─────────────────────────────────────
export interface QuickTemplate {
  id: string;
  name?: string;
  categoryId: string;
  account?: string;
  amount?: number;        // if pre-filled
  createdAt?: string;
}

// ─── Shopping list ───────────────────────────────────────
export interface ShoppingItem {
  id: string;
  name: string;
  price?: number;
  quantity?: number;
  note?: string;
  checked?: boolean;
  createdAt?: string;
}

// ─── Streaks ─────────────────────────────────────────────
// Gamification: consecutive days of logging finances + consecutive days kept
// under the daily budget. Persisted by dataService.saveStreaks / getStreaks.
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  underBudgetStreak: number;
  longestUnderBudget: number;
  milestones: number[];
}

// ─── Crypto prices ───────────────────────────────────────
export interface CryptoPrice {
  price: number;
  change24h: number;
  stale?: boolean;        // served from disk cache (offline / rate-limited)
}
