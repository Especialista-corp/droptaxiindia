/**
 * Interfaces de repositório. As telas dependem só destes contratos; trocar IndexedDB
 * por Supabase (Entrega D) não exige refazer a UI. Toda regra de negócio crítica
 * (limite de plano, único principal, idempotência) é aplicada NA IMPLEMENTAÇÃO,
 * dentro de transação — nunca apenas na interface do usuário.
 */
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

export interface GoalRepository {
  list(): Promise<Goal[]>;
  get(id: string): Promise<Goal | undefined>;
  /** Lança PlanLimitError se o plano FREE já tem 3 objetivos ativos. */
  create(input: GoalInput): Promise<Goal>;
  update(id: string, patch: GoalUpdate): Promise<Goal>;
  /** Para 'active' valida vaga no plano (PlanLimitError). Mantém no máximo 1 principal. */
  setStatus(id: string, status: GoalStatus): Promise<Goal>;
  /** Só objetivos ativos podem ser principais. Remove a marca dos demais. */
  setPrimary(id: string): Promise<Goal>;
  /** Exclui e remove check-ins do objetivo e vínculos em hábitos. */
  remove(id: string): Promise<void>;
}

export interface CheckInRepository {
  list(): Promise<CheckIn[]>;
  /** Idempotente por `input.id`. Atualiza o valor realizado do objetivo na mesma transação. */
  create(input: CheckInInput): Promise<CheckIn>;
  update(id: string, patch: CheckInUpdate): Promise<CheckIn>;
  remove(id: string): Promise<void>;
}

export interface HabitRepository {
  list(): Promise<Habit[]>;
  listEntries(): Promise<HabitEntry[]>;
  create(input: HabitInput): Promise<Habit>;
  update(id: string, patch: HabitUpdate): Promise<Habit>;
  /** Pausar registra um período de pausa (dias em pausa não penalizam). */
  setStatus(id: string, status: HabitStatus): Promise<Habit>;
  remove(id: string): Promise<void>;
  /** Marca/desmarca o cumprimento em uma data programada (não futura). */
  setEntry(habitId: string, localDate: CivilDate, completed: boolean): Promise<void>;
}

export interface DowngradeResult {
  subscription: Subscription;
  suspendedGoalIds: string[];
}

export interface SubscriptionRepository {
  get(): Promise<Subscription>;
  /**
   * Simulação local de plano (SEM cobrança). Em FREE com > 3 ativos exige
   * `keepActiveGoalIds` (≤ 3) e suspende os demais de forma reversível.
   */
  setPlan(plan: PlanId, options?: { keepActiveGoalIds?: string[] }): Promise<DowngradeResult>;
  /** Reativa metas suspensas por downgrade, enquanto houver vaga. Retorna os ids reativados. */
  reactivateSuspendedGoals(): Promise<string[]>;
}

export interface SettingsRepository {
  get(): Promise<Settings>;
  update(patch: Partial<Settings>): Promise<Settings>;
}

export interface AdminRepository {
  snapshot(): Promise<Snapshot>;
  isEmpty(): Promise<boolean>;
  /** Apaga TUDO deste conjunto de dados (preservando o esquema). */
  clearAll(): Promise<void>;
  /** Substitui o conteúdo pelos dados de demonstração relativos a `now`. */
  seedDemo(): Promise<void>;
  exportJson(): Promise<string>;
}

export interface DataLayer {
  mode: DataMode;
  goals: GoalRepository;
  checkIns: CheckInRepository;
  habits: HabitRepository;
  subscription: SubscriptionRepository;
  settings: SettingsRepository;
  admin: AdminRepository;
  close(): void;
}
