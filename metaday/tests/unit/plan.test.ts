import { describe, expect, it } from 'vitest';
import {
  activeGoalLimit,
  canActivateAnotherGoal,
  countActiveGoals,
  FREE_ACTIVE_GOAL_LIMIT,
  slotsLeft,
} from '@/domain/plan.ts';

const goals = (...statuses: Array<'active' | 'paused' | 'completed' | 'archived'>) => statuses.map((status) => ({ status }));

describe('regras de plano (3 ativos no FREE, ilimitado no Premium)', () => {
  it('limites', () => {
    expect(FREE_ACTIVE_GOAL_LIMIT).toBe(3);
    expect(activeGoalLimit('free')).toBe(3);
    expect(activeGoalLimit('premium')).toBe(Infinity);
  });

  it('FREE: a quarta meta ativa é bloqueada', () => {
    expect(canActivateAnotherGoal('free', goals('active', 'active'))).toBe(true);
    expect(canActivateAnotherGoal('free', goals('active', 'active', 'active'))).toBe(false);
  });

  it('Premium: sem limite', () => {
    expect(canActivateAnotherGoal('premium', goals(...Array(50).fill('active')))).toBe(true);
    expect(slotsLeft('premium', goals('active'))).toBe(Infinity);
  });

  it('concluídas, arquivadas e pausadas não ocupam vaga', () => {
    const g = goals('active', 'completed', 'archived', 'paused', 'archived');
    expect(countActiveGoals(g)).toBe(1);
    expect(slotsLeft('free', g)).toBe(2);
    expect(canActivateAnotherGoal('free', goals('active', 'active', 'completed', 'archived'))).toBe(true);
  });
});
