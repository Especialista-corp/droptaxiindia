import { useData } from '@/app/data.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Card } from '@/components/ui/card.tsx';
import { PageHeader } from '@/components/ui/page.tsx';
import { STATUS_DATE, STATUS_ITEMS, type FeatureStatus } from './statusData.ts';

const ORDER: FeatureStatus[] = ['funcional', 'demonstrativo', 'pendente', 'falhou'];
const LABEL: Record<FeatureStatus, string> = {
  funcional: 'Funcional',
  demonstrativo: 'Demonstrativo',
  pendente: 'Pendente',
  falhou: 'Falhou',
};
const TONE: Record<FeatureStatus, 'ok' | 'accent' | 'neutral' | 'danger'> = {
  funcional: 'ok',
  demonstrativo: 'accent',
  pendente: 'neutral',
  falhou: 'danger',
};

export function BetaStatusPage() {
  const { mode } = useData();
  const groups = ORDER.map((status) => ({ status, items: STATUS_ITEMS.filter((i) => i.status === status) }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Estado do beta"
        subtitle={`METADAY BETA 0.1 · registro de ${STATUS_DATE}`}
        back={{ to: '/configuracoes', label: 'Configurações' }}
      />

      <Card className="flex flex-col gap-2 text-sm" data-testid="beta-storage-note">
        <p className="font-semibold text-foreground">
          {mode === 'demo'
            ? 'Dados demonstrativos armazenados neste dispositivo'
            : 'Dados armazenados neste dispositivo (IndexedDB)'}
        </p>
        <p className="text-muted">
          Este beta funciona sem conta e sem servidor. As evidências abaixo foram registradas na data indicada a partir dos
          testes automatizados do repositório — não são uma verificação feita em tempo de execução.
        </p>
      </Card>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Resumo por situação">
        {groups.map(({ status, items }) => (
          <li key={status} className="rounded-xl border border-border bg-card p-3 text-center">
            <p className="tabular text-2xl font-extrabold text-foreground">{items.length}</p>
            <p className="text-xs text-muted">{LABEL[status]}</p>
          </li>
        ))}
      </ul>

      {groups
        .filter((g) => g.items.length > 0)
        .map(({ status, items }) => (
          <section key={status} aria-labelledby={`st-${status}`} className="flex flex-col gap-2">
            <h2 id={`st-${status}`} className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <Badge tone={TONE[status]}>{LABEL[status]}</Badge>
              <span className="tabular">{items.length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-dim">{item.area}</p>
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p className="mt-1 break-words text-xs text-muted">{item.evidence}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
