// Tests for computeReminderHours — the pure helper that turns an interval +
// daytime window into the list of hours to fire "log your expenses" reminders.
const { computeReminderHours, nextReminderDates } = require('../src/utils/reminderSchedule');

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

describe('nextReminderDates', () => {
  // Fixed "now": 2026-07-08 14:25 local time
  const now = new Date(2026, 6, 8, 14, 25);

  test('skips hours already passed today, keeps future ones', () => {
    const dates = nextReminderDates([9, 12, 15, 18, 21], now, 1);
    expect(dates.map(d => [d.getDate(), d.getHours()])).toEqual([
      [8, 15], [8, 18], [8, 21],
    ]);
  });

  test('with 2 days also schedules the full set for tomorrow', () => {
    const dates = nextReminderDates([9, 15, 21], now, 2);
    expect(dates.map(d => [d.getDate(), d.getHours()])).toEqual([
      [8, 15], [8, 21],
      [9, 9], [9, 15], [9, 21],
    ]);
  });

  test('an occurrence at the current exact hour:00 is not scheduled (already past)', () => {
    const atNoon = new Date(2026, 6, 8, 12, 0);
    const dates = nextReminderDates([12, 18], atNoon, 1);
    expect(dates.map(d => d.getHours())).toEqual([18]);
  });

  test('all hours passed today + 1 day window → empty', () => {
    const late = new Date(2026, 6, 8, 23, 0);
    expect(nextReminderDates([9, 12], late, 1)).toEqual([]);
  });

  test('minutes are zeroed', () => {
    const dates = nextReminderDates([15], now, 1);
    expect(dates[0].getMinutes()).toBe(0);
    expect(dates[0].getSeconds()).toBe(0);
  });

  test('empty hours → empty', () => {
    expect(nextReminderDates([], now, 2)).toEqual([]);
  });
});
