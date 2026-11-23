import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNow } from '@/app/clock.tsx';
import { useAppModel } from '@/app/model.ts';
import { Button } from '@/components/ui/button.tsx';
import { Select } from '@/components/ui/field.tsx';
import { EmptyState, PageHeader } from '@/components/ui/page.tsx';
import type { GoalEvaluation } from '@/domain/progress.ts';
import type { Goal } from '@/domain/types.ts';
import { GoalCard } from '@/features/shared/GoalCard.tsx';
import { useUpgradePrompt } from '@/features/shared/UpgradeProvider.tsx';
import { cn } from '@/lib/utils.ts';

type FilterId = 'all' | 'on_track' | 'at_risk' | 'completed' | 'paused' | 'archived';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'on_track', label: 'No ritmo' },
  { id: 'at_risk', label: 'Em risco' },
  { id: 'completed', label: 'Concluídas' },
  { id: 'paused', label: 'Pausadas' },
  { id: 'archived', label: 'Arquivadas' },
];

/** "Em risco" inclui prazo encerrado sem alvo atingido (precisa de atenção). */
function matches(filter: FilterId, goal: Goal, evaluation: GoalEvaluation): boolean {
  switch (filter) {
    case 'all':
      return goal.status !== 'archived';
    case 'on_track':
      return goal.status === 'active' && evaluation.status === 'on_track';
    case 'at_risk':
      return goal.status === 'active' && (evaluation.status === 'at_risk' || evaluation.status === 'overdue');
    case 'completed':
      return goal.status === 'completed';
    case 'paused':
      return goal.status === 'paused';
    case 'archived':
      return goal.status === 'archived';
  }
}

const STATUS_RANK: Record<Goal['status'], number> = { active: 0, paused: 1, completed: 2, archived: 3 };

export function GoalsPage() {
  const model = useAppModel();
  const navigate = useNavigate();
  const { promptUpgrade } = useUpgradePrompt();
  const now = useNow(30_000);
  const [filter, setFilter] = useState<FilterId>('all');
  const [category, setCategory] = useState('');

  const categories = useMemo(
    () => [...new Set((model?.goals ?? []).map((g) => g.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [model?.goals],
  );

  if (!model) return <p role="status" className="text-sm text-muted">Carregando…</p>;

  const evaluated = model.goals.map((goal) => ({ goal, evaluation: model.evaluate(goal) }));
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.id, evaluated.filter(({ goal, evaluation }) => matches(f.id, goal, evaluation)).length]),
  ) as Record<FilterId, number>;

  const visible = evaluated
    .filter(({ goal, evaluation }) => matches(filter, goal, evaluation) && (!category || goal.category === category))
    .sort(
      (a, b) =>
        Number(b.goal.isPrimary) - Number(a.goal.isPrimary) ||
        STATUS_RANK[a.goal.status] - STATUS_RANK[b.goal.status] ||
        a.goal.targetDate.localeCompare(b.goal.targetDate),
    );

  const onNew = () => (model.canAddGoal ? navigate('/metas/nova') : promptUpgrade());
  const free = model.plan === 'free';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Meus objetivos"
        subtitle={
          <span data-testid="plan-usage">
            {free
              ? `Plano Grátis · ${model.activeCount} de ${model.limit} objetivos ativos`
              : `Plano Premium (simulação) · ${model.activeCount} objetivos ativos`}
          </span>
        }
        action={
          <Button onClick={onNew}>
            <Plus className="size-4" aria-hidden /> Novo objetivo
          </Button>
        }
      />

      {free && !model.canAddGoal && (
        <p role="note" className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-foreground">
          Você usou as {model.limit} vagas do plano Grátis. Conclua, pause ou arquive um objetivo para liberar uma vaga —
          nenhum dado é perdido.
        </p>
      )}

      <div role="group" aria-label="Filtrar objetivos" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors',
              filter === f.id
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border-strong bg-card text-muted hover:text-foreground',
            )}
          >
            {f.label}
            <span className={cn('tabular text-xs', filter === f.id ? 'text-accent-foreground/80' : 'text-dim')}>{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {categories.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="shrink-0">Categoria</span>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrar por categoria">
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
      )}

      {visible.length === 0 ? (
        model.goals.length === 0 ? (
          <EmptyState title="Você ainda não tem objetivos">
            <Button onClick={onNew}>Criar meu primeiro objetivo</Button>
          </EmptyState>
        ) : (
          <EmptyState title="Nenhum objetivo neste filtro">
            <p>Tente outro filtro ou categoria.</p>
          </EmptyState>
        )
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Lista de objetivos">
          {visible.map(({ goal, evaluation }) => (
            <li key={goal.id}>
              <GoalCard goal={goal} evaluation={evaluation} now={now} tz={model.tz} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
