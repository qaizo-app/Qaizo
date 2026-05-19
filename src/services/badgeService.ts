// src/services/badgeService.ts
// Badges / תגמולים — gamification system.

import type { Transaction, Budget, Goal } from '../types';

export interface BadgeDef {
  id: string;
  icon: string;
  color: string;
  titleKey: string;
  // Activation rule — exactly one of these is present per badge definition.
  days?: number;            // streak badges
  type?: 'budget' | 'budget_month' | 'savings' | 'goal_created' | 'goal_reached' | 'tx_count';
  pct?: number;             // savings %
  count?: number;           // tx count
}

interface StreakData {
  currentStreak?: number;
}

// Budgets travel through the rest of the app as Budget[] or as a record
// keyed by categoryId — accept either shape.
type BudgetsInput = Budget[] | Record<string, number> | undefined | null;

function budgetEntries(budgets: BudgetsInput): [string, number][] {
  if (!budgets) return [];
  if (Array.isArray(budgets)) return budgets.map(b => [b.categoryId, b.limit] as [string, number]);
  return Object.entries(budgets);
}

const BADGE_DEFS: BadgeDef[] = [
  // Streak badges
  { id: 'streak_3', icon: 'ion:flame-outline', color: '#fb923c', days: 3, titleKey: 'badge3Days' },
  { id: 'streak_7', icon: 'ion:flame-outline', color: '#f59e0b', days: 7, titleKey: 'badge7Days' },
  { id: 'streak_14', icon: 'ion:flame-outline', color: '#34d399', days: 14, titleKey: 'badge14Days' },
  { id: 'streak_30', icon: 'ion:flame-outline', color: '#60a5fa', days: 30, titleKey: 'badge30Days' },
  { id: 'streak_100', icon: 'ion:flame-outline', color: '#a78bfa', days: 100, titleKey: 'badge100Days' },

  // Budget badges
  { id: 'budget_week', icon: 'shield', color: '#2dd4bf', type: 'budget', titleKey: 'badgeBudgetWeek' },
  { id: 'budget_month', icon: 'shield', color: '#34d399', type: 'budget_month', titleKey: 'badgeBudgetMonth' },

  // Savings badges
  { id: 'saver_10', icon: 'ion:trending-up-outline', color: '#60a5fa', type: 'savings', pct: 10, titleKey: 'badgeSaver10' },
  { id: 'saver_20', icon: 'ion:trending-up-outline', color: '#34d399', type: 'savings', pct: 20, titleKey: 'badgeSaver20' },
  { id: 'saver_30', icon: 'ion:trending-up-outline', color: '#a78bfa', type: 'savings', pct: 30, titleKey: 'badgeSaver30' },

  // Goal badges
  { id: 'goal_first', icon: 'ion:flag-outline', color: '#f472b6', type: 'goal_created', titleKey: 'badgeFirstGoal' },
  { id: 'goal_reached', icon: 'ion:trophy-outline', color: '#fbbf24', type: 'goal_reached', titleKey: 'badgeGoalReached' },

  // Activity badges
  { id: 'tx_50', icon: 'ion:receipt-outline', color: '#fb923c', type: 'tx_count', count: 50, titleKey: 'badge50Tx' },
  { id: 'tx_200', icon: 'ion:receipt-outline', color: '#34d399', type: 'tx_count', count: 200, titleKey: 'badge200Tx' },
  { id: 'tx_500', icon: 'ion:receipt-outline', color: '#a78bfa', type: 'tx_count', count: 500, titleKey: 'badge500Tx' },
];

const badgeService = {

  getAllBadges(): BadgeDef[] {
    return BADGE_DEFS;
  },

  // Calculate earned badges from data
  getEarnedBadges(
    streakData: StreakData | null | undefined,
    transactions: Transaction[],
    budgets: BudgetsInput,
    goals: Goal[] | null | undefined,
  ): string[] {
    const earned: string[] = [];
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Streak badges
    const streak = streakData?.currentStreak || 0;
    BADGE_DEFS.filter(b => b.days).forEach(b => {
      if (streak >= (b.days || 0)) earned.push(b.id);
    });

    // Transaction count
    const txCount = transactions.length;
    BADGE_DEFS.filter(b => b.type === 'tx_count').forEach(b => {
      if (txCount >= (b.count || 0)) earned.push(b.id);
    });

    // Savings rate this month
    const curMonth = transactions.filter(t => {
      const d = new Date(t.date || t.createdAt || 0);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const income = curMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = curMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    if (income > 0) {
      const savingsRate = Math.round(((income - expense) / income) * 100);
      BADGE_DEFS.filter(b => b.type === 'savings').forEach(b => {
        if (savingsRate >= (b.pct || 0)) earned.push(b.id);
      });
    }

    // Budget adherence
    const budgetList = budgetEntries(budgets);
    if (budgetList.length > 0 && now.getDate() >= 7) {
      const catTotals: Record<string, number> = {};
      curMonth.filter(t => t.type === 'expense').forEach(t => {
        catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
      });
      const allUnder = budgetList.every(([cat, limit]) => (catTotals[cat] || 0) <= limit);
      if (allUnder) {
        earned.push('budget_week');
        if (now.getDate() >= 25) earned.push('budget_month');
      }
    }

    // Goal badges
    if (goals && goals.length > 0) {
      earned.push('goal_first');
      const reached = goals.some(g => {
        const saved = (g.initialAmount || 0) + (g.deposits || []).reduce((s, d) => s + d.amount, 0);
        return saved >= g.targetAmount && g.targetAmount > 0;
      });
      if (reached) earned.push('goal_reached');
    }

    return earned;
  },

  getBadgeInfo(id: string): BadgeDef | null {
    return BADGE_DEFS.find(b => b.id === id) || null;
  },
};

export default badgeService;
