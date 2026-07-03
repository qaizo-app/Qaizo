// Tests for computeReminderHours — the pure helper that turns an interval +
// daytime window into the list of hours to fire "log your expenses" reminders.
const { computeReminderHours } = require('../src/utils/reminderSchedule');

describe('computeReminderHours', () => {
  test('3-hour interval within 9–22 window', () => {
    expect(computeReminderHours(3, 9, 22)).toEqual([9, 12, 15, 18, 21]);
  });

  test('6-hour interval within 9–22 window', () => {
    expect(computeReminderHours(6, 9, 22)).toEqual([9, 15, 21]);
  });

  test('2-hour interval within 9–22 window', () => {
    expect(computeReminderHours(2, 9, 22)).toEqual([9, 11, 13, 15, 17, 19, 21]);
  });

  test('includes the end hour when it lands exactly on a step', () => {
    expect(computeReminderHours(3, 9, 21)).toEqual([9, 12, 15, 18, 21]);
  });

  test('start equals end → single reminder', () => {
    expect(computeReminderHours(3, 10, 10)).toEqual([10]);
  });

  test('invalid interval → empty', () => {
    expect(computeReminderHours(0, 9, 22)).toEqual([]);
    expect(computeReminderHours(-2, 9, 22)).toEqual([]);
  });

  test('start after end → empty', () => {
    expect(computeReminderHours(3, 22, 9)).toEqual([]);
  });

  test('clamps out-of-range hours', () => {
    // start below 0 / end above 23 are clamped to valid clock hours
    expect(computeReminderHours(6, -5, 30)).toEqual([0, 6, 12, 18]);
  });
});
