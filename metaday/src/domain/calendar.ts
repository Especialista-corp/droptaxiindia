/** Grade mensal e marcadores do calendário. */
import { addDays, daysInMonth, formatCivil, parseCivil, startOfWeek } from './dates.ts';
import type { CheckIn, CivilDate, Goal, Habit, HabitEntry } from './types.ts';

export interface CalendarCell {
  date: CivilDate;
  inMonth: boolean;
}

/** Semanas (linhas) que cobrem o mês de `monthDate`. */
export function monthGrid(monthDate: CivilDate, weekStartsOn: 0 | 1): CalendarCell[][] {
  const { y, m } = parseCivil(monthDate);
  const first = formatCivil(y, m, 1);
  const last = formatCivil(y, m, daysInMonth(y, m));
  const weeks: CalendarCell[][] = [];
  let cursor = startOfWeek(first, weekStartsOn);
  while (cursor <= last) {
    const row: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(cursor, i);
      const p = parseCivil(date);
      row.push({ date, inMonth: p.y === y && p.m === m });
    }
    weeks.push(row);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export interface DayMarkers {
  checkIns: CheckIn[];
  habitEntries: HabitEntry[];
  deadlines: Goal[];
}

export function buildMarkerIndex(args: {
  goals: readonly Goal[];
  habits: readonly Habit[];
  habitEntries: readonly HabitEntry[];
  checkIns: readonly CheckIn[];
}): (date: CivilDate) => DayMarkers {
  const { goals, habits, habitEntries, checkIns } = args;
  const activeHabitIds = new Set(habits.filter((h) => h.status !== 'archived').map((h) => h.id));
  const ci = new Map<CivilDate, CheckIn[]>();
  for (const c of checkIns) ci.set(c.localDate, [...(ci.get(c.localDate) ?? []), c]);
  const he = new Map<CivilDate, HabitEntry[]>();
  for (const e of habitEntries) {
    if (!e.completed || !activeHabitIds.has(e.habitId)) continue;
    he.set(e.localDate, [...(he.get(e.localDate) ?? []), e]);
  }
  const dl = new Map<CivilDate, Goal[]>();
  for (const g of goals) {
    if (g.status === 'archived') continue;
    dl.set(g.targetDate, [...(dl.get(g.targetDate) ?? []), g]);
  }
  return (date) => ({ checkIns: ci.get(date) ?? [], habitEntries: he.get(date) ?? [], deadlines: dl.get(date) ?? [] });
}
