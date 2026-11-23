import { Check, ChevronLeft, ChevronRight, Flame, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActions, useAppModel, type AppModel } from '@/app/model.ts';
import { notifyError } from '@/app/notify.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card } from '@/components/ui/card.tsx';
import { EmptyState, PageHeader } from '@/components/ui/page.tsx';
import { addDays, formatCivilLongPt, formatCivilShortPt, parseCivil, startOfWeek, WEEKDAY_LABELS_SHORT, weekdayOf } from '@/domain/dates.ts';
import { computeConsistency, computeStreak, isScheduled, recurrenceLabel } from '@/domain/habits.ts';
import type { CivilDate, Habit } from '@/domain/types.ts';
import { cn } from '@/lib/utils.ts';
import { HABIT_ICON_COMPONENTS } from './habitIcons.ts';

export function HabitsPage() {
  const model = useAppModel();
  const [weekOffset, setWeekOffset] = useState(0);
  if (!model) return <p role="status" className="text-sm text-muted">Carregando…</p>;

  const { habits } = model.snapshot;
  const current = habits.filter((h) => h.status !== 'archived');
  const archived = habits.filter((h) => h.status === 'archived');

  const weekStart = addDays(startOfWeek(model.today, model.snapshot.settings.weekStartsOn), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Hábitos"
        subtitle="Marque os dias em que você cumpriu. Dias sem programação não contam como falta."
        action={
          <Button asChild>
            <Link to="/habitos/novo">
              <Plus className="size-4" aria-hidden /> Novo
            </Link>
          </Button>
        }
      />

      {current.length === 0 ? (
        <EmptyState title="Crie seu primeiro hábito">
          <p className="max-w-xs">Hábitos são ações recorrentes que sustentam seus objetivos — e podem ser vinculados a eles.</p>
          <Button asChild>
            <Link to="/habitos/novo">Criar hábito</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2" role="group" aria-label="Navegar entre semanas">
            <Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setWeekOffset((w) => w - 1)}>
              <ChevronLeft className="size-5" aria-hidden />
            </Button>
            <p className="tabular text-center text-sm font-semibold text-foreground" aria-live="polite">
              {weekOffset === 0 ? 'Esta semana' : `${formatCivilShortPt(days[0]!)} – ${formatCivilShortPt(days[6]!)}`}
            </p>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próxima semana"
              disabled={weekOffset >= 0}
              onClick={() => setWeekOffset((w) => Math.min(0, w + 1))}
            >
              <ChevronRight className="size-5" aria-hidden />
            </Button>
          </div>

          <ul className="flex flex-col gap-3" aria-label="Lista de hábitos">
            {current.map((habit) => (
              <li key={habit.id}>
                <HabitRow habit={habit} days={days} model={model} />
              </li>
            ))}
          </ul>
        </>
      )}

      {archived.length > 0 && (
        <details className="rounded-2xl border border-border bg-card px-4 py-3">
          <summary className="min-h-8 text-sm font-semibold text-muted">Arquivados ({archived.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {archived.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 break-words">{h.title}</span>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/habitos/${h.id}/editar`}>Gerenciar</Link>
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function HabitRow({ habit, days, model }: { habit: Habit; days: CivilDate[]; model: AppModel }) {
  const actions = useActions();
  const { habitEntries } = model.snapshot;
  const Icon = HABIT_ICON_COMPONENTS[habit.icon];
  const done = new Set(habitEntries.filter((e) => e.habitId === habit.id && e.completed).map((e) => e.localDate));
  const streak = computeStreak(habit, habitEntries, model.today);
  const consistency = computeConsistency(habit, habitEntries, model.today);
  const paused = habit.status === 'paused';
  const linked = model.goals.filter((g) => habit.goalIds.includes(g.id));

  const toggle = async (date: CivilDate) => {
    try {
      await actions.setHabitEntry(habit.id, date, !done.has(date));
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <Card className="flex flex-col gap-3" data-testid="habit-row">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-accent">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-bold leading-snug">{habit.title}</h3>
          <p className="text-xs text-muted">
            {recurrenceLabel(habit.recurrence.days)}
            {linked.length > 0 && ` · ${linked.map((g) => g.title).join(', ')}`}
          </p>
        </div>
        <Link
          to={`/habitos/${habit.id}/editar`}
          aria-label={`Editar hábito ${habit.title}`}
          className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-card-2 hover:text-foreground"
        >
          <Pencil className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {paused && <Badge tone="neutral">Pausado</Badge>}
        <Badge tone={streak > 0 ? 'accent' : 'neutral'} data-testid="streak">
          <Flame className="size-3.5" aria-hidden />
          Sequência: {streak}
        </Badge>
        <span className="tabular text-xs text-muted" data-testid="consistency">
          {consistency.percent === null
            ? 'Constância (30 dias): sem dias programados'
            : `Constância (30 dias): ${Math.round(consistency.percent)}% (${consistency.done}/${consistency.scheduled})`}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={`Semana de ${habit.title}`}>
        {days.map((date) => {
          const isDone = done.has(date);
          const scheduled = isScheduled(habit, date);
          const future = date > model.today;
          const isToday = date === model.today;
          const disabled = !scheduled || future || habit.status !== 'active';
          const weekday = WEEKDAY_LABELS_SHORT[weekdayOf(date)]!;
          const label = !scheduled
            ? `${habit.title}: sem programação em ${formatCivilLongPt(date)}`
            : future
              ? `${habit.title}: ${formatCivilLongPt(date)} ainda não chegou`
              : `${isDone ? 'Desmarcar' : 'Marcar'} ${habit.title} em ${formatCivilLongPt(date)}`;
          return (
            <div key={date} className="flex flex-col items-center gap-1">
              <span className={cn('text-[11px] font-semibold', isToday ? 'text-accent' : 'text-dim')}>{weekday}</span>
              <button
                type="button"
                aria-label={label}
                aria-pressed={scheduled ? isDone : undefined}
                disabled={disabled}
                onClick={() => void toggle(date)}
                data-date={date}
                data-state={isDone ? 'done' : scheduled ? 'pending' : 'off'}
                className={cn(
                  'tabular grid min-h-11 w-full place-items-center rounded-xl border text-sm font-semibold transition-colors',
                  isDone && 'border-accent bg-accent text-accent-foreground',
                  !isDone && scheduled && !future && 'border-border-strong bg-background text-foreground hover:border-accent',
                  !isDone && scheduled && future && 'border-border bg-background text-dim',
                  !scheduled && 'border-dashed border-border bg-transparent text-dim opacity-60',
                  isToday && !isDone && 'ring-1 ring-accent/60',
                )}
              >
                {isDone ? <Check className="size-5" aria-hidden /> : parseCivil(date).d}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
