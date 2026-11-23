import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppModel } from '@/app/model.ts';
import { Button } from '@/components/ui/button.tsx';
import { Card, SectionTitle } from '@/components/ui/card.tsx';
import { PageHeader } from '@/components/ui/page.tsx';
import { buildMarkerIndex, monthGrid, type DayMarkers } from '@/domain/calendar.ts';
import {
  addMonths,
  formatCivilLongPt,
  formatMonthPt,
  orderedWeekdays,
  parseCivil,
  startOfMonth,
  WEEKDAY_LABELS_LONG,
  WEEKDAY_LABELS_SHORT,
} from '@/domain/dates.ts';
import { formatQuantity } from '@/domain/format.ts';
import { isScheduled } from '@/domain/habits.ts';
import type { CivilDate } from '@/domain/types.ts';
import { cn } from '@/lib/utils.ts';

function describeMarkers(m: DayMarkers): string {
  const parts: string[] = [];
  if (m.checkIns.length) parts.push(`${m.checkIns.length} ${m.checkIns.length === 1 ? 'check-in' : 'check-ins'}`);
  if (m.habitEntries.length) parts.push(`${m.habitEntries.length} ${m.habitEntries.length === 1 ? 'hábito cumprido' : 'hábitos cumpridos'}`);
  if (m.deadlines.length) parts.push(`${m.deadlines.length} ${m.deadlines.length === 1 ? 'prazo' : 'prazos'}`);
  return parts.length ? parts.join(', ') : 'sem registros';
}

export function CalendarPage() {
  const model = useAppModel();
  const [month, setMonth] = useState<CivilDate | null>(null);
  const [selected, setSelected] = useState<CivilDate | null>(null);

  const snapshot = model?.snapshot;
  const markerOf = useMemo(
    () =>
      snapshot
        ? buildMarkerIndex({ goals: snapshot.goals, habits: snapshot.habits, habitEntries: snapshot.habitEntries, checkIns: snapshot.checkIns })
        : null,
    [snapshot],
  );
  if (!model || !markerOf) return <p role="status" className="text-sm text-muted">Carregando…</p>;

  const shownMonth = month ?? startOfMonth(model.today);
  const selectedDay = selected ?? model.today;
  const weekStartsOn = model.snapshot.settings.weekStartsOn;
  const grid = monthGrid(shownMonth, weekStartsOn);
  const detail = markerOf(selectedDay);
  const goalById = new Map(model.goals.map((g) => [g.id, g]));
  const habitById = new Map(model.snapshot.habits.map((h) => [h.id, h]));
  const scheduledHabits = model.snapshot.habits.filter((h) => h.status === 'active' && isScheduled(h, selectedDay));
  const doneHabitIds = new Set(detail.habitEntries.map((e) => e.habitId));
  const canCheckIn = selectedDay <= model.today && model.activeGoals.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Calendário" />

      <Card className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => setMonth(addMonths(shownMonth, -1))}>
            <ChevronLeft className="size-5" aria-hidden />
          </Button>
          <h2 className="text-base font-bold" aria-live="polite" data-testid="calendar-month">
            {formatMonthPt(shownMonth)}
          </h2>
          <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => setMonth(addMonths(shownMonth, 1))}>
            <ChevronRight className="size-5" aria-hidden />
          </Button>
        </div>

        <div role="grid" aria-label={`Calendário de ${formatMonthPt(shownMonth)}`} className="flex flex-col gap-1">
          <div role="row" className="grid grid-cols-7 gap-1">
            {orderedWeekdays(weekStartsOn).map((d) => (
              <div key={d} role="columnheader" aria-label={WEEKDAY_LABELS_LONG[d]} className="py-1 text-center text-[11px] font-semibold text-dim">
                {WEEKDAY_LABELS_SHORT[d]}
              </div>
            ))}
          </div>
          {grid.map((week, wi) => (
            <div role="row" key={wi} className="grid grid-cols-7 gap-1">
              {week.map((cell) => {
                const m = markerOf(cell.date);
                const isToday = cell.date === model.today;
                const isSelected = cell.date === selectedDay;
                return (
                  <div role="gridcell" key={cell.date} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelected(cell.date)}
                      aria-pressed={isSelected}
                      aria-label={`${formatCivilLongPt(cell.date)}: ${describeMarkers(m)}`}
                      aria-current={isToday ? 'date' : undefined}
                      data-date={cell.date}
                      className={cn(
                        'tabular flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl border text-sm font-semibold transition-colors',
                        cell.inMonth ? 'text-foreground' : 'text-dim opacity-50',
                        isSelected ? 'border-accent bg-accent/15' : 'border-transparent hover:bg-card-2',
                        isToday && !isSelected && 'border-border-strong',
                      )}
                    >
                      <span className={cn(isToday && 'text-accent')}>{parseCivil(cell.date).d}</span>
                      <span className="flex h-2.5 items-center gap-0.5" aria-hidden>
                        {m.checkIns.length > 0 && <span data-marker="checkin" className="size-1.5 rounded-full bg-accent" />}
                        {m.habitEntries.length > 0 && <span data-marker="habit" className="size-1.5 rounded-[2px] bg-ok" />}
                        {m.deadlines.length > 0 && <Flag data-marker="deadline" className="size-2.5 fill-foreground text-foreground" />}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted" aria-label="Legenda">
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent" aria-hidden /> Check-in
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px] bg-ok" aria-hidden /> Hábito cumprido
          </li>
          <li className="flex items-center gap-1.5">
            <Flag className="size-3 fill-foreground text-foreground" aria-hidden /> Prazo
          </li>
        </ul>
      </Card>

      <section aria-labelledby="dia-detalhe" className="flex flex-col gap-3" data-testid="day-detail">
        <SectionTitle id="dia-detalhe">{formatCivilLongPt(selectedDay)}</SectionTitle>

        {detail.deadlines.length > 0 && (
          <Card className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase text-muted">Prazos</p>
            {detail.deadlines.map((g) => (
              <Link key={g.id} to={`/metas/${g.id}`} className="flex items-center gap-2 text-sm font-semibold">
                <Flag className="size-4 shrink-0 fill-foreground" aria-hidden />
                <span className="break-words">{g.title}</span>
              </Link>
            ))}
          </Card>
        )}

        <Card className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase text-muted">Check-ins</p>
          {detail.checkIns.length === 0 ? (
            <p className="text-sm text-muted">Nenhum check-in neste dia.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {detail.checkIns.map((c) => {
                const goal = goalById.get(c.goalId);
                return (
                  <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="min-w-0 break-words font-medium">
                      {goal?.title ?? 'Objetivo removido'}
                      {c.notes && <span className="block text-xs font-normal text-muted">{c.notes}</span>}
                    </span>
                    <span className="tabular shrink-0 font-semibold text-accent">
                      {c.quantity !== undefined ? formatQuantity(c.quantity, goal?.unit) : 'Registrado'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {canCheckIn && (
            <Button variant="secondary" size="sm" className="self-start" asChild>
              <Link to={`/checkin?data=${selectedDay}`}>Registrar check-in neste dia</Link>
            </Button>
          )}
        </Card>

        <Card className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase text-muted">Hábitos</p>
          {scheduledHabits.length === 0 && detail.habitEntries.length === 0 ? (
            <p className="text-sm text-muted">Nenhum hábito programado neste dia.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {scheduledHabits.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 break-words">{h.title}</span>
                  <span className={cn('shrink-0 text-xs font-semibold', doneHabitIds.has(h.id) ? 'text-ok' : 'text-dim')}>
                    {doneHabitIds.has(h.id) ? 'Cumprido' : selectedDay > model.today ? 'Programado' : 'Não registrado'}
                  </span>
                </li>
              ))}
              {detail.habitEntries
                .filter((e) => !scheduledHabits.some((h) => h.id === e.habitId))
                .map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 break-words">{habitById.get(e.habitId)?.title ?? 'Hábito'}</span>
                    <span className="shrink-0 text-xs font-semibold text-ok">Cumprido</span>
                  </li>
                ))}
            </ul>
          )}
          <Button variant="ghost" size="sm" className="self-start" asChild>
            <Link to="/habitos">Ir para Hábitos</Link>
          </Button>
        </Card>
      </section>
    </div>
  );
}
