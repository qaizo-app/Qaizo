// src/utils/reminderSchedule.ts
// Pure helper: turn a reminder interval (hours) + a daytime window into the
// list of clock hours at which to fire "log your expenses" reminders. Kept
// separate from notificationService so it's trivially testable.

const clampHour = (h: number): number => Math.max(0, Math.min(23, Math.round(h)));

// e.g. computeReminderHours(3, 9, 22) → [9, 12, 15, 18, 21]
export function computeReminderHours(intervalHours: number, startHour: number, endHour: number): number[] {
  if (!Number.isFinite(intervalHours) || intervalHours < 1) return [];
  const start = clampHour(startHour);
  const end = clampHour(endHour);
  if (start > end) return [];
  const hours: number[] = [];
  for (let h = start; h <= end; h += Math.round(intervalHours)) hours.push(h);
  return hours;
}

// Expand clock hours into concrete future fire Dates over the next `days`
// days (day 0 = today). Occurrences at or before `now` are skipped — this is
// what lets the caller use one-shot DATE triggers instead of repeating DAILY
// ones, which on Android fire immediately when the hour already passed today.
export function nextReminderDates(hours: number[], now: Date, days: number): Date[] {
  const dates: Date[] = [];
  for (let day = 0; day < days; day++) {
    for (const hour of hours) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, 0, 0, 0);
      if (d.getTime() > now.getTime()) dates.push(d);
    }
  }
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

export default computeReminderHours;
