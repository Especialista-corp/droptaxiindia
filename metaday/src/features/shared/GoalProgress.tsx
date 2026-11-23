import { ProgressBar } from '@/components/ui/progress.tsx';
import { formatProgressText } from '@/domain/format.ts';
import type { GoalEvaluation } from '@/domain/progress.ts';
import type { Goal } from '@/domain/types.ts';
import { cn } from '@/lib/utils.ts';

/**
 * Duas dimensões SEPARADAS (decisão 37): progresso da meta (valor realizado ÷ alvo)
 * e tempo decorrido (início → data-alvo). Nunca são combinadas numa única barra.
 */
export function GoalProgress({
  goal,
  evaluation,
  compact,
  className,
}: {
  goal: Goal;
  evaluation: GoalEvaluation;
  compact?: boolean;
  className?: string;
}) {
  const { progress, rawProgress, elapsed } = evaluation;
  const progressText =
    progress === null
      ? goal.currentValue > 0
        ? `${formatProgressText(goal.currentValue, undefined, goal.unit)} registrados · sem valor-alvo`
        : 'Sem valor-alvo definido'
      : `${formatProgressText(goal.currentValue, goal.targetValue, goal.unit)} · ${Math.round(rawProgress ?? progress)}%`;

  return (
    <div className={cn('flex flex-col', compact ? 'gap-2' : 'gap-3.5', className)}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold text-foreground">Progresso da meta</span>
          <span className="tabular text-right text-muted" data-testid="goal-progress-text">
            {progressText}
          </span>
        </div>
        <ProgressBar value={progress} label="Progresso da meta" valueText={progressText} />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold text-foreground">Tempo decorrido</span>
          <span className="tabular text-muted" data-testid="goal-elapsed-text">
            {Math.round(elapsed)}% do prazo
          </span>
        </div>
        <ProgressBar value={elapsed} label="Tempo decorrido" tone="muted" valueText={`${Math.round(elapsed)}% do prazo`} />
      </div>
    </div>
  );
}
