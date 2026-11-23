/**
 * Tipos de domínio do METADAY.
 * Mapeamento com o modelo de dados do PRD (seção 8): snake_case no banco/Supabase,
 * camelCase aqui. Datas civis são strings 'YYYY-MM-DD' (sem fuso) — ver dates.ts.
 */

/** Data civil 'YYYY-MM-DD'. */
export type CivilDate = string;

export const GOAL_STATUSES = ['active', 'paused', 'completed', 'archived'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_FREQUENCIES = ['daily', 'weekly', 'monthly', 'flexible'] as const;
export type GoalFrequency = (typeof GOAL_FREQUENCIES)[number];

export const GOAL_PRIORITIES = ['low', 'medium', 'high'] as const;
export type GoalPriority = (typeof GOAL_PRIORITIES)[number];

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category?: string;
  startDate: CivilDate;
  targetDate: CivilDate;
  /** Valor-alvo opcional (> 0). Sem ele o progresso numérico é indeterminado. */
  targetValue?: number;
  /** Valor realizado. Pode ultrapassar o alvo (o visual limita a 100%). */
  currentValue: number;
  unit?: string;
  frequency: GoalFrequency;
  priority: GoalPriority;
  status: GoalStatus;
  /** No máximo um objetivo principal por conta. */
  isPrimary: boolean;
  /** Meta pausada automaticamente por downgrade de plano (reversível). */
  suspendedByPlan?: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface GoalInput {
  title: string;
  description?: string;
  category?: string;
  startDate: CivilDate;
  targetDate: CivilDate;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  frequency: GoalFrequency;
  priority: GoalPriority;
}

export type GoalUpdate = Partial<GoalInput>;

export const MOODS = ['very_low', 'low', 'neutral', 'good', 'great'] as const;
export type Mood = (typeof MOODS)[number];

export interface CheckIn {
  id: string;
  goalId: string;
  localDate: CivilDate;
  quantity?: number;
  mood?: Mood;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CheckInInput {
  /** Gerado pelo cliente: torna o envio idempotente (prevenção de envio duplo). */
  id?: string;
  goalId: string;
  localDate: CivilDate;
  quantity?: number;
  mood?: Mood;
  notes?: string;
}

export type CheckInUpdate = Partial<Omit<CheckInInput, 'id'>>;

export const HABIT_STATUSES = ['active', 'paused', 'archived'] as const;
export type HabitStatus = (typeof HABIT_STATUSES)[number];

export const HABIT_ICONS = [
  'dumbbell',
  'book',
  'droplets',
  'moon',
  'footprints',
  'brain',
  'apple',
  'pencil',
  'wallet',
  'heart',
  'sun',
  'target',
] as const;
export type HabitIcon = (typeof HABIT_ICONS)[number];

/** Recorrência semanal: dias 0 (domingo) a 6 (sábado). Diário = todos os dias. */
export interface HabitRecurrence {
  type: 'weekly';
  days: number[];
}

export interface HabitPause {
  from: CivilDate;
  /** null = pausa em andamento. */
  to: CivilDate | null;
}

export interface Habit {
  id: string;
  title: string;
  icon: HabitIcon;
  recurrence: HabitRecurrence;
  status: HabitStatus;
  /** Metas associadas (equivale à tabela goal_habits do modelo de produção). */
  goalIds: string[];
  /** Primeiro dia considerado nas oportunidades programadas. */
  startDate: CivilDate;
  /** Pausas: dias dentro de uma pausa NÃO são oportunidades (não penalizam). */
  pauses: HabitPause[];
  createdAt: string;
}

export interface HabitInput {
  title: string;
  icon: HabitIcon;
  recurrence: HabitRecurrence;
  goalIds: string[];
  startDate?: CivilDate;
}

export type HabitUpdate = Partial<HabitInput>;

export interface HabitEntry {
  /** Chave composta `${habitId}:${localDate}` — um registro por hábito/dia. */
  id: string;
  habitId: string;
  localDate: CivilDate;
  completed: boolean;
  notes?: string;
  createdAt: string;
}

export type PlanId = 'free' | 'premium';

export interface Subscription {
  plan: PlanId;
  status: 'active';
  /** 'demo-local' = simulação local, SEM cobrança. Nunca um provedor real no beta. */
  providerRef: 'demo-local';
  updatedAt: string;
}

export interface Settings {
  displayName: string;
  timezone: string;
  /** 0 = domingo, 1 = segunda. */
  weekStartsOn: 0 | 1;
  locale: 'pt-BR';
}

export interface Snapshot {
  goals: Goal[];
  habits: Habit[];
  habitEntries: HabitEntry[];
  checkIns: CheckIn[];
  subscription: Subscription;
  settings: Settings;
}

export type DataMode = 'local' | 'demo';
