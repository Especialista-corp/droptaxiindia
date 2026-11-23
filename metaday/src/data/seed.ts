/**
 * Dados de DEMONSTRAÇÃO (fictícios), sempre relativos a "hoje" do usuário.
 * Ficam num banco separado (`metaday-demo`) e nunca se misturam com dados reais.
 */
import { addDays, detectTimeZone, toCivilDate } from '@/domain/dates.ts';
import { isScheduled } from '@/domain/habits.ts';
import type { CheckIn, CivilDate, Goal, Habit, HabitEntry, Mood, Snapshot } from '@/domain/types.ts';

export const DEMO_IDS = {
  goalRun: 'demo-goal-corrida',
  goalBooks: 'demo-goal-livros',
  goalSavings: 'demo-goal-reserva',
  goalCourse: 'demo-goal-curso',
  goalMove: 'demo-goal-mudanca',
} as const;

export function defaultSettings(timeZone = detectTimeZone()): Snapshot['settings'] {
  return { displayName: '', timezone: timeZone, weekStartsOn: 0, locale: 'pt-BR' };
}

export function defaultSubscription(nowIso: string): Snapshot['subscription'] {
  return { plan: 'free', status: 'active', providerRef: 'demo-local', updatedAt: nowIso };
}

export function emptySnapshot(now: Date, timeZone = detectTimeZone()): Snapshot {
  return {
    goals: [],
    habits: [],
    habitEntries: [],
    checkIns: [],
    subscription: defaultSubscription(now.toISOString()),
    settings: defaultSettings(timeZone),
  };
}

interface CheckInSeed {
  daysAgo: number;
  quantity?: number;
  mood?: Mood;
  notes?: string;
}

export function buildDemoSnapshot(now: Date, timeZone = detectTimeZone()): Snapshot {
  const today = toCivilDate(now, timeZone);
  const nowIso = now.toISOString();
  const at = (offset: number): CivilDate => addDays(today, offset);

  const checkIns: CheckIn[] = [];
  const addCheckIns = (goalId: string, seeds: CheckInSeed[]): number => {
    let total = 0;
    seeds.forEach((s, i) => {
      const localDate = at(-s.daysAgo);
      checkIns.push({
        id: `${goalId}-ci-${i + 1}`,
        goalId,
        localDate,
        quantity: s.quantity,
        mood: s.mood,
        notes: s.notes,
        createdAt: `${localDate}T12:00:00.000Z`,
      });
      total += s.quantity ?? 0;
    });
    return total;
  };

  const runKm = addCheckIns(
    DEMO_IDS.goalRun,
    [5, 4, 6, 3, 8, 5, 4, 6, 7, 5, 4, 6, 5, 6].map((q, i) => ({
      daysAgo: [1, 2, 4, 6, 7, 9, 11, 13, 16, 18, 20, 23, 26, 28][i] ?? i + 1,
      quantity: q,
      mood: (i % 4 === 0 ? 'great' : i % 3 === 0 ? 'neutral' : 'good') as Mood,
      notes: i === 0 ? 'Treino leve no parque.' : i === 4 ? 'Longão de domingo, me senti forte.' : undefined,
    })),
  );
  const books = addCheckIns(DEMO_IDS.goalBooks, [
    { daysAgo: 12, quantity: 1, notes: 'Terminei o primeiro livro do mês.' },
    { daysAgo: 40, quantity: 1 },
    { daysAgo: 75, quantity: 1 },
  ]);
  const savings = addCheckIns(DEMO_IDS.goalSavings, [
    { daysAgo: 5, quantity: 300 },
    { daysAgo: 19, quantity: 500 },
    { daysAgo: 33, quantity: 400 },
    { daysAgo: 48, quantity: 600 },
  ]);
  const course = addCheckIns(DEMO_IDS.goalCourse, [
    { daysAgo: 10, quantity: 8, mood: 'good' },
    { daysAgo: 6, quantity: 7, mood: 'great' },
    { daysAgo: 3, quantity: 5, mood: 'great', notes: 'Última aula concluída!' },
  ]);

  const base = {
    frequency: 'weekly' as const,
    priority: 'medium' as const,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const goals: Goal[] = [
    {
      ...base,
      id: DEMO_IDS.goalRun,
      title: 'Meia maratona',
      description: 'Treinar com constância para completar 21 km.',
      category: 'Saúde',
      startDate: at(-60),
      targetDate: at(90),
      targetValue: 150,
      currentValue: runKm,
      unit: 'km',
      frequency: 'weekly',
      priority: 'high',
      status: 'active',
      isPrimary: true,
    },
    {
      ...base,
      id: DEMO_IDS.goalBooks,
      title: 'Ler 12 livros',
      category: 'Estudos',
      startDate: at(-150),
      targetDate: at(120),
      targetValue: 12,
      currentValue: books,
      unit: 'livros',
      frequency: 'flexible',
      status: 'active',
      isPrimary: false,
    },
    {
      ...base,
      id: DEMO_IDS.goalSavings,
      title: 'Reserva de emergência',
      category: 'Finanças',
      startDate: at(-90),
      targetDate: at(210),
      targetValue: 5000,
      currentValue: savings,
      unit: 'R$',
      frequency: 'monthly',
      priority: 'high',
      status: 'active',
      isPrimary: false,
    },
    {
      ...base,
      id: DEMO_IDS.goalCourse,
      title: 'Concluir curso de Excel',
      category: 'Carreira',
      startDate: at(-30),
      targetDate: at(20), // prazo futuro, mas a meta já foi alcançada
      targetValue: 20,
      currentValue: course,
      unit: 'horas',
      status: 'completed',
      isPrimary: false,
      completedAt: `${at(-3)}T18:00:00.000Z`,
    },
    {
      ...base,
      id: DEMO_IDS.goalMove,
      title: 'Organizar a mudança',
      category: 'Pessoal',
      startDate: at(-120),
      targetDate: at(-45),
      currentValue: 0,
      status: 'archived',
      isPrimary: false,
    },
  ];

  const habitBase = { status: 'active' as const, pauses: [], createdAt: nowIso };
  const habits: Habit[] = [
    {
      ...habitBase,
      id: 'demo-habit-treino',
      title: 'Correr ou caminhar',
      icon: 'footprints',
      recurrence: { type: 'weekly', days: [1, 3, 5, 6] },
      goalIds: [DEMO_IDS.goalRun],
      startDate: at(-45),
    },
    {
      ...habitBase,
      id: 'demo-habit-leitura',
      title: 'Ler 20 páginas',
      icon: 'book',
      recurrence: { type: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] },
      goalIds: [DEMO_IDS.goalBooks],
      startDate: at(-40),
    },
    {
      ...habitBase,
      id: 'demo-habit-agua',
      title: 'Beber 2 L de água',
      icon: 'droplets',
      recurrence: { type: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] },
      goalIds: [],
      startDate: at(-30),
    },
    {
      ...habitBase,
      id: 'demo-habit-gastos',
      title: 'Revisar gastos',
      icon: 'wallet',
      recurrence: { type: 'weekly', days: [1, 2, 3, 4, 5] },
      goalIds: [DEMO_IDS.goalSavings],
      startDate: at(-30),
    },
  ];

  const habitEntries: HabitEntry[] = [];
  habits.forEach((habit, hIdx) => {
    for (let back = 40; back >= 0; back--) {
      const localDate = at(-back);
      if (!isScheduled(habit, localDate)) continue;
      // Padrão determinístico: cumpre a maioria dos dias; alguns dias ficam sem registro.
      const skipped = (back * 7 + hIdx * 3) % 5 === 0;
      // Hoje: só o hábito da água já foi cumprido (os demais ficam como "ainda dá tempo").
      if (back === 0 && habit.id !== 'demo-habit-agua') continue;
      if (skipped && back !== 0) continue;
      habitEntries.push({
        id: `${habit.id}:${localDate}`,
        habitId: habit.id,
        localDate,
        completed: true,
        createdAt: `${localDate}T20:00:00.000Z`,
      });
    }
  });

  return {
    goals,
    habits,
    habitEntries,
    checkIns,
    subscription: defaultSubscription(nowIso),
    settings: { ...defaultSettings(timeZone), displayName: 'Demonstração' },
  };
}
