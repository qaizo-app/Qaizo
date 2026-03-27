// __tests__/notificationService.test.js
// Тесты уведомлений — expo-notifications замокан в jest.setup.js

jest.mock('../src/i18n', () => ({
  __esModule: true,
  default: { t: (key) => key },
}));

jest.mock('../src/utils/currency', () => ({
  __esModule: true,
  sym: () => '₪',
}));

jest.mock('../src/services/dataService', () => {
  const mock = {
    getRecurring: jest.fn(() => Promise.resolve([])),
  };
  return { __esModule: true, default: mock };
});

jest.mock('../src/config/firebase', () => ({
  db: {}, auth: { currentUser: null },
}));

jest.mock('../src/services/authService', () => ({
  default: { getUid: () => null },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

const Notifications = require('expo-notifications');
const { default: dataService } = require('../src/services/dataService');
const { default: notificationService } = require('../src/services/notificationService');

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── requestPermission ─────────────────────────
  test('requestPermission returns true when already granted', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    const result = await notificationService.requestPermission();
    expect(result).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  test('requestPermission asks when not granted', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });

    const result = await notificationService.requestPermission();
    expect(result).toBe(true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  test('requestPermission returns false when denied', async () => {
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const result = await notificationService.requestPermission();
    expect(result).toBe(false);
  });

  // ─── scheduleRecurringNotifications ────────────
  test('scheduleRecurringNotifications with no recurring = cancels old only', async () => {
    dataService.getRecurring.mockResolvedValue([]);

    const result = await notificationService.scheduleRecurringNotifications();
    expect(result).toBe(true);
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('scheduleRecurringNotifications schedules for future payment', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const futureStr = future.toISOString().split('T')[0];

    dataService.getRecurring.mockResolvedValue([{
      id: 'r1',
      isActive: true,
      nextDate: futureStr,
      recipient: 'Netflix',
      categoryId: 'entertainment',
      type: 'expense',
      amount: 50,
    }]);

    const result = await notificationService.scheduleRecurringNotifications();
    expect(result).toBe(true);
    // Day-of + day-before = 2 notifications
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  test('scheduleRecurringNotifications skips inactive', async () => {
    dataService.getRecurring.mockResolvedValue([{
      id: 'r1',
      isActive: false,
      nextDate: '2030-01-01',
      recipient: 'Test',
      categoryId: 'food',
      type: 'expense',
      amount: 100,
    }]);

    await notificationService.scheduleRecurringNotifications();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  // ─── scheduleStreakReminder ────────────────────
  test('scheduleStreakReminder creates reminder if none exists', async () => {
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);

    await notificationService.scheduleStreakReminder();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

    const call = Notifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(call.content.data.type).toBe('streak_reminder');
    expect(call.trigger.hour).toBe(20);
    expect(call.trigger.repeats).toBe(true);
  });

  test('scheduleStreakReminder skips if already scheduled', async () => {
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { content: { data: { type: 'streak_reminder' } } },
    ]);

    await notificationService.scheduleStreakReminder();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  // ─── cancelAll ─────────────────────────────────
  test('cancelAll cancels all notifications', async () => {
    await notificationService.cancelAll();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
  });

  // ─── setupAndroidChannel ───────────────────────
  test('setupAndroidChannel creates channel on Android', async () => {
    await notificationService.setupAndroidChannel();
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'payments',
      expect.objectContaining({
        name: 'Payments',
        importance: Notifications.AndroidImportance.HIGH,
      }),
    );
  });
});
