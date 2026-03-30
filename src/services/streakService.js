// src/services/streakService.js
// Расчёт стриков — последовательных дней ведения финансов
import dataService from './dataService';

const MILESTONES = [3, 7, 14, 30, 60, 100, 365];

function getLocalDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Считаем стрик из набора дат
function calcStreak(activeDays) {
  const today = todayStr();
  let day = today;
  let streak = 0;

  // Если сегодня есть транзакция — считаем от сегодня
  // Если нет — считаем от вчера (стрик ещё не сломан)
  if (activeDays.has(day)) {
    streak = 1;
    day = prevDay(day);
  } else {
    day = prevDay(today);
    if (!activeDays.has(day)) return 0;
    streak = 1;
    day = prevDay(day);
  }

  while (activeDays.has(day)) {
    streak++;
    day = prevDay(day);
  }

  return streak;
}

// Расчёт under-budget стрика
function calcUnderBudgetStreak(transactions) {
  const now = new Date();
  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date || t.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const totalIncome = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpense;
  if (balance <= 0) return 0;

  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(lastDay - now.getDate(), 1);
  const dailyBudget = Math.floor(balance / daysLeft);
  if (dailyBudget <= 0) return 0;

  // Группируем расходы по дням
  const dayExpenses = {};
  thisMonth.filter(t => t.type === 'expense').forEach(t => {
    const day = getLocalDate(t.date || t.createdAt);
    dayExpenses[day] = (dayExpenses[day] || 0) + t.amount;
  });

  let streak = 0;
  let day = todayStr();

  // Идём назад от сегодня
  for (let i = 0; i < 60; i++) {
    const spent = dayExpenses[day] || 0;
    if (spent > dailyBudget) break;
    // Считаем только дни в текущем месяце
    const d = new Date(day + 'T12:00:00');
    if (d.getMonth() !== now.getMonth()) break;
    streak++;
    day = prevDay(day);
  }

  return streak;
}

// Главная функция — обновить стрики
async function updateStreaks(transactions) {
  try {
    const old = await dataService.getStreaks();

    // Собираем уникальные дни с транзакциями
    const activeDays = new Set();
    transactions.forEach(tx => {
      const day = getLocalDate(tx.date || tx.createdAt);
      activeDays.add(day);
    });

    const currentStreak = calcStreak(activeDays);
    const longestStreak = Math.max(currentStreak, old.longestStreak || 0);
    const lastActiveDate = activeDays.has(todayStr()) ? todayStr() : old.lastActiveDate;

    const underBudgetStreak = calcUnderBudgetStreak(transactions);
    const longestUnderBudget = Math.max(underBudgetStreak, old.longestUnderBudget || 0);

    // Проверяем новые милестоуны
    const oldMilestones = old.milestones || [];
    let newMilestone = null;
    const milestones = [...oldMilestones];

    for (const m of MILESTONES) {
      if (currentStreak >= m && !oldMilestones.includes(m)) {
        milestones.push(m);
        newMilestone = m; // Последний достигнутый
      }
    }

    const streakData = {
      currentStreak,
      longestStreak,
      lastActiveDate,
      underBudgetStreak,
      longestUnderBudget,
      milestones,
    };

    // Сохраняем только если что-то изменилось
    if (
      currentStreak !== old.currentStreak ||
      longestStreak !== old.longestStreak ||
      lastActiveDate !== old.lastActiveDate ||
      underBudgetStreak !== old.underBudgetStreak ||
      newMilestone
    ) {
      await dataService.saveStreaks(streakData);
    }

    return { streakData, newMilestone };
  } catch (e) {
    if (__DEV__) console.error('streakService.updateStreaks:', e);
    return { streakData: { currentStreak: 0, longestStreak: 0, lastActiveDate: null, underBudgetStreak: 0, longestUnderBudget: 0, milestones: [] }, newMilestone: null };
  }
}

// Проверка: стрик в опасности? (после 20:00, сегодня нет транзакций)
function isStreakAtRisk(streakData) {
  if (!streakData || streakData.currentStreak === 0) return false;
  const hour = new Date().getHours();
  return hour >= 20 && streakData.lastActiveDate !== todayStr();
}

export default { updateStreaks, isStreakAtRisk, todayStr, getLocalDate };
