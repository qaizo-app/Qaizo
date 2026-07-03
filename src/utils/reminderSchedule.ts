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

export default computeReminderHours;
