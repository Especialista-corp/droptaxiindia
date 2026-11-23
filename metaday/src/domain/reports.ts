/** Agregações para Relatórios — sempre calculadas a partir de registros reais. */
import { addDays } from './dates.ts';
import { computeConsistency } from './habits.ts';
import { evaluateGoal } from './progress.ts';
import type { CheckIn, CivilDate, Goal, Habit, HabitEntry } from './types.ts';

export interface ActivityDay {
  date: CivilDate;
  checkIns: number;
  habits: number;
  total: number;
}

/** Atividade dos últimos `days` dias (inclui hoje), do mais antigo ao mais recente. */
export function activitySeries(
  checkIns: readonly CheckIn[],
  habitEntries: readonly HabitEntry[],
  today: CivilDate,
  days = 14,
): ActivityDay[] {
  const byDate = new Map<CivilDate, ActivityDay>();
  const series: ActivityDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const day: ActivityDay = { date, checkIns: 0, habits: 0, total: 0 };
    byDate.set(date, day);
    series.push(day);
  }
  for (const c of checkIns) {
    const day = byDate.get(c.localDate);
    if (day) day.checkIns += 1;
  }
  for (const e of habitEntries) {
    if (!e.completed) continue;
    const day = byDate.get(e.localDate);
    if (day) day.habits += 1;
  }
  for (const day of series) day.total = day.checkIns + day.habits;
  return series;
}

export interface ReportSummary {
  totalCheckIns: number;
  /** Constância agregada (cumpridos ÷ programados, 30 dias). null sem hábitos/oportunidades. */
  consistencyPercent: number | null;
  habitsDone: number;
  habitsScheduled: number;
  onTrack: number;
  atRisk: number;
  insufficient: number;
  hasActivity: boolean;
}

export function buildReportSummary(args: {
  goals: readonly Goal[];
  habits: readonly Habit[];
  habitEntries: readonly HabitEntry[];
  checkIns: readonly CheckIn[];
  today: CivilDate;
}): ReportSummary {
  const { goals, habits, habitEntries, checkIns, today } = args;
  let done = 0;
  let scheduled = 0;
  for (const habit of habits) {
    if (habit.status !== 'active') continue;
    const c = computeConsistency(habit, habitEntries, today);
    done += c.done;
    scheduled += c.scheduled;
  }
  let onTrack = 0;
  let atRisk = 0;
  let insufficient = 0;
  for (const goal of goals) {
    if (goal.status !== 'active') continue;
    const s = evaluateGoal(goal, today).status;
    if (s === 'on_track') onTrack += 1;
    else if (s === 'at_risk' || s === 'overdue') atRisk += 1;
    else if (s === 'insufficient' || s === 'no_target') insufficient += 1;
  }
  return {
    totalCheckIns: checkIns.length,
    consistencyPercent: scheduled === 0 ? null : (done / scheduled) * 100,
    habitsDone: done,
    habitsScheduled: scheduled,
    onTrack,
    atRisk,
    insufficient,
    hasActivity: checkIns.length > 0 || habitEntries.some((e) => e.completed),
  };
}
