/**
 * Implementação IndexedDB dos repositórios (persistência do BETA 0.1).
 *
 * Todas as regras críticas são aplicadas aqui, dentro de uma transação:
 *  - limite de objetivos ativos do plano (PlanLimitError);
 *  - no máximo um objetivo principal (normalizePrimary);
 *  - check-in idempotente por id + atualização do valor realizado do objetivo;
 *  - downgrade sem perda de dados (suspensão reversível).
 */
import type { IDBPTransaction, StoreNames } from 'idb';
import { addDays, compareCivil, detectTimeZone, isValidTimeZone, toCivilDate } from '@/domain/dates.ts';
import { isScheduled } from '@/domain/habits.ts';
import { activeGoalLimit, canActivateAnotherGoal, FREE_ACTIVE_GOAL_LIMIT } from '@/domain/plan.ts';
import { checkInInputSchema, goalInputSchema, habitInputSchema, settingsPatchSchema } from '@/domain/schemas.ts';
import type {
  CheckIn,
  CheckInInput,
  CheckInUpdate,
  CivilDate,
  DataMode,
  Goal,
  GoalInput,
  GoalStatus,
  GoalUpdate,
  Habit,
  HabitEntry,
  HabitInput,
  HabitStatus,
  HabitUpdate,
  PlanId,
  Settings,
  Snapshot,
  Subscription,
} from '@/domain/types.ts';
import { newId, roundQty } from '@/lib/utils.ts';
import {
  DowngradeSelectionRequiredError,
  GoalNotActiveError,
  NotFoundError,
  PlanLimitError,
  ValidationError,
} from '../errors.ts';
import type { DataLayer, DowngradeResult } from '../repositories.ts';
import { buildDemoSnapshot, defaultSettings, defaultSubscription, emptySnapshot } from '../seed.ts';
import { openMetadayDb, SCHEMA_VERSION, type MetadayDatabase, type MetadayDB } from './db.ts';

type StoreName = StoreNames<MetadayDB>;
type RwTx = IDBPTransaction<MetadayDB, StoreName[], 'readwrite'>;

export interface IdbDataLayerOptions {
  dbName: string;
  mode: DataMode;
  /** Relógio injetável (testes). */
  now?: () => Date;
  newId?: () => string;
}

interface Ctx {
  db: MetadayDatabase;
  mode: DataMode;
  now: () => Date;
  newId: () => string;
}

function zodIssues(error: { issues: { path: (string | number)[]; message: string }[] }): ValidationError {
  return new ValidationError(error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
}

async function run<T>(ctx: Ctx, stores: StoreName[], fn: (tx: RwTx) => Promise<T>): Promise<T> {
  const tx = ctx.db.transaction(stores, 'readwrite') as RwTx;
  try {
    const result = await fn(tx);
    await tx.done;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* transação já finalizada */
    }
    await tx.done.catch(() => undefined);
    throw error;
  }
}

async function readPlan(tx: RwTx): Promise<PlanId> {
  const sub = (await tx.objectStore('kv').get('subscription')) as Subscription | undefined;
  return sub?.plan ?? 'free';
}

async function readSettings(tx: RwTx): Promise<Settings> {
  const stored = (await tx.objectStore('kv').get('settings')) as Settings | undefined;
  return { ...defaultSettings(), ...stored };
}

async function readToday(ctx: Ctx, tx: RwTx): Promise<CivilDate> {
  const { timezone } = await readSettings(tx);
  return toCivilDate(ctx.now(), timezone);
}

function assertSlot(plan: PlanId, goals: Goal[]): void {
  if (!canActivateAnotherGoal(plan, goals)) throw new PlanLimitError(plan, activeGoalLimit(plan));
}

function pickNextPrimary(goals: Goal[]): Goal | undefined {
  return goals
    .filter((g) => g.status === 'active')
    .sort((a, b) => compareCivil(a.targetDate, b.targetDate) || a.createdAt.localeCompare(b.createdAt))[0];
}

/**
 * Garante o invariante "no máximo um principal, e ele é ativo ou concluído".
 * Se nenhum principal restar, promove o objetivo ativo com prazo mais próximo.
 */
function normalizePrimary(goals: Goal[], dirty: Set<string>, nowIso: string): void {
  const unset = (g: Goal) => {
    g.isPrimary = false;
    g.updatedAt = nowIso;
    dirty.add(g.id);
  };
  for (const g of goals) if (g.isPrimary && (g.status === 'paused' || g.status === 'archived')) unset(g);
  const primaries = goals.filter((g) => g.isPrimary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const extra of primaries.slice(1)) unset(extra);
  if (primaries.length === 0) {
    const next = pickNextPrimary(goals);
    if (next) {
      next.isPrimary = true;
      next.updatedAt = nowIso;
      dirty.add(next.id);
    }
  }
}

async function commitGoals(tx: RwTx, goals: Goal[], dirty: Set<string>): Promise<void> {
  const store = tx.objectStore('goals');
  for (const g of goals) if (dirty.has(g.id)) await store.put(g);
}

function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export async function createIdbDataLayer(options: IdbDataLayerOptions): Promise<DataLayer> {
  const db = await openMetadayDb(options.dbName);
  const ctx: Ctx = {
    db,
    mode: options.mode,
    now: options.now ?? (() => new Date()),
    newId: options.newId ?? newId,
  };
  const nowIso = () => ctx.now().toISOString();

  // Registros padrão (somente se ainda não existirem).
  await run(ctx, ['kv'], async (tx) => {
    const kv = tx.objectStore('kv');
    if ((await kv.get('settings')) === undefined) await kv.put(defaultSettings(), 'settings');
    if ((await kv.get('subscription')) === undefined) await kv.put(defaultSubscription(nowIso()), 'subscription');
    if ((await kv.get('meta')) === undefined) {
      await kv.put({ schemaVersion: SCHEMA_VERSION, createdAt: nowIso(), mode: ctx.mode }, 'meta');
    }
  });

  // -------------------------------------------------------------------- Goals
  const goals: DataLayer['goals'] = {
    async list() {
      return sortGoals(await db.getAll('goals'));
    },
    get: (id) => db.get('goals', id),

    async create(input: GoalInput) {
      const parsed = goalInputSchema.safeParse(input);
      if (!parsed.success) throw zodIssues(parsed.error);
      const v = parsed.data;
      return run(ctx, ['goals', 'kv'], async (tx) => {
        const plan = await readPlan(tx);
        const all = await tx.objectStore('goals').getAll();
        assertSlot(plan, all);
        const stamp = nowIso();
        const goal: Goal = {
          id: ctx.newId(),
          title: v.title,
          description: v.description,
          category: v.category,
          startDate: v.startDate,
          targetDate: v.targetDate,
          targetValue: v.targetValue,
          currentValue: v.currentValue ?? 0,
          unit: v.unit,
          frequency: v.frequency,
          priority: v.priority,
          status: 'active',
          isPrimary: false,
          createdAt: stamp,
          updatedAt: stamp,
        };
        all.push(goal);
        const dirty = new Set([goal.id]);
        normalizePrimary(all, dirty, stamp);
        await commitGoals(tx, all, dirty);
        return all.find((g) => g.id === goal.id)!;
      });
    },

    async update(id: string, patch: GoalUpdate) {
      return run(ctx, ['goals'], async (tx) => {
        const store = tx.objectStore('goals');
        const existing = await store.get(id);
        if (!existing) throw new NotFoundError('Objetivo', id);
        const merged = {
          title: existing.title,
          description: existing.description,
          category: existing.category,
          startDate: existing.startDate,
          targetDate: existing.targetDate,
          targetValue: existing.targetValue,
          currentValue: existing.currentValue,
          unit: existing.unit,
          frequency: existing.frequency,
          priority: existing.priority,
          ...patch,
        };
        const parsed = goalInputSchema.safeParse(merged);
        if (!parsed.success) throw zodIssues(parsed.error);
        const v = parsed.data;
        const updated: Goal = {
          ...existing,
          title: v.title,
          description: v.description,
          category: v.category,
          startDate: v.startDate,
          targetDate: v.targetDate,
          targetValue: v.targetValue,
          currentValue: v.currentValue ?? existing.currentValue,
          unit: v.unit,
          frequency: v.frequency,
          priority: v.priority,
          updatedAt: nowIso(),
        };
        await store.put(updated);
        return updated;
      });
    },

    async setStatus(id: string, status: GoalStatus) {
      return run(ctx, ['goals', 'kv'], async (tx) => {
        const all = await tx.objectStore('goals').getAll();
        const goal = all.find((g) => g.id === id);
        if (!goal) throw new NotFoundError('Objetivo', id);
        if (goal.status === status) return goal;
        const stamp = nowIso();
        if (status === 'active') assertSlot(await readPlan(tx), all);
        goal.status = status;
        goal.updatedAt = stamp;
        if (status === 'completed') goal.completedAt = stamp;
        else delete goal.completedAt;
        if (status === 'active' || status === 'paused') delete goal.suspendedByPlan;
        const dirty = new Set([goal.id]);
        normalizePrimary(all, dirty, stamp);
        await commitGoals(tx, all, dirty);
        return goal;
      });
    },

    async setPrimary(id: string) {
      return run(ctx, ['goals'], async (tx) => {
        const all = await tx.objectStore('goals').getAll();
        const goal = all.find((g) => g.id === id);
        if (!goal) throw new NotFoundError('Objetivo', id);
        if (goal.status !== 'active') {
          throw new GoalNotActiveError('Só objetivos ativos podem ser o objetivo principal.');
        }
        const stamp = nowIso();
        const dirty = new Set<string>();
        for (const g of all) {
          const shouldBePrimary = g.id === id;
          if (g.isPrimary !== shouldBePrimary) {
            g.isPrimary = shouldBePrimary;
            g.updatedAt = stamp;
            dirty.add(g.id);
          }
        }
        await commitGoals(tx, all, dirty);
        return goal;
      });
    },

    async remove(id: string) {
      await run(ctx, ['goals', 'checkIns', 'habits', 'kv'], async (tx) => {
        const goalsStore = tx.objectStore('goals');
        if (!(await goalsStore.get(id))) throw new NotFoundError('Objetivo', id);
        const checkInStore = tx.objectStore('checkIns');
        for (const key of await checkInStore.index('by-goal').getAllKeys(id)) await checkInStore.delete(key);
        const habitStore = tx.objectStore('habits');
        for (const habit of await habitStore.getAll()) {
          if (habit.goalIds.includes(id)) await habitStore.put({ ...habit, goalIds: habit.goalIds.filter((g) => g !== id) });
        }
        await goalsStore.delete(id);
        const rest = await goalsStore.getAll();
        const dirty = new Set<string>();
        normalizePrimary(rest, dirty, nowIso());
        await commitGoals(tx, rest, dirty);
      });
    },
  };

  // ----------------------------------------------------------------- Check-ins
  /** Aplica (+1) ou desfaz (−1) o efeito de um check-in no valor realizado do objetivo. */
  const applyEffect = (goal: Goal, quantity: number | undefined, sign: 1 | -1, stamp: string): void => {
    if (!quantity) return;
    goal.currentValue = Math.max(0, roundQty(goal.currentValue + sign * quantity));
    goal.updatedAt = stamp;
  };

  const checkIns: DataLayer['checkIns'] = {
    list: () => db.getAll('checkIns'),

    async create(input: CheckInInput) {
      const parsed = checkInInputSchema.safeParse(input);
      if (!parsed.success) throw zodIssues(parsed.error);
      const v = parsed.data;
      return run(ctx, ['checkIns', 'goals', 'kv'], async (tx) => {
        const store = tx.objectStore('checkIns');
        if (v.id) {
          const existing = await store.get(v.id);
          if (existing) return existing; // idempotente: reenvio não duplica nem soma de novo
        }
        const goalStore = tx.objectStore('goals');
        const goal = await goalStore.get(v.goalId);
        if (!goal) throw new NotFoundError('Objetivo', v.goalId);
        if (goal.status !== 'active') {
          throw new GoalNotActiveError('Só é possível registrar check-in em objetivos ativos.');
        }
        const today = await readToday(ctx, tx);
        if (compareCivil(v.localDate, today) > 0) {
          throw new ValidationError([{ path: 'localDate', message: 'A data do check-in não pode ser futura.' }]);
        }
        const stamp = nowIso();
        const checkIn: CheckIn = {
          id: v.id ?? ctx.newId(),
          goalId: v.goalId,
          localDate: v.localDate,
          quantity: v.quantity,
          mood: v.mood,
          notes: v.notes,
          createdAt: stamp,
        };
        await store.add(checkIn);
        applyEffect(goal, v.quantity, 1, stamp);
        await goalStore.put(goal);
        return checkIn;
      });
    },

    async update(id: string, patch: CheckInUpdate) {
      return run(ctx, ['checkIns', 'goals', 'kv'], async (tx) => {
        const store = tx.objectStore('checkIns');
        const existing = await store.get(id);
        if (!existing) throw new NotFoundError('Check-in', id);
        const merged = {
          goalId: existing.goalId,
          localDate: existing.localDate,
          quantity: existing.quantity,
          mood: existing.mood,
          notes: existing.notes,
          ...patch,
        };
        const parsed = checkInInputSchema.safeParse(merged);
        if (!parsed.success) throw zodIssues(parsed.error);
        const v = parsed.data;
        const goalStore = tx.objectStore('goals');
        const stamp = nowIso();
        const oldGoal = await goalStore.get(existing.goalId);
        const newGoal = v.goalId === existing.goalId ? oldGoal : await goalStore.get(v.goalId);
        if (!newGoal) throw new NotFoundError('Objetivo', v.goalId);
        if (v.goalId !== existing.goalId && newGoal.status !== 'active') {
          throw new GoalNotActiveError('Só é possível mover o check-in para um objetivo ativo.');
        }
        const today = await readToday(ctx, tx);
        if (compareCivil(v.localDate, today) > 0) {
          throw new ValidationError([{ path: 'localDate', message: 'A data do check-in não pode ser futura.' }]);
        }
        if (oldGoal) applyEffect(oldGoal, existing.quantity, -1, stamp);
        applyEffect(newGoal, v.quantity, 1, stamp);
        if (oldGoal && oldGoal.id !== newGoal.id) await goalStore.put(oldGoal);
        await goalStore.put(newGoal);
        const updated: CheckIn = {
          ...existing,
          goalId: v.goalId,
          localDate: v.localDate,
          quantity: v.quantity,
          mood: v.mood,
          notes: v.notes,
          updatedAt: stamp,
        };
        await store.put(updated);
        return updated;
      });
    },

    async remove(id: string) {
      await run(ctx, ['checkIns', 'goals'], async (tx) => {
        const store = tx.objectStore('checkIns');
        const existing = await store.get(id);
        if (!existing) return; // idempotente
        const goalStore = tx.objectStore('goals');
        const goal = await goalStore.get(existing.goalId);
        if (goal) {
          applyEffect(goal, existing.quantity, -1, nowIso());
          await goalStore.put(goal);
        }
        await store.delete(id);
      });
    },
  };

  // -------------------------------------------------------------------- Habits
  const habits: DataLayer['habits'] = {
    list: async () => (await db.getAll('habits')).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    listEntries: () => db.getAll('habitEntries'),

    async create(input: HabitInput) {
      const parsed = habitInputSchema.safeParse(input);
      if (!parsed.success) throw zodIssues(parsed.error);
      const v = parsed.data;
      return run(ctx, ['habits', 'goals', 'kv'], async (tx) => {
        const existingGoalIds = new Set((await tx.objectStore('goals').getAllKeys()) as string[]);
        const today = await readToday(ctx, tx);
        const habit: Habit = {
          id: ctx.newId(),
          title: v.title,
          icon: v.icon,
          recurrence: v.recurrence,
          status: 'active',
          goalIds: v.goalIds.filter((id) => existingGoalIds.has(id)),
          startDate: v.startDate ?? today,
          pauses: [],
          createdAt: nowIso(),
        };
        await tx.objectStore('habits').add(habit);
        return habit;
      });
    },

    async update(id: string, patch: HabitUpdate) {
      return run(ctx, ['habits', 'goals'], async (tx) => {
        const store = tx.objectStore('habits');
        const existing = await store.get(id);
        if (!existing) throw new NotFoundError('Hábito', id);
        const parsed = habitInputSchema.safeParse({
          title: existing.title,
          icon: existing.icon,
          recurrence: existing.recurrence,
          goalIds: existing.goalIds,
          startDate: existing.startDate,
          ...patch,
        });
        if (!parsed.success) throw zodIssues(parsed.error);
        const v = parsed.data;
        const existingGoalIds = new Set((await tx.objectStore('goals').getAllKeys()) as string[]);
        const updated: Habit = {
          ...existing,
          title: v.title,
          icon: v.icon,
          recurrence: v.recurrence,
          goalIds: v.goalIds.filter((g) => existingGoalIds.has(g)),
          startDate: v.startDate ?? existing.startDate,
        };
        await store.put(updated);
        return updated;
      });
    },

    async setStatus(id: string, status: HabitStatus) {
      return run(ctx, ['habits', 'kv'], async (tx) => {
        const store = tx.objectStore('habits');
        const habit = await store.get(id);
        if (!habit) throw new NotFoundError('Hábito', id);
        if (habit.status === status) return habit;
        const today = await readToday(ctx, tx);
        const pauses = habit.pauses.map((p) => ({ ...p }));
        const open = pauses.findIndex((p) => p.to === null);
        if (status === 'paused' && open === -1) pauses.push({ from: today, to: null });
        if (status === 'active' && open !== -1) {
          const closeAt = addDays(today, -1);
          const p = pauses[open]!;
          if (compareCivil(closeAt, p.from) < 0) pauses.splice(open, 1);
          else p.to = closeAt;
        }
        const updated: Habit = { ...habit, status, pauses };
        await store.put(updated);
        return updated;
      });
    },

    async remove(id: string) {
      await run(ctx, ['habits', 'habitEntries'], async (tx) => {
        const entries = tx.objectStore('habitEntries');
        for (const key of await entries.index('by-habit').getAllKeys(id)) await entries.delete(key);
        await tx.objectStore('habits').delete(id);
      });
    },

    async setEntry(habitId: string, localDate: CivilDate, completed: boolean) {
      await run(ctx, ['habits', 'habitEntries', 'kv'], async (tx) => {
        const habit = await tx.objectStore('habits').get(habitId);
        if (!habit) throw new NotFoundError('Hábito', habitId);
        if (habit.status !== 'active') {
          throw new ValidationError([{ path: 'habit', message: 'Só é possível registrar hábitos ativos.' }]);
        }
        const today = await readToday(ctx, tx);
        if (compareCivil(localDate, today) > 0) {
          throw new ValidationError([{ path: 'localDate', message: 'Não é possível registrar um dia futuro.' }]);
        }
        if (!isScheduled(habit, localDate)) {
          throw new ValidationError([{ path: 'localDate', message: 'Este hábito não está programado para este dia.' }]);
        }
        const entries = tx.objectStore('habitEntries');
        const key = `${habitId}:${localDate}`;
        if (completed) {
          const entry: HabitEntry = { id: key, habitId, localDate, completed: true, createdAt: nowIso() };
          if (!(await entries.get(key))) await entries.put(entry);
        } else {
          await entries.delete(key);
        }
      });
    },
  };

  // -------------------------------------------------------------- Subscription
  const subscription: DataLayer['subscription'] = {
    async get() {
      return ((await db.get('kv', 'subscription')) as Subscription | undefined) ?? defaultSubscription(nowIso());
    },

    async setPlan(plan: PlanId, opts): Promise<DowngradeResult> {
      return run(ctx, ['goals', 'kv'], async (tx) => {
        const stamp = nowIso();
        const suspendedGoalIds: string[] = [];
        if (plan === 'free') {
          const all = await tx.objectStore('goals').getAll();
          const active = all.filter((g) => g.status === 'active');
          if (active.length > FREE_ACTIVE_GOAL_LIMIT) {
            const keep = opts?.keepActiveGoalIds;
            const valid = keep && keep.length <= FREE_ACTIVE_GOAL_LIMIT && keep.every((id) => active.some((g) => g.id === id));
            if (!valid) throw new DowngradeSelectionRequiredError(active.length, FREE_ACTIVE_GOAL_LIMIT);
            const dirty = new Set<string>();
            for (const g of active) {
              if (keep.includes(g.id)) continue;
              g.status = 'paused';
              g.suspendedByPlan = true;
              g.updatedAt = stamp;
              dirty.add(g.id);
              suspendedGoalIds.push(g.id);
            }
            normalizePrimary(all, dirty, stamp);
            await commitGoals(tx, all, dirty);
          }
        }
        const sub: Subscription = { plan, status: 'active', providerRef: 'demo-local', updatedAt: stamp };
        await tx.objectStore('kv').put(sub, 'subscription');
        return { subscription: sub, suspendedGoalIds };
      });
    },

    async reactivateSuspendedGoals() {
      return run(ctx, ['goals', 'kv'], async (tx) => {
        const plan = await readPlan(tx);
        const all = await tx.objectStore('goals').getAll();
        const suspended = all
          .filter((g) => g.status === 'paused' && g.suspendedByPlan)
          .sort((a, b) => compareCivil(a.targetDate, b.targetDate));
        const stamp = nowIso();
        const dirty = new Set<string>();
        const reactivated: string[] = [];
        for (const g of suspended) {
          if (!canActivateAnotherGoal(plan, all)) break;
          g.status = 'active';
          delete g.suspendedByPlan;
          g.updatedAt = stamp;
          dirty.add(g.id);
          reactivated.push(g.id);
        }
        normalizePrimary(all, dirty, stamp);
        await commitGoals(tx, all, dirty);
        return reactivated;
      });
    },
  };

  // ------------------------------------------------------------------ Settings
  const settings: DataLayer['settings'] = {
    async get() {
      return { ...defaultSettings(), ...(((await db.get('kv', 'settings')) as Settings | undefined) ?? {}) };
    },
    async update(patch: Partial<Settings>) {
      const parsed = settingsPatchSchema.safeParse(patch);
      if (!parsed.success) throw zodIssues(parsed.error);
      if (parsed.data.timezone !== undefined && !isValidTimeZone(parsed.data.timezone)) {
        throw new ValidationError([{ path: 'timezone', message: 'Fuso horário inválido.' }]);
      }
      return run(ctx, ['kv'], async (tx) => {
        const current = await readSettings(tx);
        const next: Settings = { ...current };
        if (parsed.data.displayName !== undefined) next.displayName = parsed.data.displayName;
        if (parsed.data.timezone !== undefined) next.timezone = parsed.data.timezone;
        if (parsed.data.weekStartsOn !== undefined) next.weekStartsOn = parsed.data.weekStartsOn;
        await tx.objectStore('kv').put(next, 'settings');
        return next;
      });
    },
  };

  // --------------------------------------------------------------------- Admin
  const ALL_STORES: StoreName[] = ['goals', 'habits', 'habitEntries', 'checkIns', 'kv'];

  async function replaceAll(snapshot: Snapshot): Promise<void> {
    await run(ctx, ALL_STORES, async (tx) => {
      for (const name of ALL_STORES) await tx.objectStore(name).clear();
      for (const g of snapshot.goals) await tx.objectStore('goals').put(g);
      for (const h of snapshot.habits) await tx.objectStore('habits').put(h);
      for (const e of snapshot.habitEntries) await tx.objectStore('habitEntries').put(e);
      for (const c of snapshot.checkIns) await tx.objectStore('checkIns').put(c);
      const kv = tx.objectStore('kv');
      await kv.put(snapshot.settings, 'settings');
      await kv.put(snapshot.subscription, 'subscription');
      await kv.put({ schemaVersion: SCHEMA_VERSION, createdAt: nowIso(), mode: ctx.mode }, 'meta');
    });
  }

  const admin: DataLayer['admin'] = {
    async snapshot(): Promise<Snapshot> {
      const [g, h, he, ci, sub, set] = await Promise.all([
        goals.list(),
        habits.list(),
        habits.listEntries(),
        checkIns.list(),
        subscription.get(),
        settings.get(),
      ]);
      return { goals: g, habits: h, habitEntries: he, checkIns: ci, subscription: sub, settings: set };
    },
    async isEmpty() {
      const [g, h, c] = await Promise.all([db.count('goals'), db.count('habits'), db.count('checkIns')]);
      return g + h + c === 0;
    },
    async clearAll() {
      await replaceAll(emptySnapshot(ctx.now(), detectTimeZone()));
    },
    async seedDemo() {
      const { timezone } = await settings.get();
      await replaceAll(buildDemoSnapshot(ctx.now(), timezone));
    },
    async exportJson() {
      const data = await admin.snapshot();
      return JSON.stringify(
        { app: 'METADAY', schemaVersion: SCHEMA_VERSION, mode: ctx.mode, exportedAt: nowIso(), data },
        null,
        2,
      );
    },
  };

  return { mode: ctx.mode, goals, checkIns, habits, subscription, settings, admin, close: () => db.close() };
}
