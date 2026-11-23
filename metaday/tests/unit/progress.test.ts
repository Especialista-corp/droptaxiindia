import { describe, expect, it } from 'vitest';
import { elapsedPercent, evaluateGoal, progressPercent, rawProgressPercent } from '@/domain/progress.ts';
import type { Goal } from '@/domain/types.ts';

const base: Goal = {
  id: 'g',
  title: 'Meta',
  startDate: '2026-01-01',
  targetDate: '2026-01-11',
  currentValue: 0,
  frequency: 'weekly',
  priority: 'medium',
  status: 'active',
  isPrimary: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const goal = (over: Partial<Goal>): Goal => ({ ...base, ...over });

describe('progresso da meta', () => {
  it('limita a 0–100% sem descartar o valor realizado', () => {
    expect(progressPercent(50, 100)).toBe(50);
    expect(progressPercent(150, 100)).toBe(100);
    expect(rawProgressPercent(150, 100)).toBe(150);
    expect(progressPercent(-5, 100)).toBe(0);
  });
  it('sem valor-alvo (ou ≤ 0) é indeterminado', () => {
    expect(progressPercent(10, undefined)).toBeNull();
    expect(progressPercent(10, 0)).toBeNull();
  });
});

describe('tempo decorrido (separado do progresso)', () => {
  it('calcula em datas civis e limita a 0–100%', () => {
    expect(elapsedPercent('2026-01-01', '2026-01-11', '2026-01-06')).toBe(50);
    expect(elapsedPercent('2026-01-01', '2026-01-11', '2025-12-01')).toBe(0);
    expect(elapsedPercent('2026-01-01', '2026-01-11', '2027-01-01')).toBe(100);
  });
  it('meta de um único dia não divide por zero', () => {
    expect(elapsedPercent('2026-01-01', '2026-01-01', '2026-01-01')).toBe(100);
    expect(elapsedPercent('2026-01-02', '2026-01-02', '2026-01-01')).toBe(0);
  });
});

describe('ritmo — critérios explícitos e não punitivos', () => {
  const g = goal({ targetValue: 100, startDate: '2026-01-01', targetDate: '2026-02-10' }); // 40 dias

  it('concluída: status principal é "Meta alcançada", mesmo com prazo futuro', () => {
    const e = evaluateGoal(goal({ status: 'completed', targetValue: 10, currentValue: 10, targetDate: '2030-01-01' }), '2026-01-05');
    expect(e.status).toBe('completed');
    expect(e.pace).toBeNull();
  });

  it('sem valor-alvo não é classificada como risco', () => {
    expect(evaluateGoal(goal({ targetValue: undefined }), '2026-01-20').status).toBe('no_target');
  });

  it('poucos dados: ainda não começou ou < 7 dias e < 25% do prazo', () => {
    expect(evaluateGoal(g, '2025-12-30').status).toBe('insufficient'); // ainda não começou
    expect(evaluateGoal(g, '2026-01-01').status).toBe('insufficient'); // dia 0
    expect(evaluateGoal(g, '2026-01-05').status).toBe('insufficient'); // 4 dias (10%)
  });

  it('avalia a partir de 7 dias OU 25% do prazo', () => {
    expect(evaluateGoal(g, '2026-01-08').status).not.toBe('insufficient'); // 7 dias
    const short = goal({ targetValue: 10, startDate: '2026-01-01', targetDate: '2026-01-05' }); // 4 dias de prazo
    expect(evaluateGoal(short, '2026-01-03').status).not.toBe('insufficient'); // 50% do prazo
  });

  it('no ritmo quando progresso ≥ tempo decorrido − 15 pontos', () => {
    // dia 20 de 40 = 50% decorrido; 35% de progresso está exatamente no limite
    expect(evaluateGoal({ ...g, currentValue: 35 }, '2026-01-21').status).toBe('on_track');
    expect(evaluateGoal({ ...g, currentValue: 34 }, '2026-01-21').status).toBe('at_risk');
  });

  it('prazo encerrado sem atingir o alvo → "overdue" (sem julgamento)', () => {
    const e = evaluateGoal({ ...g, currentValue: 10 }, '2026-03-01');
    expect(e.status).toBe('overdue');
    expect(e.reason).toMatch(/ajustar a data/i);
  });

  it('valor-alvo atingido conta como no ritmo, mesmo após o prazo', () => {
    expect(evaluateGoal({ ...g, currentValue: 120 }, '2026-03-01').status).toBe('on_track');
    expect(evaluateGoal({ ...g, currentValue: 120 }, '2026-03-01').reachedTarget).toBe(true);
  });

  it('pausada e arquivada não entram na avaliação de ritmo', () => {
    expect(evaluateGoal({ ...g, status: 'paused' }, '2026-01-21').pace).toBeNull();
    expect(evaluateGoal({ ...g, status: 'archived' }, '2026-01-21').status).toBe('archived');
  });
});
