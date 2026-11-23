import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useToday } from './clock.tsx';
import { useData } from './data.tsx';
import { detectTimeZone } from '@/domain/dates.ts';
import { activeGoalLimit, canActivateAnotherGoal, countActiveGoals } from '@/domain/plan.ts';
import { evaluateGoal, type GoalEvaluation } from '@/domain/progress.ts';
import type {
  CheckInInput,
  CheckInUpdate,
  CivilDate,
  DataMode,
  Goal,
  GoalInput,
  GoalStatus,
  GoalUpdate,
  HabitInput,
  HabitStatus,
  HabitUpdate,
  PlanId,
  Settings,
  Snapshot,
} from '@/domain/types.ts';

export function useSnapshot() {
  const { layer, mode } = useData();
  return useQuery({ queryKey: ['snapshot', mode], queryFn: () => layer.admin.snapshot() });
}

export interface AppModel {
  snapshot: Snapshot;
  mode: DataMode;
  today: CivilDate;
  tz: string;
  plan: PlanId;
  goals: Goal[];
  /** Objetivo principal (ativo ou recém-concluído), se existir. */
  primary: Goal | undefined;
  activeGoals: Goal[];
  activeCount: number;
  limit: number;
  canAddGoal: boolean;
  evaluate: (goal: Goal) => GoalEvaluation;
}

/** Visão derivada e consistente do estado (todas as telas usam o MESMO cálculo). */
export function useAppModel(): AppModel | null {
  const { mode } = useData();
  const { data } = useSnapshot();
  const tz = data?.settings.timezone ?? detectTimeZone();
  const today = useToday(tz);

  return useMemo(() => {
    if (!data) return null;
    const plan = data.subscription.plan;
    const goals = data.goals;
    const evalCache = new Map<string, GoalEvaluation>();
    const evaluate = (goal: Goal): GoalEvaluation => {
      let e = evalCache.get(goal.id);
      if (!e) {
        e = evaluateGoal(goal, today);
        evalCache.set(goal.id, e);
      }
      return e;
    };
    return {
      snapshot: data,
      mode,
      today,
      tz,
      plan,
      goals,
      primary: goals.find((g) => g.isPrimary),
      activeGoals: goals.filter((g) => g.status === 'active'),
      activeCount: countActiveGoals(goals),
      limit: activeGoalLimit(plan),
      canAddGoal: canActivateAnotherGoal(plan, goals),
      evaluate,
    } satisfies AppModel;
  }, [data, mode, today, tz]);
}

/** Mutations: chamam os repositórios e invalidam o snapshot para todas as telas refletirem a mudança. */
export function useActions() {
  const { layer, mode } = useData();
  const qc = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSettled: () => qc.invalidateQueries({ queryKey: ['snapshot', mode] }),
  });
  const run = useCallback(<T,>(fn: () => Promise<T>) => mutateAsync(fn) as Promise<T>, [mutateAsync]);

  return useMemo(
    () => ({
      createGoal: (input: GoalInput) => run(() => layer.goals.create(input)),
      updateGoal: (id: string, patch: GoalUpdate) => run(() => layer.goals.update(id, patch)),
      setGoalStatus: (id: string, status: GoalStatus) => run(() => layer.goals.setStatus(id, status)),
      setPrimaryGoal: (id: string) => run(() => layer.goals.setPrimary(id)),
      deleteGoal: (id: string) => run(() => layer.goals.remove(id)),

      createCheckIn: (input: CheckInInput) => run(() => layer.checkIns.create(input)),
      updateCheckIn: (id: string, patch: CheckInUpdate) => run(() => layer.checkIns.update(id, patch)),
      deleteCheckIn: (id: string) => run(() => layer.checkIns.remove(id)),

      createHabit: (input: HabitInput) => run(() => layer.habits.create(input)),
      updateHabit: (id: string, patch: HabitUpdate) => run(() => layer.habits.update(id, patch)),
      setHabitStatus: (id: string, status: HabitStatus) => run(() => layer.habits.setStatus(id, status)),
      deleteHabit: (id: string) => run(() => layer.habits.remove(id)),
      setHabitEntry: (habitId: string, date: CivilDate, completed: boolean) =>
        run(() => layer.habits.setEntry(habitId, date, completed)),

      setPlan: (plan: PlanId, keepActiveGoalIds?: string[]) => run(() => layer.subscription.setPlan(plan, { keepActiveGoalIds })),
      reactivateSuspended: () => run(() => layer.subscription.reactivateSuspendedGoals()),
      updateSettings: (patch: Partial<Settings>) => run(() => layer.settings.update(patch)),

      restoreDemo: () => run(() => layer.admin.seedDemo()),
      clearAllData: () => run(() => layer.admin.clearAll()),
      exportJson: () => layer.admin.exportJson(),
    }),
    [layer, run],
  );
}

export type Actions = ReturnType<typeof useActions>;
