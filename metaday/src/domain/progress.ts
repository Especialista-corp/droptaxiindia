/**
 * Progresso, tempo decorrido e ritmo ("no ritmo" / "em risco").
 *
 * São DUAS dimensões separadas (decisão 37):
 *  - Progresso da meta: valor realizado ÷ valor-alvo (precisa de valor-alvo).
 *  - Tempo decorrido: (hoje − início) ÷ (alvo − início), em datas civis.
 * Constância (hábitos) é outra métrica e fica em habits.ts.
 */
import { diffDays } from './dates.ts';
import type { CivilDate, Goal } from './types.ts';

/** Mínimo de dias desde o início para avaliar o ritmo (ou 25% do prazo). */
export const MIN_ELAPSED_DAYS_FOR_PACE = 7;
export const MIN_ELAPSED_PERCENT_FOR_PACE = 25;
/** Tolerância (pontos percentuais) entre progresso e tempo decorrido. */
export const PACE_TOLERANCE_POINTS = 15;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Progresso bruto em % (pode passar de 100). null se não houver valor-alvo > 0. */
export function rawProgressPercent(currentValue: number, targetValue?: number): number | null {
  if (targetValue === undefined || !(targetValue > 0)) return null;
  return (currentValue / targetValue) * 100;
}

/** Progresso limitado a 0–100% para exibição. O valor realizado NUNCA é descartado. */
export function progressPercent(currentValue: number, targetValue?: number): number | null {
  const raw = rawProgressPercent(currentValue, targetValue);
  return raw === null ? null : clamp(raw, 0, 100);
}

/** Tempo decorrido em % (0–100), em datas civis. */
export function elapsedPercent(startDate: CivilDate, targetDate: CivilDate, today: CivilDate): number {
  const total = diffDays(startDate, targetDate);
  if (total <= 0) return diffDays(today, targetDate) <= 0 ? 100 : 0;
  return clamp((diffDays(startDate, today) / total) * 100, 0, 100);
}

export type PaceState = 'on_track' | 'at_risk' | 'insufficient' | 'no_target' | 'overdue';
export type GoalDisplayStatus = 'completed' | 'paused' | 'archived' | PaceState;

export interface GoalEvaluation {
  status: GoalDisplayStatus;
  pace: PaceState | null;
  /** 0–100 ou null (sem valor-alvo). */
  progress: number | null;
  rawProgress: number | null;
  elapsed: number;
  /** Valor-alvo já atingido (mesmo que a meta ainda não esteja marcada como concluída). */
  reachedTarget: boolean;
  /** Explicação curta e não punitiva do critério usado. */
  reason: string;
}

/**
 * Regras de ritmo (explícitas e explicáveis):
 *  1. Meta concluída/pausada/arquivada não é avaliada quanto ao ritmo.
 *  2. Sem valor-alvo → 'no_target' (não classificamos risco por inferência).
 *  3. Valor-alvo atingido → 'on_track'.
 *  4. Prazo encerrado sem atingir o alvo → 'overdue' (convite a ajustar, sem julgamento).
 *  5. Poucos dados (meta ainda não começou, ou < 7 dias e < 25% do prazo) → 'insufficient'.
 *  6. Caso contrário: 'on_track' se progresso ≥ tempo decorrido − 15 pontos; senão 'at_risk'.
 */
export function evaluateGoal(goal: Goal, today: CivilDate): GoalEvaluation {
  const progress = progressPercent(goal.currentValue, goal.targetValue);
  const rawProgress = rawProgressPercent(goal.currentValue, goal.targetValue);
  const elapsed = elapsedPercent(goal.startDate, goal.targetDate, today);
  const reachedTarget = rawProgress !== null && rawProgress >= 100;
  const base = { progress, rawProgress, elapsed, reachedTarget };

  if (goal.status === 'completed') return { ...base, status: 'completed', pace: null, reason: 'Meta concluída.' };
  if (goal.status === 'paused') return { ...base, status: 'paused', pace: null, reason: 'Meta pausada: não entra na avaliação de ritmo.' };
  if (goal.status === 'archived') return { ...base, status: 'archived', pace: null, reason: 'Meta arquivada.' };

  const pace = (state: PaceState, reason: string): GoalEvaluation => ({ ...base, status: state, pace: state, reason });

  if (progress === null) {
    return pace('no_target', 'Sem valor-alvo: não há como calcular o ritmo. Você ainda pode registrar check-ins.');
  }
  if (reachedTarget) return pace('on_track', 'Valor-alvo atingido.');
  if (diffDays(goal.targetDate, today) > 0) {
    return pace('overdue', 'O prazo terminou antes de atingir o valor-alvo. Você pode ajustar a data ou concluir a meta.');
  }
  const elapsedDays = diffDays(goal.startDate, today);
  if (elapsedDays < 1 || (elapsedDays < MIN_ELAPSED_DAYS_FOR_PACE && elapsed < MIN_ELAPSED_PERCENT_FOR_PACE)) {
    return pace('insufficient', 'Ainda há poucos dados para avaliar o ritmo.');
  }
  const detail = `Progresso ${Math.round(progress)}% × tempo decorrido ${Math.round(elapsed)}% (tolerância de ${PACE_TOLERANCE_POINTS} pontos).`;
  return progress >= elapsed - PACE_TOLERANCE_POINTS
    ? pace('on_track', detail)
    : pace('at_risk', detail);
}

export const STATUS_LABELS: Record<GoalDisplayStatus, string> = {
  completed: 'Meta alcançada',
  paused: 'Pausada',
  archived: 'Arquivada',
  on_track: 'No ritmo',
  at_risk: 'Em risco',
  insufficient: 'Poucos dados',
  no_target: 'Sem valor-alvo',
  overdue: 'Prazo encerrado',
};
