// src/services/badgeService.js
// Badges / תגמולים — gamification system
import i18n from '../i18n';

const BADGE_DEFS = [
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

  getAllBadges() {
    return BADGE_DEFS;
  },

  // Calculate earned badges from data
  getEarnedBadges(streakData, transactions, budgets, goals) {
    const earned = [];
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Streak badges
    const streak = streakData?.currentStreak || 0;
    BADGE_DEFS.filter(b => b.days).forEach(b => {
      if (streak >= b.days) earned.push(b.id);
    });

    // Transaction count
    const txCount = transactions.length;
    BADGE_DEFS.filter(b => b.type === 'tx_count').forEach(b => {
      if (txCount >= b.count) earned.push(b.id);
    });

    // Savings rate this month
    const curMonth = transactions.filter(t => {
      const d = new Date(t.date || t.createdAt);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const income = curMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = curMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    if (income > 0) {
      const savingsRate = Math.round(((income - expense) / income) * 100);
      BADGE_DEFS.filter(b => b.type === 'savings').forEach(b => {
        if (savingsRate >= b.pct) earned.push(b.id);
      });
    }

    // Budget adherence
    if (Object.keys(budgets).length > 0 && now.getDate() >= 7) {
      const catTotals = {};
      curMonth.filter(t => t.type === 'expense').forEach(t => {
        catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
      });
      const allUnder = Object.entries(budgets).every(([cat, limit]) => (catTotals[cat] || 0) <= limit);
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

  getBadgeInfo(id) {
    return BADGE_DEFS.find(b => b.id === id) || null;
  },
};

export default badgeService;
