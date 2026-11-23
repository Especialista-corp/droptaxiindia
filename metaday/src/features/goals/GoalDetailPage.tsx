import { Link, useParams } from 'react-router-dom';
import { useNow } from '@/app/clock.tsx';
import { useAppModel } from '@/app/model.ts';
import { Button } from '@/components/ui/button.tsx';
import { Card, SectionTitle } from '@/components/ui/card.tsx';
import { EmptyState, PageHeader } from '@/components/ui/page.tsx';
import { describeCountdown, getCountdown } from '@/domain/countdown.ts';
import { formatCivilPt } from '@/domain/dates.ts';
import { FREQUENCY_LABELS, formatQuantity, MOOD_LABELS, PRIORITY_LABELS } from '@/domain/format.ts';
import { recurrenceLabel } from '@/domain/habits.ts';
import { GoalActionList } from '@/features/shared/GoalActions.tsx';
import { GoalProgress } from '@/features/shared/GoalProgress.tsx';
import { StatusBadge } from '@/features/shared/StatusBadge.tsx';

export function GoalDetailPage() {
  const { id } = useParams();
  const model = useAppModel();
  const now = useNow(30_000);
  if (!model) return <p role="status" className="text-sm text-muted">Carregando…</p>;

  const goal = model.goals.find((g) => g.id === id);
  if (!goal) {
    return (
      <EmptyState title="Objetivo não encontrado">
        <Button asChild>
          <Link to="/metas">Voltar para meus objetivos</Link>
        </Button>
      </EmptyState>
    );
  }

  const evaluation = model.evaluate(goal);
  const countdown = getCountdown(goal.targetDate, now, model.tz);
  const history = model.snapshot.checkIns
    .filter((c) => c.goalId === goal.id)
    .sort((a, b) => b.localDate.localeCompare(a.localDate) || b.createdAt.localeCompare(a.createdAt));
  const habits = model.snapshot.habits.filter((h) => h.goalIds.includes(goal.id) && h.status !== 'archived');

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={goal.title} back={{ to: '/metas', label: 'Meus objetivos' }} />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={evaluation.status} suspended={goal.suspendedByPlan} />
          {goal.isPrimary && <span className="text-xs font-semibold text-accent">★ Objetivo principal</span>}
        </div>
        {goal.description && <p className="whitespace-pre-line break-words text-sm text-muted">{goal.description}</p>}

        {goal.status === 'completed' ? (
          <p className="text-base font-semibold text-accent">Meta alcançada · prazo original {formatCivilPt(goal.targetDate)}</p>
        ) : goal.status === 'active' ? (
          <p className="tabular text-base font-semibold text-accent">{describeCountdown(countdown)}</p>
        ) : null}

        <GoalProgress goal={goal} evaluation={evaluation} />
        <p className="text-xs text-muted">
          <span className="font-semibold text-foreground">Como calculamos: </span>
          {evaluation.reason}
        </p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-sm">
          <Info label="Início" value={formatCivilPt(goal.startDate)} />
          <Info label="Data-alvo" value={formatCivilPt(goal.targetDate)} />
          <Info label="Frequência" value={FREQUENCY_LABELS[goal.frequency]} />
          <Info label="Prioridade" value={PRIORITY_LABELS[goal.priority]} />
          {goal.category && <Info label="Categoria" value={goal.category} />}
          {goal.targetValue !== undefined && <Info label="Valor-alvo" value={formatQuantity(goal.targetValue, goal.unit)} />}
        </dl>
      </Card>

      {goal.status === 'active' && (
        <Button size="lg" asChild>
          <Link to={`/checkin?meta=${goal.id}`}>Registrar check-in</Link>
        </Button>
      )}

      <section aria-labelledby="hist" className="flex flex-col gap-2">
        <SectionTitle id="hist">Check-ins recentes</SectionTitle>
        {history.length === 0 ? (
          <p className="text-sm text-muted">Nenhum check-in ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.slice(0, 8).map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{formatCivilPt(c.localDate)}</p>
                  {(c.mood || c.notes) && (
                    <p className="break-words text-xs text-muted">
                      {c.mood ? MOOD_LABELS[c.mood] : ''}
                      {c.mood && c.notes ? ' · ' : ''}
                      {c.notes}
                    </p>
                  )}
                </div>
                <span className="tabular shrink-0 font-semibold text-accent">
                  {c.quantity !== undefined ? formatQuantity(c.quantity, goal.unit) : 'Registrado'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {habits.length > 0 && (
        <section aria-labelledby="hab" className="flex flex-col gap-2">
          <SectionTitle id="hab">Hábitos vinculados</SectionTitle>
          <ul className="flex flex-col gap-2">
            {habits.map((h) => (
              <li key={h.id} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
                <span className="font-medium">{h.title}</span>
                <span className="ml-2 text-xs text-muted">{recurrenceLabel(h.recurrence.days)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="acoes" className="flex flex-col gap-2">
        <SectionTitle id="acoes">Ações</SectionTitle>
        <GoalActionList goal={goal} />
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="break-words font-medium text-foreground">{value}</dd>
    </div>
  );
}
