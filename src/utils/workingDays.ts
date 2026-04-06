// Working-day date math. Sundays are skipped by default (PRD §4.3).

export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

const ORDER: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const DEFAULT_WORKING_DAYS: DayKey[] = [
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat',
];

/**
 * Generate N consecutive working dates starting on or AFTER `start`.
 * GUARD: if workingDays is empty, returns empty array (prevents infinite loop).
 * GUARD: max 10000 iterations to prevent runaway loops.
 */
export function generateWorkingDates(
  start: Date | number,
  count: number,
  workingDays: DayKey[] = DEFAULT_WORKING_DAYS
): number[] {
  if (count <= 0 || workingDays.length === 0) return [];

  const set = new Set(workingDays);
  const out: number[] = [];
  const cursor = new Date(typeof start === 'number' ? start : start.getTime());
  cursor.setHours(0, 0, 0, 0);

  let safety = 0;
  while (out.length < count && safety < 10000) {
    // Re-normalize to midnight each iteration (DST safety)
    cursor.setHours(0, 0, 0, 0);
    const key = ORDER[cursor.getDay()];
    if (set.has(key)) out.push(cursor.getTime());
    cursor.setDate(cursor.getDate() + 1);
    safety++;
  }
  return out;
}

/**
 * Generate N weekly dates (one per week, same weekday as start).
 */
export function generateWeeklyDates(start: Date | number, count: number): number[] {
  if (count <= 0) return [];
  const base = new Date(typeof start === 'number' ? start : start.getTime());
  base.setHours(0, 0, 0, 0);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getTime());
    d.setDate(base.getDate() + i * 7);
    d.setHours(0, 0, 0, 0); // DST safety
    out.push(d.getTime());
  }
  return out;
}

/**
 * Generate N monthly dates (same day-of-month as start, clamped to month length).
 */
export function generateMonthlyDates(start: Date | number, count: number): number[] {
  if (count <= 0) return [];
  const base = new Date(typeof start === 'number' ? start : start.getTime());
  base.setHours(0, 0, 0, 0);
  const out: number[] = [];
  const day = base.getDate();
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    d.setHours(0, 0, 0, 0);
    out.push(d.getTime());
  }
  return out;
}

/**
 * Get today at midnight (00:00:00.000 local time). Used for consistent
 * date comparisons — avoids off-by-one from time-of-day differences.
 */
export function todayMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isWorkingDay(
  date: Date | number,
  workingDays: DayKey[] = DEFAULT_WORKING_DAYS
): boolean {
  const d = new Date(typeof date === 'number' ? date : date.getTime());
  return workingDays.includes(ORDER[d.getDay()]);
}
