// Working-day date math. Sundays are skipped by default (PRD §4.3).
// Working days are stored on the organization as a JSON array like
// ["mon","tue","wed","thu","fri","sat"]. Future: user can customize
// (e.g. skip Fridays for different regional schedules).

export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

const ORDER: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const DEFAULT_WORKING_DAYS: DayKey[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
];

/**
 * Given a starting date and a count N, return an array of N consecutive
 * working dates (00:00 local time, epoch ms) starting on or AFTER `start`.
 * Example: daily line with 30 installments starting Mon → 30 working days
 * skipping Sundays along the way.
 */
export function generateWorkingDates(
  start: Date | number,
  count: number,
  workingDays: DayKey[] = DEFAULT_WORKING_DAYS
): number[] {
  const set = new Set(workingDays);
  const out: number[] = [];
  const cursor = new Date(typeof start === 'number' ? start : start.getTime());
  cursor.setHours(0, 0, 0, 0);

  while (out.length < count) {
    const key = ORDER[cursor.getDay()];
    if (set.has(key)) out.push(cursor.getTime());
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * Generate N weekly dates (one per week, same weekday as start).
 */
export function generateWeeklyDates(start: Date | number, count: number): number[] {
  const base = new Date(typeof start === 'number' ? start : start.getTime());
  base.setHours(0, 0, 0, 0);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getTime());
    d.setDate(base.getDate() + i * 7);
    out.push(d.getTime());
  }
  return out;
}

/**
 * Generate N monthly dates (same day-of-month as start, clamped to month length).
 */
export function generateMonthlyDates(start: Date | number, count: number): number[] {
  const base = new Date(typeof start === 'number' ? start : start.getTime());
  base.setHours(0, 0, 0, 0);
  const out: number[] = [];
  const day = base.getDate();
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    // Clamp to month length (handles Jan 31 → Feb 28 etc.)
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    out.push(d.getTime());
  }
  return out;
}

export function isWorkingDay(
  date: Date | number,
  workingDays: DayKey[] = DEFAULT_WORKING_DAYS
): boolean {
  const d = new Date(typeof date === 'number' ? date : date.getTime());
  return workingDays.includes(ORDER[d.getDay()]);
}
