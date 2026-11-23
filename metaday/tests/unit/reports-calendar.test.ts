import { describe, expect, it } from 'vitest';
import { buildMarkerIndex, monthGrid } from '@/domain/calendar.ts';
import { activitySeries, buildReportSummary } from '@/domain/reports.ts';
import type { CheckIn, Goal, Habit, HabitEntry } from '@/domain/types.ts';

const ci = (id: string, localDate: string, goalId = 'g'): CheckIn => ({ id, goalId, localDate, createdAt: localDate });
const he = (habitId: string, localDate: string): HabitEntry => ({
  id: `${habitId}:${localDate}`,
  habitId,
  localDate,
  completed: true,
  createdAt: localDate,
});
const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g',
  title: 'Meta',
  startDate: '2026-11-01',
  targetDate: '2026-12-01',
  currentValue: 0,
  frequency: 'weekly',
  priority: 'medium',
  status: 'active',
  isPrimary: false,
  createdAt: '',
  updatedAt: '',
  ...over,
});
const habit: Habit = {
  id: 'h',
  title: 'H',
  icon: 'target',
  recurrence: { type: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] },
  status: 'active',
  goalIds: [],
  startDate: '2026-11-01',
  pauses: [],
  createdAt: '',
};

describe('relatórios — gráfico de 14 dias', () => {
  it('retorna 14 dias (do mais antigo a hoje) com contagens reais', () => {
    const s = activitySeries([ci('1', '2026-11-23'), ci('2', '2026-11-23'), ci('3', '2026-11-10')], [he('h', '2026-11-22')], '2026-11-23', 14);
    expect(s).toHaveLength(14);
    expect(s[0]!.date).toBe('2026-11-10');
    expect(s[13]!.date).toBe('2026-11-23');
    expect(s[13]!.checkIns).toBe(2);
    expect(s[12]!.habits).toBe(1);
    expect(s[0]!.checkIns).toBe(1);
    expect(s[13]!.total).toBe(2);
  });

  it('ignora registros fora da janela e zera quando não há registros', () => {
    const s = activitySeries([ci('1', '2026-10-01')], [], '2026-11-23', 14);
    expect(s.every((d) => d.total === 0)).toBe(true);
  });
});

describe('relatórios — resumo', () => {
  it('conta metas no ritmo/em risco e constância agregada', () => {
    const today = '2026-11-23';
    const onTrack = goal({ id: 'a', targetValue: 100, currentValue: 60, startDate: '2026-11-01', targetDate: '2026-12-01' });
    const atRisk = goal({ id: 'b', targetValue: 100, currentValue: 5, startDate: '2026-11-01', targetDate: '2026-12-01' });
    const done = goal({ id: 'c', status: 'completed' });
    const s = buildReportSummary({
      goals: [onTrack, atRisk, done],
      habits: [habit],
      habitEntries: [he('h', '2026-11-22'), he('h', '2026-11-21')],
      checkIns: [ci('1', '2026-11-22', 'a')],
      today,
    });
    expect(s.onTrack).toBe(1);
    expect(s.atRisk).toBe(1);
    expect(s.totalCheckIns).toBe(1);
    expect(s.consistencyPercent).not.toBeNull();
    expect(s.hasActivity).toBe(true);
  });

  it('sem hábitos/registros: constância nula e sem atividade', () => {
    const s = buildReportSummary({ goals: [], habits: [], habitEntries: [], checkIns: [], today: '2026-11-23' });
    expect(s.consistencyPercent).toBeNull();
    expect(s.hasActivity).toBe(false);
  });
});

describe('calendário', () => {
  it('grade mensal cobre o mês inteiro em semanas completas', () => {
    const grid = monthGrid('2026-11-15', 0);
    expect(grid.every((row) => row.length === 7)).toBe(true);
    expect(grid[0]![0]!.date).toBe('2026-11-01'); // 01/11/2026 é domingo
    const inMonth = grid.flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(30);
  });

  it('início da semana configurável (segunda)', () => {
    const grid = monthGrid('2026-11-15', 1);
    expect(grid[0]![0]!.date).toBe('2026-10-26'); // segunda anterior ao dia 1
    expect(grid[0]![0]!.inMonth).toBe(false);
  });

  it('fevereiro bissexto', () => {
    const inMonth = monthGrid('2028-02-10', 0).flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(29);
  });

  it('marcadores distintos: check-in, hábito e prazo (arquivadas não geram prazo)', () => {
    const markers = buildMarkerIndex({
      goals: [goal({ targetDate: '2026-11-30' }), goal({ id: 'z', status: 'archived', targetDate: '2026-11-30' })],
      habits: [habit],
      habitEntries: [he('h', '2026-11-23')],
      checkIns: [ci('1', '2026-11-23')],
    });
    const day = markers('2026-11-23');
    expect(day.checkIns).toHaveLength(1);
    expect(day.habitEntries).toHaveLength(1);
    expect(day.deadlines).toHaveLength(0);
    expect(markers('2026-11-30').deadlines).toHaveLength(1);
  });
});
