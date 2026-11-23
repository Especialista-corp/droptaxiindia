import { FileDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppModel } from '@/app/model.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card, SectionTitle } from '@/components/ui/card.tsx';
import { EmptyState, PageHeader } from '@/components/ui/page.tsx';
import { ProgressBar } from '@/components/ui/progress.tsx';
import { formatProgressText } from '@/domain/format.ts';
import {
  MIN_ELAPSED_DAYS_FOR_PACE,
  MIN_ELAPSED_PERCENT_FOR_PACE,
  PACE_TOLERANCE_POINTS,
} from '@/domain/progress.ts';
import { activitySeries, buildReportSummary } from '@/domain/reports.ts';
import { StatusBadge } from '@/features/shared/StatusBadge.tsx';
import { ActivityChart } from './ActivityChart.tsx';

export function ReportsPage() {
  const model = useAppModel();
  if (!model) return <p role="status" className="text-sm text-muted">Carregando…</p>;

  const { snapshot, today } = model;
  const summary = buildReportSummary({
    goals: snapshot.goals,
    habits: snapshot.habits,
    habitEntries: snapshot.habitEntries,
    checkIns: snapshot.checkIns,
    today,
  });
  const series = activitySeries(snapshot.checkIns, snapshot.habitEntries, today, 14);
  const hasRecent = series.some((d) => d.total > 0);
  const reportGoals = model.goals.filter((g) => g.status === 'active' || g.status === 'completed');

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Relatórios" subtitle="Calculados a partir dos seus registros neste dispositivo." />

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3">
        <Kpi label="Check-ins totais" value={String(summary.totalCheckIns)} testId="kpi-checkins" />
        <Kpi
          label="Constância (30 dias)"
          value={summary.consistencyPercent === null ? '—' : `${Math.round(summary.consistencyPercent)}%`}
          hint={
            summary.consistencyPercent === null
              ? 'Crie hábitos para calcular'
              : `${summary.habitsDone} de ${summary.habitsScheduled} dias programados`
          }
          testId="kpi-consistency"
        />
        <Kpi label="Metas no ritmo" value={String(summary.onTrack)} testId="kpi-on-track" />
        <Kpi
          label="Metas em risco"
          value={String(summary.atRisk)}
          hint={summary.insufficient > 0 ? `${summary.insufficient} sem dados suficientes` : undefined}
          testId="kpi-at-risk"
        />
      </section>

      <Card>
        {hasRecent ? (
          <ActivityChart series={series} />
        ) : (
          <EmptyState title="Sem registros nos últimos 14 dias" className="border-0 py-4" data-testid="chart-empty">
            <p className="max-w-xs">Registre um check-in ou marque um hábito para ver sua atividade aqui.</p>
            <Button variant="secondary" asChild>
              <Link to="/checkin">Fazer um check-in</Link>
            </Button>
          </EmptyState>
        )}
      </Card>

      <section aria-labelledby="prog" className="flex flex-col gap-2">
        <SectionTitle id="prog">Progresso por objetivo</SectionTitle>
        {reportGoals.length === 0 ? (
          <p className="text-sm text-muted">Nenhum objetivo ativo ou concluído.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reportGoals.map((goal) => {
              const evaluation = model.evaluate(goal);
              const text =
                evaluation.progress === null
                  ? 'Sem valor-alvo'
                  : `${formatProgressText(goal.currentValue, goal.targetValue, goal.unit)} · ${Math.round(evaluation.rawProgress ?? evaluation.progress)}%`;
              return (
                <li key={goal.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3" data-testid="report-goal">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/metas/${goal.id}`} className="min-w-0 break-words text-sm font-semibold">
                      {goal.title}
                    </Link>
                    <StatusBadge status={evaluation.status} />
                  </div>
                  <ProgressBar value={evaluation.progress} label={`Progresso de ${goal.title}`} valueText={text} />
                  <p className="tabular text-xs text-muted">{text}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Card className="flex items-start gap-3" data-testid="export-pending">
        <FileDown className="mt-0.5 size-5 shrink-0 text-dim" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            Exportar relatório (PDF, planilha, imagem) <Badge tone="neutral">Em desenvolvimento</Badge>
          </p>
          <p className="mt-1 text-muted">
            A exportação de relatórios ainda não existe no BETA 0.1. Seus dados podem ser exportados em JSON em{' '}
            <Link to="/configuracoes" className="font-semibold text-accent underline-offset-4 hover:underline">
              Configurações
            </Link>
            .
          </p>
        </div>
      </Card>

      <details className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted">
        <summary className="min-h-8 font-semibold text-foreground">Como calculamos</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
          <li>
            <strong className="text-foreground">Progresso da meta:</strong> valor realizado ÷ valor-alvo, exibido entre 0 e 100%
            (o valor acima do alvo é mantido). Sem valor-alvo, não há cálculo.
          </li>
          <li>
            <strong className="text-foreground">Tempo decorrido:</strong> dias desde o início ÷ dias entre o início e a data-alvo.
          </li>
          <li>
            <strong className="text-foreground">No ritmo:</strong> progresso ≥ tempo decorrido − {PACE_TOLERANCE_POINTS} pontos.
            Só avaliamos após {MIN_ELAPSED_DAYS_FOR_PACE} dias ou {MIN_ELAPSED_PERCENT_FOR_PACE}% do prazo, e apenas em metas
            com valor-alvo. “Em risco” também inclui prazo encerrado sem atingir o alvo.
          </li>
          <li>
            <strong className="text-foreground">Constância:</strong> dias cumpridos ÷ dias programados nos últimos 30 dias. Dias
            fora da recorrência, pausas e o dia de hoje (se ainda não cumprido) não contam como falta.
          </li>
        </ul>
      </details>
    </div>
  );
}

function Kpi({ label, value, hint, testId }: { label: string; value: string; hint?: string; testId: string }) {
  return (
    <Card className="flex flex-col gap-1 p-3">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="tabular text-3xl font-extrabold leading-none text-accent" data-testid={testId}>
        {value}
      </p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </Card>
  );
}
