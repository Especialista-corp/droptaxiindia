import { Ellipsis, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card.tsx';
import { Sheet } from '@/components/ui/sheet.tsx';
import { describeCountdown, getCountdown } from '@/domain/countdown.ts';
import { formatCivilPt } from '@/domain/dates.ts';
import type { GoalEvaluation } from '@/domain/progress.ts';
import type { Goal } from '@/domain/types.ts';
import { GoalActionList } from './GoalActions.tsx';
import { GoalProgress } from './GoalProgress.tsx';
import { StatusBadge } from './StatusBadge.tsx';

export function GoalCard({ goal, evaluation, now, tz }: { goal: Goal; evaluation: GoalEvaluation; now: Date; tz: string }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const countdown = getCountdown(goal.targetDate, now, tz);
  const completed = goal.status === 'completed';

  return (
    <Card className="flex flex-col gap-3" data-testid="goal-card">
      <div className="flex items-start gap-2">
        <Link to={`/metas/${goal.id}`} className="min-w-0 flex-1 rounded-lg">
          <h3 className="flex items-center gap-1.5 text-base font-bold leading-snug text-foreground">
            {goal.isPrimary && <Star className="size-4 shrink-0 fill-accent text-accent" aria-label="Objetivo principal" />}
            <span className="break-words">{goal.title}</span>
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {goal.category ? `${goal.category} · ` : ''}
            {completed ? 'Prazo original' : 'Data-alvo'}: {formatCivilPt(goal.targetDate)}
          </p>
        </Link>
        <button
          type="button"
          onClick={() => setActionsOpen(true)}
          aria-label={`Ações para ${goal.title}`}
          className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-card-2 hover:text-foreground"
        >
          <Ellipsis className="size-5" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={evaluation.status} suspended={goal.suspendedByPlan} />
        {goal.status === 'active' && (
          <span className="tabular text-sm font-semibold text-accent">{describeCountdown(countdown)}</span>
        )}
      </div>

      {goal.status !== 'archived' && <GoalProgress goal={goal} evaluation={evaluation} compact />}

      <Sheet open={actionsOpen} onOpenChange={setActionsOpen} title={goal.title} description="Escolha uma ação para este objetivo.">
        <GoalActionList goal={goal} onDone={() => setActionsOpen(false)} />
      </Sheet>
    </Card>
  );
}
