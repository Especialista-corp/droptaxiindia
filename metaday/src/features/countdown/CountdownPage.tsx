import { Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNow } from '@/app/clock.tsx';
import { useAppModel } from '@/app/model.ts';
import { Button } from '@/components/ui/button.tsx';
import { Card } from '@/components/ui/card.tsx';
import { EmptyState, PageHeader } from '@/components/ui/page.tsx';
import { describeCountdown, getCountdown } from '@/domain/countdown.ts';
import { formatCivilPt } from '@/domain/dates.ts';
import type { Goal } from '@/domain/types.ts';
import { CountdownTiles } from '@/features/shared/CountdownTiles.tsx';
import { GoalProgress } from '@/features/shared/GoalProgress.tsx';
import { StatusBadge } from '@/features/shared/StatusBadge.tsx';

export function CountdownPage() {
  const model = useAppModel();
  const now = useNow(1000);
  if (!model) return <p role="status" className="text-sm text-muted">Carregando…</p>;

  const goals = model.goals
    .filter((g) => g.status !== 'archived')
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.targetDate.localeCompare(b.targetDate));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Contagem regressiva"
        subtitle={`A data-alvo conta: o prazo termina às 23:59:59 do dia-alvo (fuso: ${model.tz}).`}
      />
      {goals.length === 0 ? (
        <EmptyState title="Nenhum objetivo para contar">
          <Button asChild>
            <Link to="/metas/nova">Criar objetivo</Link>
          </Button>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Contagens regressivas">
          {goals.map((goal) => (
            <li key={goal.id}>
              <CountdownCard goal={goal} now={now} tz={model.tz} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CountdownCard({ goal, now, tz }: { goal: Goal; now: Date; tz: string }) {
  const model = useAppModel()!;
  const evaluation = model.evaluate(goal);
  const countdown = getCountdown(goal.targetDate, now, tz);
  const completed = goal.status === 'completed';

  return (
    <Card className="flex flex-col gap-4" data-testid="countdown-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="break-words text-base font-bold leading-snug">
            <Link to={`/metas/${goal.id}`} className="rounded">
              {goal.title}
            </Link>
          </h2>
          {/* Meta concluída: o prazo é informação SECUNDÁRIA. */}
          <p className="text-xs text-muted">
            {completed ? 'Prazo original' : 'Data-alvo'}: {formatCivilPt(goal.targetDate)}
          </p>
        </div>
        <StatusBadge status={evaluation.status} suspended={goal.suspendedByPlan} />
      </div>

      {completed ? (
        <div className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
          <Trophy className="size-6 shrink-0 text-accent" aria-hidden />
          <p className="text-lg font-bold text-accent">Meta alcançada</p>
        </div>
      ) : goal.status === 'paused' ? (
        <p className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted">
          {goal.suspendedByPlan ? 'Suspenso pelo plano Grátis. Pode ser reativado.' : 'Objetivo pausado: a contagem fica suspensa.'}
        </p>
      ) : countdown.state === 'past' ? (
        <p className="rounded-xl border border-risk/40 bg-risk/10 px-4 py-3 text-sm font-semibold text-risk">
          {describeCountdown(countdown)}. Você pode ajustar a data-alvo ou concluir o objetivo.
        </p>
      ) : (
        <>
          <CountdownTiles countdown={countdown} />
          <p className="tabular text-center text-sm font-semibold text-accent">{describeCountdown(countdown)}</p>
        </>
      )}

      <GoalProgress goal={goal} evaluation={evaluation} compact />
    </Card>
  );
}
