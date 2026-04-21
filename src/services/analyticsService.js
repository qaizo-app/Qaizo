// src/services/analyticsService.js
// אנליטיקה — התראות חכמות, מגמות, ציון פיננסי
import i18n from '../i18n';
import { sym } from '../utils/currency';

const analyticsService = {

  // === התראות חכמות ===

  generateInsights(transactions, recurring, budgets, goals) {
    const insights = [];
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Current month transactions
    const curMonthTxs = transactions.filter(t => {
      const d = new Date(t.date || t.createdAt);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    // Previous months for comparison
    const getMonthTxs = (monthsAgo) => {
      const m = new Date(thisYear, thisMonth - monthsAgo, 1);
      return transactions.filter(t => {
        const d = new Date(t.date || t.createdAt);
        return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
      });
    };

    const prev1 = getMonthTxs(1);
    const prev2 = getMonthTxs(2);
    const prev3 = getMonthTxs(3);

    // --- 1. חריגה בקטגוריה ---
    const curCatTotals = {};
    curMonthTxs.filter(t => t.type === 'expense').forEach(t => {
      curCatTotals[t.categoryId] = (curCatTotals[t.categoryId] || 0) + t.amount;
    });

    const avg3mCat = {};
    [prev1, prev2, prev3].forEach(monthTxs => {
      monthTxs.filter(t => t.type === 'expense').forEach(t => {
        avg3mCat[t.categoryId] = (avg3mCat[t.categoryId] || 0) + t.amount / 3;
      });
    });

    for (const [cat, amount] of Object.entries(curCatTotals)) {
      const avg = avg3mCat[cat];
      if (avg && avg > 100 && amount > avg * 1.4) {
        const pct = Math.round(((amount - avg) / avg) * 100);
        insights.push({
          type: 'category_spike',
          severity: pct > 80 ? 'high' : 'medium',
          icon: 'trending-up',
          color: '#fb7185',
          titleKey: 'insightCategorySpike',
          params: { category: t(cat), pct },
          amount: amount,
          avgAmount: avg,
        });
      }
    }

    // --- 2. קצב הוצאות ---
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
    const pctMonth = dayOfMonth / daysInMonth;
    const curExpense = curMonthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const curIncome = curMonthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);

    if (curIncome > 0 && curExpense / curIncome > pctMonth * 1.3 && pctMonth < 0.8) {
      const pctSpent = Math.round((curExpense / curIncome) * 100);
      insights.push({
        type: 'spending_pace',
        severity: pctSpent > 90 ? 'high' : 'medium',
        icon: 'alert-triangle',
        color: '#f59e0b',
        titleKey: 'insightSpendingPace',
        params: { pctSpent, pctMonth: Math.round(pctMonth * 100) },
      });
    }

    // --- 3. עסקה חריגה ---
    const avgTxAmount = curMonthTxs.filter(t => t.type === 'expense').length > 0
      ? curMonthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) / curMonthTxs.filter(t => t.type === 'expense').length
      : 0;

    curMonthTxs.filter(t => t.type === 'expense' && t.amount > avgTxAmount * 5 && t.amount > 500)
      .slice(0, 2)
      .forEach(tx => {
        insights.push({
          type: 'unusual_transaction',
          severity: 'low',
          icon: 'alert-circle',
          color: '#60a5fa',
          titleKey: 'insightUnusualTx',
          params: { amount: tx.amount, category: t(tx.categoryId) },
        });
      });

    // --- 4. מטרת חיסכון בסיכון ---
    (goals || []).forEach(goal => {
      if (!goal.targetDate || !goal.targetAmount) return;
      const saved = (goal.initialAmount || 0) + (goal.deposits || []).reduce((s, d) => s + d.amount, 0);
      const remaining = goal.targetAmount - saved;
      if (remaining <= 0) return;

      const target = new Date(goal.targetDate);
      const monthsLeft = Math.max((target.getFullYear() - thisYear) * 12 + target.getMonth() - thisMonth, 1);
      const needed = remaining / monthsLeft;

      // Check last month deposit
      const lastMonthDeposits = (goal.deposits || [])
        .filter(d => {
          const dd = new Date(d.date);
          return dd.getMonth() === (thisMonth === 0 ? 11 : thisMonth - 1);
        })
        .reduce((s, d) => s + d.amount, 0);

      if (lastMonthDeposits < needed * 0.5 && monthsLeft < 12) {
        insights.push({
          type: 'goal_at_risk',
          severity: 'medium',
          icon: 'target',
          color: '#a78bfa',
          titleKey: 'insightGoalAtRisk',
          params: { name: goal.name, needed: Math.round(needed) },
        });
      }
    });

    // --- 5. חיסכון חיובי ---
    if (curIncome > 0 && curExpense < curIncome * 0.7 && dayOfMonth > 20) {
      const saved = Math.round(((curIncome - curExpense) / curIncome) * 100);
      insights.push({
        type: 'good_saving',
        severity: 'positive',
        icon: 'award',
        color: '#34d399',
        titleKey: 'insightGoodSaving',
        params: { pct: saved },
      });
    }

    return insights.slice(0, 5); // Max 5 insights
  },

  // === Top 5 מוטבים ===
  getTopPayees(transactions, months = 1) {
    const now = new Date();
    const txs = transactions.filter(t => {
      const d = new Date(t.date || t.createdAt);
      const monthDiff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
      return t.type === 'expense' && monthDiff < months && t.recipient;
    });

    const totals = {};
    txs.forEach(t => { totals[t.recipient] = (totals[t.recipient] || 0) + t.amount; });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));
  },

  // === מגמת הוצאות לפי קטגוריה (6 חודשים) ===
  getCategoryTrend(transactions, categoryId) {
    const now = new Date();
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const total = transactions
        .filter(t => {
          const d = new Date(t.date || t.createdAt);
          return t.type === 'expense' && t.categoryId === categoryId &&
            d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
        })
        .reduce((s, t) => s + t.amount, 0);
      data.push({ month: m.getMonth(), year: m.getFullYear(), total });
    }
    return data;
  },

  // === השוואת חודשים ===
  getMonthComparison(transactions) {
    const now = new Date();
    const curMonth = transactions.filter(t => {
      const d = new Date(t.date || t.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const prevMonth = transactions.filter(t => {
      const d = new Date(t.date || t.createdAt);
      const pm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const py = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return d.getMonth() === pm && d.getFullYear() === py;
    });

    const catCompare = {};
    [...curMonth, ...prevMonth].filter(t => t.type === 'expense').forEach(t => {
      if (!catCompare[t.categoryId]) catCompare[t.categoryId] = { cur: 0, prev: 0 };
      const d = new Date(t.date || t.createdAt);
      if (d.getMonth() === now.getMonth()) catCompare[t.categoryId].cur += t.amount;
      else catCompare[t.categoryId].prev += t.amount;
    });

    return Object.entries(catCompare)
      .map(([cat, { cur, prev }]) => ({
        categoryId: cat,
        current: cur,
        previous: prev,
        change: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : 0),
      }))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  },

  // === יום הכי יקר בשבוע ===
  getExpenseByDayOfWeek(transactions, months = 3) {
    const now = new Date();
    const days = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    const counts = [0, 0, 0, 0, 0, 0, 0];
    transactions.filter(t => {
      const d = new Date(t.date || t.createdAt);
      const monthDiff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
      return t.type === 'expense' && monthDiff < months;
    }).forEach(t => {
      const dow = new Date(t.date || t.createdAt).getDay();
      days[dow] += t.amount;
      counts[dow]++;
    });
    return days.map((total, idx) => ({ day: idx, total, avg: counts[idx] > 0 ? Math.round(total / counts[idx]) : 0 }));
  },

  // === Balance history (line chart data) ===
  getBalanceHistory(transactions, periodDays = 30) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - periodDays);

    // Sort all txs by date
    const sorted = [...transactions]
      .filter(t => new Date(t.date || t.createdAt) <= now)
      .sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));

    // Calculate running balance from beginning
    let runningBalance = 0;
    const balanceByDate = {};

    sorted.forEach(tx => {
      const d = new Date(tx.date || tx.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (tx.type === 'income') runningBalance += tx.amount;
      else if (tx.type === 'expense') runningBalance -= tx.amount;
      else if (tx.type === 'transfer') {} // skip transfers
      balanceByDate[key] = runningBalance;
    });

    // Fill in the period days
    const points = [];
    let lastBalance = 0;

    // Find balance at start of period
    const allDates = Object.keys(balanceByDate).sort();
    for (const d of allDates) {
      if (d <= `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`) {
        lastBalance = balanceByDate[d];
      }
    }

    for (let i = 0; i <= periodDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (balanceByDate[key] !== undefined) lastBalance = balanceByDate[key];
      points.push({ date: key, day: d.getDate(), balance: lastBalance });
    }

    return points;
  },

  // === Per-account balance history ===
  // Returns daily balance points for a specific account, anchored to the
  // account's current balance. The running balance is computed backwards from
  // the present so the last point equals currentBalance even when we do not
  // have the full transaction history.
  getAccountBalanceHistory(transactions, accountId, currentBalance = 0, periodDays = 30) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - periodDays);
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Transactions for this account up to today
    const accountTxs = transactions
      .filter(t => t.account === accountId && new Date(t.date || t.createdAt) <= now)
      .sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));

    // Accumulate deltas per day, only signed amounts affecting balance.
    const deltaByDate = {};
    accountTxs.forEach(tx => {
      const d = new Date(tx.date || tx.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      let delta = 0;
      if (tx.type === 'income') delta = tx.amount;
      else if (tx.type === 'expense') delta = -tx.amount;
      // transfers handled as standalone in/out transactions, no special case
      deltaByDate[key] = (deltaByDate[key] || 0) + delta;
    });

    // Walk day-by-day from today backwards, maintaining running balance.
    // Today closes at currentBalance. Previous day balance = today - delta applied today.
    const keysDesc = [];
    const cursor = new Date(now);
    for (let i = 0; i <= periodDays; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      keysDesc.push({ key, day: cursor.getDate() });
      cursor.setDate(cursor.getDate() - 1);
    }

    let bal = currentBalance;
    const pointsDesc = [];
    for (let i = 0; i < keysDesc.length; i++) {
      const { key, day } = keysDesc[i];
      pointsDesc.push({ date: key, day, balance: bal });
      // Step back: subtract today's delta (txs that happened today were already in bal)
      bal -= deltaByDate[key] || 0;
    }
    return pointsDesc.reverse();
  },

  // === Cash Flow (daily income vs expense) ===
  getCashFlow(transactions, periodDays = 30) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - periodDays);

    const data = [];
    for (let i = 0; i <= periodDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const dayTxs = transactions.filter(tx => {
        const td = new Date(tx.date || tx.createdAt);
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === d.getDate();
      });

      const income = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      data.push({ date: key, day: d.getDate(), income, expense, net: income - expense });
    }
    return data;
  },

  // === Quick Stats ===
  getQuickStats(transactions, periodDays = 30) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - periodDays);

    const periodTxs = transactions.filter(t => {
      const d = new Date(t.date || t.createdAt);
      return d >= start && d <= now;
    });

    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - periodDays);
    const prevTxs = transactions.filter(t => {
      const d = new Date(t.date || t.createdAt);
      return d >= prevStart && d < start;
    });

    const incomeCount = periodTxs.filter(t => t.type === 'income').length;
    const expenseCount = periodTxs.filter(t => t.type === 'expense').length;
    const totalIncome = periodTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = periodTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const prevIncome = prevTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const prevExpense = prevTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const activeDays = new Set(periodTxs.map(t => {
      const d = new Date(t.date || t.createdAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })).size;

    return {
      totalTx: periodTxs.length,
      incomeCount,
      expenseCount,
      totalIncome,
      totalExpense,
      netFlow: totalIncome - totalExpense,
      avgPerDay: activeDays > 0 ? Math.round(totalExpense / Math.max(periodDays, 1)) : 0,
      avgPerTx: expenseCount > 0 ? Math.round(totalExpense / expenseCount) : 0,
      incomeChange: prevIncome > 0 ? Math.round(((totalIncome - prevIncome) / prevIncome) * 100) : 0,
      expenseChange: prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100) : 0,
    };
  },

  // === Filter transactions by period ===
  filterByPeriod(transactions, periodDays) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - periodDays);
    return transactions.filter(t => {
      const d = new Date(t.date || t.createdAt);
      return d >= start && d <= now;
    });
  },

  // === ציון פיננסי (0-100) ===
  getFinancialScore(transactions, budgets, goals) {
    const now = new Date();
    let score = 50; // Start at 50

    const curMonth = transactions.filter(t => {
      const d = new Date(t.date || t.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const income = curMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = curMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    // Savings rate (+/- 20 points)
    if (income > 0) {
      const savingsRate = (income - expense) / income;
      if (savingsRate > 0.3) score += 20;
      else if (savingsRate > 0.1) score += 10;
      else if (savingsRate < 0) score -= 15;
      else score -= 5;
    }

    // Budget adherence (+/- 15 points)
    if (Object.keys(budgets).length > 0) {
      const catTotals = {};
      curMonth.filter(t => t.type === 'expense').forEach(t => {
        catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
      });
      let overBudget = 0;
      let underBudget = 0;
      for (const [cat, limit] of Object.entries(budgets)) {
        const spent = catTotals[cat] || 0;
        if (spent > limit) overBudget++;
        else underBudget++;
      }
      if (overBudget === 0 && underBudget > 0) score += 15;
      else if (overBudget > underBudget) score -= 15;
      else score += 5;
    }

    // Goals progress (+/- 10 points)
    if (goals && goals.length > 0) {
      const activeGoals = goals.filter(g => g.targetAmount > 0);
      const progressing = activeGoals.filter(g => {
        const saved = (g.initialAmount || 0) + (g.deposits || []).reduce((s, d) => s + d.amount, 0);
        return saved > 0;
      });
      if (progressing.length === activeGoals.length && activeGoals.length > 0) score += 10;
      else if (progressing.length > 0) score += 5;
    }

    // Transaction consistency (+5)
    if (curMonth.length > 10) score += 5;

    return Math.max(0, Math.min(100, score));
  },
};

// Helper
function t(key) {
  const translated = i18n.t(key);
  return translated !== key ? translated : key;
}

export default analyticsService;
