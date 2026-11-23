/**
 * Hábitos: dias programados, sequência (streak) e constância.
 *
 * Princípios não punitivos:
 *  - Dias NÃO programados (fora da recorrência) e dias em PAUSA não são oportunidades:
 *    nunca quebram a sequência nem reduzem a constância.
 *  - O dia de hoje, se ainda não cumprido, não conta como falta.
 */
import { addDays, compareCivil, weekdayOf } from './dates.ts';
import type { CivilDate, Habit, HabitEntry } from './types.ts';

export const CONSISTENCY_WINDOW_DAYS = 30;
const STREAK_SCAN_LIMIT_DAYS = 3660;

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS_ONLY = [1, 2, 3, 4, 5];
export const WEEKEND_ONLY = [0, 6];

export function isInPause(habit: Pick<Habit, 'pauses'>, date: CivilDate): boolean {
  return habit.pauses.some((p) => compareCivil(date, p.from) >= 0 && (p.to === null || compareCivil(date, p.to) <= 0));
}

/** O hábito é uma oportunidade (programado e ativo) nessa data? */
export function isScheduled(habit: Pick<Habit, 'startDate' | 'recurrence' | 'pauses'>, date: CivilDate): boolean {
  if (compareCivil(date, habit.startDate) < 0) return false;
  if (!habit.recurrence.days.includes(weekdayOf(date))) return false;
  return !isInPause(habit, date);
}

export function completedDates(entries: readonly HabitEntry[], habitId: string): Set<CivilDate> {
  const set = new Set<CivilDate>();
  for (const e of entries) if (e.habitId === habitId && e.completed) set.add(e.localDate);
  return set;
}

/** Sequência atual de dias programados cumpridos. */
export function computeStreak(habit: Habit, entries: readonly HabitEntry[], today: CivilDate): number {
  const done = completedDates(entries, habit.id);
  let streak = 0;
  let cursor = today;
  for (let i = 0; i < STREAK_SCAN_LIMIT_DAYS; i++) {
    if (compareCivil(cursor, habit.startDate) < 0) break;
    if (isScheduled(habit, cursor)) {
      if (done.has(cursor)) streak += 1;
      else if (cursor !== today) break; // hoje ainda pode ser cumprido
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface Consistency {
  done: number;
  scheduled: number;
  /** 0–100, ou null quando não houve oportunidades programadas na janela. */
  percent: number | null;
}

/** Constância = cumpridos ÷ oportunidades programadas nos últimos N dias (inclui hoje só se cumprido). */
export function computeConsistency(
  habit: Habit,
  entries: readonly HabitEntry[],
  today: CivilDate,
  windowDays = CONSISTENCY_WINDOW_DAYS,
): Consistency {
  const done = completedDates(entries, habit.id);
  const windowStart = addDays(today, -(windowDays - 1));
  const from = compareCivil(windowStart, habit.startDate) > 0 ? windowStart : habit.startDate;
  let scheduled = 0;
  let completed = 0;
  for (let cursor = from; compareCivil(cursor, today) <= 0; cursor = addDays(cursor, 1)) {
    if (!isScheduled(habit, cursor)) continue;
    const isDone = done.has(cursor);
    if (cursor === today && !isDone) continue;
    scheduled += 1;
    if (isDone) completed += 1;
  }
  return { done: completed, scheduled, percent: scheduled === 0 ? null : (completed / scheduled) * 100 };
}

export function recurrenceLabel(days: readonly number[]): string {
  const key = [...days].sort((a, b) => a - b).join(',');
  if (key === ALL_DAYS.join(',')) return 'Todos os dias';
  if (key === WEEKDAYS_ONLY.join(',')) return 'Dias úteis';
  if (key === [...WEEKEND_ONLY].sort((a, b) => a - b).join(',')) return 'Fins de semana';
  const names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  return [...days].sort((a, b) => a - b).map((d) => names[d]).join(', ');
}
