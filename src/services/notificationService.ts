// src/services/notificationService.ts
// Локальные уведомления (без remote push — не поддерживается в Expo Go SDK 53+)
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import { sym } from '../utils/currency';
import { catName } from '../utils/categoryName';
import dataService from './dataService';
import type { Recurring, Transaction, Project } from '../types';

const PROJECT_BUDGET_NOTIFIED_KEY = 'project_budget_notified_thresholds';

// Настройка отображения уведомлений когда приложение открыто.
// shouldShowBanner / shouldShowList replace the deprecated shouldShowAlert
// in expo-notifications (SDK 53) — same visible behavior.
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const notificationService = {

  // Запросить разрешение
  async requestPermission() {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },

  // Запланировать уведомления для всех активных рекуррентных платежей
  async scheduleRecurringNotifications() {
    try {
      // Отменяем все старые
      await Notifications.cancelAllScheduledNotificationsAsync();

      const recurring = await dataService.getRecurring();
      const active = recurring.filter((r: Recurring) => r.isActive && r.nextDate && r.notify !== false);

      for (const rec of active) {
        const nextDate = new Date(rec.nextDate + 'T09:00:00');
        const now = new Date();

        // ‎ = LTR mark — locks "-50 ₪" so Hebrew/Arabic recipient names
        // don't bidi-flip the sign and currency around the number.
        const sign = rec.type === 'expense' ? '-' : '+';
        const amountStr = `‎${sign}${rec.amount} ${sym()}`;
        const name = rec.recipient || catName(rec.categoryId, rec.categoryName);

        // Уведомление в день платежа (9:00)
        if (nextDate > now) {
          const secondsUntil = Math.floor((nextDate.getTime() - now.getTime()) / 1000);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: i18n.t('recurringPayment'),
              body: `${name} — ${amountStr}`,
              data: { recurringId: rec.id },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: secondsUntil,
              channelId: 'payments',
            },
          });
        }

        // Уведомление за день до платежа (20:00)
        const dayBefore = new Date(nextDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        dayBefore.setHours(20, 0, 0, 0);

        if (dayBefore > now) {
          const secondsUntil = Math.floor((dayBefore.getTime() - now.getTime()) / 1000);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: i18n.t('upcomingPayment'),
              body: `${i18n.t('tomorrow')}: ${name} — ${amountStr}`,
              data: { recurringId: rec.id },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: secondsUntil,
              channelId: 'payments',
            },
          });
        }


        // Contract end reminder (30 days before)
        if (rec.contractEndDate) {
          const contractEnd = new Date(rec.contractEndDate + 'T10:00:00');
          const reminderDate = new Date(contractEnd);
          reminderDate.setDate(reminderDate.getDate() - 30);
          if (reminderDate > now) {
            const secondsUntil = Math.floor((reminderDate.getTime() - now.getTime()) / 1000);
            await Notifications.scheduleNotificationAsync({
              content: {
                title: i18n.t('contractEndingSoon'),
                body: `${rec.recipient || catName(rec.categoryId, rec.categoryName)} — ${i18n.t('contractEndsIn30')}`,
                data: { recurringId: rec.id, type: 'contract_end' },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: secondsUntil,
                channelId: 'payments',
              },
            });
          }
        }
      }

      return true;
    } catch (e) {
      if (__DEV__) console.error('scheduleRecurringNotifications:', e);
      return false;
    }
  },

  // Ежедневное напоминание внести транзакцию (20:00)
  async scheduleStreakReminder() {
    try {
      // Проверяем нет ли уже такого
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const hasStreak = scheduled.some(n => n.content.data?.type === 'streak_reminder');
      if (hasStreak) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Qaizo',
          body: i18n.t('streakAtRisk'),
          data: { type: 'streak_reminder' },
          categoryIdentifier: 'quick_add',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 20,
          minute: 0,
          channelId: 'payments',
        },
      });
    } catch (e) {
      if (__DEV__) console.error('scheduleStreakReminder:', e);
    }
  },

  // סיכום שבועי — כל ראשון ב-10:00
  async scheduleWeeklySummary() {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const hasWeekly = scheduled.some(n => n.content.data?.type === 'weekly_summary');
      if (hasWeekly) return;

      // Calculate this week's expenses
      const txs = await dataService.getTransactions();
      const now = new Date();
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const thisWeek = txs.filter((t: Transaction) => {
        const d = new Date(t.date || t.createdAt || '');
        return t.type === 'expense' && d >= weekAgo;
      }).reduce((s: number, t: Transaction) => s + t.amount, 0);

      const lastWeek = txs.filter((t: Transaction) => {
        const d = new Date(t.date || t.createdAt || '');
        return t.type === 'expense' && d >= twoWeeksAgo && d < weekAgo;
      }).reduce((s: number, t: Transaction) => s + t.amount, 0);

      const diff = lastWeek - thisWeek;
      const cur = sym();
      const body = diff > 0
        ? i18n.t('weeklySummaryGood').replace('{amount}', String(Math.round(thisWeek))).replace('{saved}', String(Math.round(diff))).replace(/\{currency\}/g, cur)
        : i18n.t('weeklySummaryBad').replace('{amount}', String(Math.round(thisWeek))).replace('{extra}', String(Math.round(Math.abs(diff)))).replace(/\{currency\}/g, cur);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t('weeklySummaryTitle'),
          body,
          data: { type: 'weekly_summary' },
          categoryIdentifier: 'quick_add',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: 1, // Sunday
          hour: 10,
          minute: 0,
          channelId: 'payments',
        },
      });
    } catch (e) {
      if (__DEV__) console.error('scheduleWeeklySummary:', e);
    }
  },

  // Project budget threshold — fire immediate notification when total crosses 80% or 100%
  // for the first time. Uses AsyncStorage to remember last notified threshold per project
  // so we don't spam the user on every transaction once over budget.
  async notifyProjectBudgetThreshold(projectId: string) {
    try {
      if (!projectId) return;
      const projects = await dataService.getProjects();
      const project = projects.find((p: Project) => p.id === projectId);
      if (!project || !project.budget || project.budget <= 0) return;

      const txs = await dataService.getTransactions();
      const projectTxs = txs.filter((t: Transaction) => t.projectId === projectId);
      const total = projectTxs.reduce((sum: number, t: Transaction) => sum + (t.type === 'expense' ? t.amount : -t.amount), 0);
      const pct = (total / project.budget) * 100;

      const stateRaw = await AsyncStorage.getItem(PROJECT_BUDGET_NOTIFIED_KEY);
      const state = stateRaw ? JSON.parse(stateRaw) : {};
      const lastNotified = state[projectId] || 0;

      let crossedThreshold: number | null = null;
      if (pct >= 100 && lastNotified < 100) crossedThreshold = 100;
      else if (pct >= 80 && lastNotified < 80) crossedThreshold = 80;

      // Reset notified state if user dropped back below 80% (e.g. deleted transactions)
      if (pct < 80 && lastNotified > 0) {
        delete state[projectId];
        await AsyncStorage.setItem(PROJECT_BUDGET_NOTIFIED_KEY, JSON.stringify(state));
        return;
      }

      if (!crossedThreshold) return;

      const cur = sym();
      const body = crossedThreshold === 100
        ? `${i18n.t('budgetExceeded')} (${Math.round(total)}/${Math.round(project.budget)} ${cur})`
        : `${i18n.t('budget80')} (${Math.round(total)}/${Math.round(project.budget)} ${cur})`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: project.name,
          body,
          data: { type: 'project_budget', projectId },
          categoryIdentifier: 'quick_add',
        },
        trigger: null, // immediate
      });

      state[projectId] = crossedThreshold;
      await AsyncStorage.setItem(PROJECT_BUDGET_NOTIFIED_KEY, JSON.stringify(state));
    } catch (e) {
      if (__DEV__) console.error('notifyProjectBudgetThreshold:', e);
    }
  },

  // Отменить все уведомления
  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  },

  // Настроить канал для Android
  async setupAndroidChannel() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('payments', {
        name: 'Payments',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  },

  // Настроить категории с кнопками действий (+ Доходы / + Расходы)
  async setupNotificationCategories() {
    try {
      await Notifications.setNotificationCategoryAsync('quick_add', [
        {
          identifier: 'add_income',
          buttonTitle: '+ ' + i18n.t('income'),
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'add_expense',
          buttonTitle: '+ ' + i18n.t('expenseType'),
          options: { opensAppToForeground: true },
        },
      ]);
    } catch (e) {
      if (__DEV__) console.error('setupNotificationCategories:', e);
    }
  },
};

export default notificationService;
