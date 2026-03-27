// src/services/notificationService.js
// Локальные push-уведомления для рекуррентных платежей
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
      const active = recurring.filter(r => r.isActive && r.nextDate);

      for (const rec of active) {
        const nextDate = new Date(rec.nextDate + 'T09:00:00');
        const now = new Date();

        // Уведомление в день платежа (9:00)
        if (nextDate > now) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: i18n.t('recurringPayment'),
              body: `${rec.recipient || i18n.t(rec.categoryId)} — ${rec.type === 'expense' ? '-' : '+'}${sym()}${rec.amount}`,
              data: { recurringId: rec.id },
            },
            trigger: { date: nextDate },
          });
        }

        // Уведомление за день до платежа (20:00)
        const dayBefore = new Date(nextDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        dayBefore.setHours(20, 0, 0, 0);

        if (dayBefore > now) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: i18n.t('upcomingPayment'),
              body: `${i18n.t('tomorrow')}: ${rec.recipient || i18n.t(rec.categoryId)} — ${sym()}${rec.amount}`,
              data: { recurringId: rec.id },
            },
            trigger: { date: dayBefore },
          });
        }
      }

      return true;
    } catch (e) {
      console.error('scheduleRecurringNotifications:', e);
      return false;
    }
  },

  // Уведомление для стрика (ежедневное в 20:00)
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
        },
        trigger: {
          hour: 20,
          minute: 0,
          repeats: true,
        },
      });
    } catch (e) {
      console.error('scheduleStreakReminder:', e);
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
};

export default notificationService;
