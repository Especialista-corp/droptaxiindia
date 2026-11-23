import { parseCivil, formatCivilLongPt } from '@/domain/dates.ts';
import type { ActivityDay } from '@/domain/reports.ts';

/**
 * Atividade dos últimos 14 dias: barras empilhadas (check-ins + hábitos) calculadas a
 * partir de registros reais. Acessível: o desenho é `aria-hidden` e há uma tabela
 * equivalente para leitores de tela.
 */
export function ActivityChart({ series }: { series: ActivityDay[] }) {
  const max = Math.max(1, ...series.map((d) => d.total));
  const pct = (value: number) => `${(value / max) * 100}%`;

  return (
    <figure className="flex flex-col gap-2" data-testid="activity-chart">
      <figcaption className="flex items-baseline justify-between text-xs text-muted">
        <span className="font-semibold text-foreground">Atividade dos últimos {series.length} dias</span>
        <span className="tabular">máx. {max} por dia</span>
      </figcaption>

      <div aria-hidden className="flex h-36 items-end gap-1 border-b border-border-strong">
        {series.map((d) => (
          <div
            key={d.date}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${formatCivilLongPt(d.date)}: ${d.checkIns} check-ins, ${d.habits} hábitos`}
            data-testid="activity-bar"
            data-total={d.total}
            data-checkins={d.checkIns}
            data-habits={d.habits}
          >
            <div className="w-full rounded-t-sm bg-ok" style={{ height: pct(d.habits) }} />
            <div className="w-full bg-accent" style={{ height: pct(d.checkIns) }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-1 text-[10px] text-dim">
        {series.map((d) => (
          <span key={d.date} className="tabular min-w-0 flex-1 text-center">
            {parseCivil(d.date).d}
          </span>
        ))}
      </div>

      <ul className="flex items-center gap-4 text-xs text-muted" aria-label="Legenda do gráfico">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-accent" aria-hidden /> Check-ins
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-ok" aria-hidden /> Hábitos cumpridos
        </li>
      </ul>

      {/* <table> ignora overflow/clip: o wrapper .sr-only é que o esconde visualmente sem gerar overflow. */}
      <div className="sr-only">
      <table>
        <caption>Atividade por dia</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Check-ins</th>
            <th scope="col">Hábitos cumpridos</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.date}>
              <th scope="row">{formatCivilLongPt(d.date)}</th>
              <td>{d.checkIns}</td>
              <td>{d.habits}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
