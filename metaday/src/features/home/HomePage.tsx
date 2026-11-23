import { ArrowRight, ChevronDown, PartyPopper, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNow } from '@/app/clock.tsx';
import { useData } from '@/app/data.tsx';
import { useAppModel } from '@/app/model.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card } from '@/components/ui/card.tsx';
import { EmptyState } from '@/components/ui/page.tsx';
import { getCountdown } from '@/domain/countdown.ts';
import { formatCivilPt } from '@/domain/dates.ts';
import { formatProgressText } from '@/domain/format.ts';
import type { Goal } from '@/domain/types.ts';
import { CountdownTiles } from '@/features/shared/CountdownTiles.tsx';
import { useGoalCommands } from '@/features/shared/GoalActions.tsx';
import { GoalProgress } from '@/features/shared/GoalProgress.tsx';
import { StatusBadge } from '@/features/shared/StatusBadge.tsx';

export function HomePage() {
  const model = useAppModel();
  if (!model) return <p role="status" className="text-sm text-muted">Carregando…</p>;

  const { primary, goals } = model;
  const visibleGoals = goals.filter((g) => g.status !== 'archived');

  if (!primary) {
    return visibleGoals.length === 0 ? <FirstGoal /> : <NoPrimary activeCount={model.activeCount} />;
  }
  return (
    <div className="flex flex-col gap-4">
      {primary.status === 'completed' ? <CompletedPrimary goal={primary} /> : <PrimaryGoal goal={primary} />}
      <MyGoalsLink />
    </div>
  );
}

function MyGoalsLink() {
  const model = useAppModel();
  if (!model) return null;
  const limitText = model.plan === 'free' ? `${model.activeCount} de ${model.limit} ativos` : `${model.activeCount} ativos`;
  return (
    <Link
      to="/metas"
      className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-card-2"
    >
      <span>
        Meus objetivos <span className="ml-1 font-normal text-muted">· {limitText}</span>
      </span>
      <ArrowRight className="size-4 text-accent" aria-hidden />
    </Link>
  );
}

function PrimaryGoal({ goal }: { goal: Goal }) {
  const model = useAppModel()!;
  const [expanded, setExpanded] = useState(false);
  const now = useNow(expanded ? 1000 : 30_000);
  const countdown = getCountdown(goal.targetDate, now, model.tz);
  const evaluation = model.evaluate(goal);
  const todayCount = model.snapshot.checkIns.filter((c) => c.goalId === goal.id && c.localDate === model.today).length;

  return (
    <>
      <Card className="short:gap-3 short:p-4 flex flex-col gap-5 p-5" aria-labelledby="objetivo-principal-titulo">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone="accent">Objetivo principal{goal.category ? ` · ${goal.category}` : ''}</Badge>
          <StatusBadge status={evaluation.status} />
        </div>

        <div>
          <h1 id="objetivo-principal-titulo" className="break-words text-2xl font-bold leading-tight text-foreground">
            {goal.title}
          </h1>
          <p className="mt-1 text-sm text-muted">Data-alvo: {formatCivilPt(goal.targetDate)}</p>
        </div>

        <div className="text-center" data-testid="home-countdown">
          {countdown.state === 'past' ? (
            <>
              <p className="text-4xl font-extrabold leading-none text-risk">Prazo encerrado</p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {countdown.daysOverdue === 1 ? 'ontem' : `há ${countdown.daysOverdue} dias`}
              </p>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
                Seu progresso continua valendo. Ajuste a data-alvo ou conclua o objetivo quando quiser.
              </p>
            </>
          ) : countdown.state === 'today' ? (
            <>
              <p className="tabular text-6xl font-extrabold leading-none text-accent">Hoje</p>
              <p className="mt-2 text-lg font-semibold text-foreground">é o dia-alvo</p>
            </>
          ) : (
            <>
              <p className="tabular short:text-6xl text-7xl font-extrabold leading-none text-accent" data-testid="days-remaining">
                {countdown.daysRemaining}
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {countdown.daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
              </p>
            </>
          )}

          {countdown.state !== 'past' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                aria-expanded={expanded}
                aria-controls="contagem-detalhada"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? 'Ocultar contagem detalhada' : 'Ver contagem detalhada'}
                <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
              </Button>
              {expanded && (
                <div id="contagem-detalhada" className="mt-2">
                  <CountdownTiles countdown={countdown} />
                </div>
              )}
            </>
          )}
        </div>

        <GoalProgress goal={goal} evaluation={evaluation} />

        {countdown.state === 'past' && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" asChild>
              <Link to={`/metas/${goal.id}/editar`}>Ajustar prazo</Link>
            </Button>
            <CompleteButton goal={goal} />
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-2">
        <Button size="lg" className="w-full" asChild>
          <Link to={`/checkin?meta=${goal.id}`}>Registrar atividade de hoje</Link>
        </Button>
        <p className="text-center text-xs text-muted" data-testid="today-status">
          {todayCount === 0
            ? 'Nenhum registro hoje ainda.'
            : todayCount === 1
              ? 'Hoje: 1 registro. Bom trabalho!'
              : `Hoje: ${todayCount} registros. Bom trabalho!`}
        </p>
      </div>
    </>
  );
}

function CompleteButton({ goal }: { goal: Goal }) {
  const commands = useGoalCommands();
  return (
    <Button variant="outline" onClick={() => void commands.setStatus(goal, 'completed', 'Meta alcançada! Parabéns.')}>
      Concluir objetivo
    </Button>
  );
}

/** Estado concluído: celebração; a contagem NÃO aparece como se a meta ainda estivesse pendente. */
function CompletedPrimary({ goal }: { goal: Goal }) {
  const model = useAppModel()!;
  const commands = useGoalCommands();
  const evaluation = model.evaluate(goal);
  const otherActive = model.activeGoals.filter((g) => g.id !== goal.id).length;
  const doneOn = goal.completedAt ? formatCivilPt(goal.completedAt.slice(0, 10)) : null;

  return (
    <Card className="flex flex-col items-center gap-4 p-6 text-center" aria-labelledby="objetivo-principal-titulo">
      <PartyPopper className="size-12 text-accent" aria-hidden />
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">Meta alcançada!</p>
        <h1 id="objetivo-principal-titulo" className="mt-1 break-words text-2xl font-bold text-foreground">
          {goal.title}
        </h1>
        {doneOn && <p className="mt-1 text-sm text-muted">Concluída em {doneOn}</p>}
        {goal.targetValue !== undefined && (
          <p className="tabular mt-1 text-sm text-muted">
            {formatProgressText(goal.currentValue, goal.targetValue, goal.unit)}
          </p>
        )}
        <p className="mt-2 text-xs text-dim">Prazo original: {formatCivilPt(goal.targetDate)}</p>
      </div>
      <StatusBadge status={evaluation.status} />
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        <Button onClick={() => void commands.setStatus(goal, 'archived', 'Objetivo arquivado. O histórico foi preservado.')}>
          Arquivar objetivo
        </Button>
        <Button variant="secondary" onClick={() => void commands.setStatus(goal, 'active', 'Objetivo reaberto para continuar.')}>
          Continuar objetivo
        </Button>
      </div>
      {otherActive > 0 && (
        <Link to="/metas" className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
          Escolher outro objetivo principal
        </Link>
      )}
    </Card>
  );
}

function FirstGoal() {
  const { mode, setMode } = useData();
  return (
    <EmptyState icon={<Sparkles className="size-10" aria-hidden />} title="Qual é o seu primeiro objetivo?" className="mt-4">
      <p className="max-w-xs">
        Defina um objetivo com data-alvo e o METADAY mostra, assim que você abrir o app, quantos dias faltam e o que
        fazer hoje.
      </p>
      <Button size="lg" asChild>
        <Link to="/metas/nova">
          <Plus className="size-5" aria-hidden /> Criar meu primeiro objetivo
        </Link>
      </Button>
      {mode === 'local' && (
        <button
          type="button"
          onClick={() => setMode('demo')}
          className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
        >
          Explorar com dados de demonstração
        </button>
      )}
    </EmptyState>
  );
}

function NoPrimary({ activeCount }: { activeCount: number }) {
  return (
    <EmptyState title={activeCount === 0 ? 'Nenhum objetivo ativo no momento' : 'Escolha seu objetivo principal'} className="mt-4">
      <p className="max-w-xs">
        {activeCount === 0
          ? 'Reative um objetivo pausado ou crie um novo para ver a contagem regressiva aqui.'
          : 'Defina qual objetivo aparece em destaque ao abrir o app.'}
      </p>
      <Button asChild>
        <Link to="/metas">Ver meus objetivos</Link>
      </Button>
    </EmptyState>
  );
}
