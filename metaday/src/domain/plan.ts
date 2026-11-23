/**
 * Regras de plano (decisão aprovada): FREE = até 3 objetivos ATIVOS;
 * PREMIUM = ilimitados. Um (1) objetivo principal em ambos.
 *
 * Só o status `active` ocupa vaga. Concluídos, arquivados e pausados (inclusive os
 * suspensos por downgrade) NÃO ocupam vaga; reativá-los exige vaga disponível.
 *
 * Estas funções são puras. A APLICAÇÃO da regra acontece na camada de dados
 * (transação do repositório) — a UI só antecipa a mensagem.
 */
import type { Goal, PlanId } from './types.ts';

export const FREE_ACTIVE_GOAL_LIMIT = 3;

export function activeGoalLimit(plan: PlanId): number {
  return plan === 'premium' ? Number.POSITIVE_INFINITY : FREE_ACTIVE_GOAL_LIMIT;
}

export function countActiveGoals(goals: readonly Pick<Goal, 'status'>[]): number {
  return goals.filter((g) => g.status === 'active').length;
}

export function canActivateAnotherGoal(plan: PlanId, goals: readonly Pick<Goal, 'status'>[]): boolean {
  return countActiveGoals(goals) < activeGoalLimit(plan);
}

export function slotsLeft(plan: PlanId, goals: readonly Pick<Goal, 'status'>[]): number {
  const limit = activeGoalLimit(plan);
  return limit === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Math.max(0, limit - countActiveGoals(goals));
}

export const PLAN_LABELS: Record<PlanId, string> = { free: 'Grátis', premium: 'Premium' };
