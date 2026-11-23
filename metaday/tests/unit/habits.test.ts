import { describe, expect, it } from 'vitest';
import { computeConsistency, computeStreak, isScheduled, recurrenceLabel } from '@/domain/habits.ts';
import type { Habit, HabitEntry } from '@/domain/types.ts';

// 2026-11-23 é segunda-feira.
const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h',
  title: 'Treinar',
  icon: 'dumbbell',
  recurrence: { type: 'weekly', days: [1, 3, 5] }, // seg, qua, sex
  status: 'active',
  goalIds: [],
  startDate: '2026-10-01',
  pauses: [],
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});
const entries = (...dates: string[]): HabitEntry[] =>
  dates.map((d) => ({ id: `h:${d}`, habitId: 'h', localDate: d, completed: true, createdAt: d }));

describe('hábitos — dias programados', () => {
  it('só marca os dias da recorrência, a partir da data de início', () => {
    const h = habit();
    expect(isScheduled(h, '2026-11-23')).toBe(true); // segunda
    expect(isScheduled(h, '2026-11-24')).toBe(false); // terça
    expect(isScheduled(h, '2026-09-30')).toBe(false); // antes do início
  });

  it('dias em pausa não são oportunidades', () => {
    const h = habit({ pauses: [{ from: '2026-11-10', to: '2026-11-20' }] });
    expect(isScheduled(h, '2026-11-11')).toBe(false); // quarta, em pausa
    expect(isScheduled(h, '2026-11-23')).toBe(true);
    const open = habit({ pauses: [{ from: '2026-11-10', to: null }] });
    expect(isScheduled(open, '2026-11-23')).toBe(false);
  });

  it('rótulos de recorrência', () => {
    expect(recurrenceLabel([0, 1, 2, 3, 4, 5, 6])).toBe('Todos os dias');
    expect(recurrenceLabel([1, 2, 3, 4, 5])).toBe('Dias úteis');
    expect(recurrenceLabel([0, 6])).toBe('Fins de semana');
    expect(recurrenceLabel([1, 3])).toBe('seg, qua');
  });
});

describe('hábitos — sequência (streak)', () => {
  it('conta dias programados consecutivos; dias não programados não quebram', () => {
    // sex 20, qua 18, seg 16 cumpridos; ter/qui/sáb/dom não programados
    const e = entries('2026-11-20', '2026-11-18', '2026-11-16');
    expect(computeStreak(habit(), e, '2026-11-22')).toBe(3);
  });

  it('uma falta em dia programado quebra a sequência', () => {
    const e = entries('2026-11-20', '2026-11-16'); // faltou quarta 18
    expect(computeStreak(habit(), e, '2026-11-22')).toBe(1);
  });

  it('hoje ainda não cumprido NÃO quebra a sequência', () => {
    const e = entries('2026-11-20', '2026-11-18');
    expect(computeStreak(habit(), e, '2026-11-23')).toBe(2); // hoje (segunda) pendente
    expect(computeStreak(habit(), [...e, ...entries('2026-11-23')], '2026-11-23')).toBe(3);
  });

  it('pausa não penaliza: dias pausados são ignorados', () => {
    const h = habit({ pauses: [{ from: '2026-11-17', to: '2026-11-19' }] }); // pausa cobre qua 18
    const e = entries('2026-11-20', '2026-11-16');
    expect(computeStreak(h, e, '2026-11-22')).toBe(2);
  });

  it('sem registros = 0', () => {
    expect(computeStreak(habit(), [], '2026-11-23')).toBe(0);
  });
});

describe('hábitos — constância', () => {
  it('cumpridos ÷ oportunidades programadas (exclui dias não programados)', () => {
    // Janela de 14 dias até sáb 21/11: oportunidades = seg/qua/sex entre 08/11 e 21/11 = 6
    const e = entries('2026-11-09', '2026-11-11', '2026-11-13'); // 3 de 6
    const c = computeConsistency(habit(), e, '2026-11-21', 14);
    expect(c.scheduled).toBe(6);
    expect(c.done).toBe(3);
    expect(c.percent).toBe(50);
  });

  it('o dia de hoje só entra no cálculo se já foi cumprido', () => {
    const pending = computeConsistency(habit(), [], '2026-11-23', 7); // hoje (seg) pendente
    const done = computeConsistency(habit(), entries('2026-11-23'), '2026-11-23', 7);
    expect(done.scheduled).toBe(pending.scheduled + 1);
    expect(done.done).toBe(1);
  });

  it('sem oportunidades na janela → percentual nulo (não 0%)', () => {
    const h = habit({ startDate: '2026-11-24' });
    expect(computeConsistency(h, [], '2026-11-23').percent).toBeNull();
  });

  it('a janela não conta dias anteriores ao início do hábito', () => {
    const h = habit({ startDate: '2026-11-16' });
    const c = computeConsistency(h, entries('2026-11-16', '2026-11-18', '2026-11-20'), '2026-11-22');
    expect(c.scheduled).toBe(3);
    expect(c.percent).toBe(100);
  });
});
