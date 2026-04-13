// src/services/notificationService.js
// Локальные уведомления (без remote push — не поддерживается в Expo Go SDK 53+)
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import i18n from '../i18n';
import { sym } from '../utils/currency';
import dataService from './dataService';

// Настройка отображения уведомлений когда приложение открыто
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
      const active = recurring.filter(r => r.isActive && r.nextDate && r.notify !== false);

      for (const rec of active) {
        const nextDate = new Date(rec.nextDate + 'T09:00:00');
        const now = new Date();

        // Уведомление в день платежа (9:00)
        if (nextDate > now) {
          const secondsUntil = Math.floor((nextDate.getTime() - now.getTime()) / 1000);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: i18n.t('recurringPayment'),
              body: `${rec.recipient || i18n.t(rec.categoryId)} — ${rec.type === 'expense' ? '-' : '+'}${sym()}${rec.amount}`,
              data: { recurringId: rec.id },
            },
            trigger: {
              type: 'timeInterval',
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
              body: `${i18n.t('tomorrow')}: ${rec.recipient || i18n.t(rec.categoryId)} — ${sym()}${rec.amount}`,
              data: { recurringId: rec.id },
            },
            trigger: {
              type: 'timeInterval',
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
                body: `${rec.recipient || i18n.t(rec.categoryId)} — ${i18n.t('contractEndsIn30')}`,
                data: { recurringId: rec.id, type: 'contract_end' },
              },
              trigger: {
                type: 'timeInterval',
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
          type: 'daily',
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

      const thisWeek = txs.filter(t => {
        const d = new Date(t.date || t.createdAt);
        return t.type === 'expense' && d >= weekAgo;
      }).reduce((s, t) => s + t.amount, 0);

      const lastWeek = txs.filter(t => {
        const d = new Date(t.date || t.createdAt);
        return t.type === 'expense' && d >= twoWeeksAgo && d < weekAgo;
      }).reduce((s, t) => s + t.amount, 0);

      const diff = lastWeek - thisWeek;
      const body = diff > 0
        ? i18n.t('weeklySummaryGood').replace('{amount}', Math.round(thisWeek)).replace('{saved}', Math.round(diff))
        : i18n.t('weeklySummaryBad').replace('{amount}', Math.round(thisWeek)).replace('{extra}', Math.round(Math.abs(diff)));

      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t('weeklySummaryTitle'),
          body,
          data: { type: 'weekly_summary' },
          categoryIdentifier: 'quick_add',
        },
        trigger: {
          type: 'weekly',
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
