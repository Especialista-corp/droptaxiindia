import { Bell, Download, Info, Plug, Shield, Trash2, User } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useData } from '@/app/data.tsx';
import { useActions, useAppModel } from '@/app/model.ts';
import { notifyError, notifySuccess } from '@/app/notify.ts';
import { Badge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Card } from '@/components/ui/card.tsx';
import { ConfirmDialog } from '@/components/ui/confirm-dialog.tsx';
import { Field, Input, Select } from '@/components/ui/field.tsx';
import { PageHeader } from '@/components/ui/page.tsx';
import { Sheet } from '@/components/ui/sheet.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { isDowngradeSelectionRequired } from '@/data/errors.ts';
import { detectTimeZone } from '@/domain/dates.ts';
import { FREE_ACTIVE_GOAL_LIMIT } from '@/domain/plan.ts';
import { LIMITS } from '@/domain/schemas.ts';

function listTimeZones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    zones = [];
  }
  const base = zones.length ? zones : ['America/Sao_Paulo', 'America/Manaus', 'America/Noronha', 'America/New_York', 'Europe/Lisbon', 'UTC'];
  return [...new Set([current, detectTimeZone(), ...base])].sort();
}

function Section({ id, icon, title, children }: { id?: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card id={id} className="flex scroll-mt-4 flex-col gap-3" aria-labelledby={id ? `${id}-titulo` : undefined}>
      <h2 id={id ? `${id}-titulo` : undefined} className="flex items-center gap-2 text-base font-bold">
        <span className="text-accent">{icon}</span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

export function SettingsPage() {
  const model = useAppModel();
  const actions = useActions();
  const { mode, setMode } = useData();
  const { hash } = useLocation();

  const [name, setName] = useState<string | null>(null);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [keepIds, setKeepIds] = useState<string[]>([]);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const settings = model?.snapshot.settings;
  const zones = useMemo(() => listTimeZones(settings?.timezone ?? detectTimeZone()), [settings?.timezone]);

  useEffect(() => {
    if (!hash || !model) return;
    document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' });
  }, [hash, model]);

  if (!model || !settings) return <p role="status" className="text-sm text-muted">Carregando…</p>;

  const displayName = name ?? settings.displayName;
  const suspended = model.goals.filter((g) => g.status === 'paused' && g.suspendedByPlan);
  const premium = model.plan === 'premium';

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      notifySuccess(ok);
    } catch (e) {
      notifyError(e);
    }
  };

  const startDowngrade = async () => {
    try {
      await actions.setPlan('free');
      notifySuccess('Plano Grátis (simulação) ativado.');
    } catch (e) {
      if (isDowngradeSelectionRequired(e)) {
        setKeepIds(model.activeGoals.slice(0, FREE_ACTIVE_GOAL_LIMIT).map((g) => g.id));
        setDowngradeOpen(true);
      } else notifyError(e);
    }
  };

  const confirmDowngrade = async () => {
    try {
      const result = await actions.setPlan('free', keepIds);
      setDowngradeOpen(false);
      notifySuccess(`Plano Grátis (simulação) ativado. ${result.suspendedGoalIds.length} objetivo(s) suspenso(s), sem exclusão.`);
    } catch (e) {
      notifyError(e);
    }
  };

  const exportData = async () => {
    try {
      const json = await actions.exportJson();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `metaday-${mode}-${model.today}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notifySuccess('Arquivo JSON gerado.');
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Configurações" />

      <Section icon={<User className="size-5" aria-hidden />} title="Perfil">
        <Field label="Como devemos chamar você?" optional>
          {(c) => (
            <Input
              {...c}
              value={displayName}
              maxLength={LIMITS.displayName + 10}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Button
          variant="secondary"
          className="self-start"
          disabled={name === null || name === settings.displayName}
          onClick={() => void run(async () => { await actions.updateSettings({ displayName }); setName(null); }, 'Perfil salvo.')}
        >
          Salvar nome
        </Button>
        <p className="rounded-xl border border-border bg-background p-3 text-xs text-muted">
          <strong className="text-foreground">Sem conta no BETA 0.1.</strong> Não há cadastro nem login: tudo fica neste
          dispositivo. Cadastro obrigatório, login com Google/e-mail e sincronização fazem parte da Entrega D e ainda não
          foram implementados.
        </p>
      </Section>

      <Section id="plano" icon={<Shield className="size-5" aria-hidden />} title="Plano">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          Plano atual: <Badge tone={premium ? 'solid' : 'neutral'}>{premium ? 'Premium (simulação)' : 'Grátis'}</Badge>
        </p>
        <p className="text-sm text-muted">
          {premium
            ? 'Objetivos ativos ilimitados.'
            : `Até ${FREE_ACTIVE_GOAL_LIMIT} objetivos ativos (você usa ${model.activeCount}).`}{' '}
          Um objetivo principal em ambos os planos.
        </p>
        <p className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-xs text-foreground">
          <strong>Simulação local — nenhuma cobrança é feita.</strong> O pagamento do Premium não está integrado ao BETA 0.1;
          este botão apenas permite testar o comportamento.
        </p>
        {premium ? (
          <Button variant="secondary" onClick={() => void startDowngrade()}>
            Voltar ao plano Grátis (simulação)
          </Button>
        ) : (
          <Button onClick={() => void run(() => actions.setPlan('premium'), 'Premium (simulação) ativado.')}>
            Simular Premium
          </Button>
        )}
        {suspended.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3 text-sm">
            <p>
              {suspended.length} objetivo(s) suspenso(s) pelo plano Grátis: {suspended.map((g) => g.title).join(', ')}. Nenhum dado
              foi excluído.
            </p>
            <Button
              variant="secondary"
              className="self-start"
              onClick={() => void run(async () => {
                const ids = await actions.reactivateSuspended();
                if (ids.length === 0) throw new Error('Sem vagas disponíveis. Conclua ou arquive um objetivo, ou use o Premium.');
              }, 'Objetivos reativados.')}
            >
              Reativar objetivos suspensos
            </Button>
          </div>
        )}
      </Section>

      <Section icon={<Info className="size-5" aria-hidden />} title="Preferências">
        <Field label="A semana começa em">
          {(c) => (
            <Select
              {...c}
              value={String(settings.weekStartsOn)}
              onChange={(e) => void run(() => actions.updateSettings({ weekStartsOn: e.target.value === '1' ? 1 : 0 }), 'Preferência salva.')}
            >
              <option value="0">Domingo</option>
              <option value="1">Segunda-feira</option>
            </Select>
          )}
        </Field>
        <Field label="Fuso horário" hint="Define o que é “hoje” e o fim do dia-alvo.">
          {(c) => (
            <Select
              {...c}
              value={settings.timezone}
              onChange={(e) => void run(() => actions.updateSettings({ timezone: e.target.value }), 'Fuso horário salvo.')}
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Section>

      <Section icon={<Bell className="size-5" aria-hidden />} title="Lembretes">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="lembretes-switch" className="text-sm font-medium">
            Lembrete diário de check-in
          </label>
          <div className="flex items-center gap-2">
            <Badge tone="neutral">Em desenvolvimento</Badge>
            <Switch id="lembretes-switch" disabled checked={false} aria-describedby="lembretes-nota" />
          </div>
        </div>
        <p id="lembretes-nota" className="text-xs text-muted">
          Lembretes exigem permissão do dispositivo e um serviço de notificações, que ainda não foram implementados. Nenhuma
          notificação será enviada.
        </p>
      </Section>

      <Section icon={<Plug className="size-5" aria-hidden />} title="Integrações">
        <ul className="flex flex-col gap-2 text-sm">
          {['Login com Google', 'Google Agenda', 'Notificações no Android', 'Cobrança do Premium', 'Backup e sincronização na nuvem'].map(
            (name) => (
              <li key={name} className="flex items-center justify-between gap-2">
                <span>{name}</span>
                <Badge tone="neutral">Pendente</Badge>
              </li>
            ),
          )}
        </ul>
      </Section>

      <Section id="dados" icon={<Download className="size-5" aria-hidden />} title="Dados">
        <p className="text-sm text-muted" data-testid="storage-note">
          {mode === 'demo'
            ? 'Dados demonstrativos (fictícios) armazenados neste dispositivo, no IndexedDB do navegador.'
            : 'Seus dados ficam armazenados neste dispositivo, no IndexedDB do navegador. Não há sincronização: limpar os dados do navegador apaga tudo.'}
        </p>
        <p className="rounded-xl border border-border bg-background p-3 text-xs text-muted">
          Os dados de demonstração e os seus dados ficam em bancos separados e nunca se misturam.
        </p>
        <div className="flex flex-col gap-2">
          {mode === 'local' ? (
            <Button variant="secondary" onClick={() => { setMode('demo'); notifySuccess('Modo demonstração ativado.'); }}>
              Explorar dados de demonstração
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => { setMode('local'); notifySuccess('Voltamos aos seus dados.'); }}>
                Voltar aos meus dados
              </Button>
              <Button variant="outline" onClick={() => setConfirmRestore(true)}>
                Restaurar dados de demonstração…
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => void exportData()}>
            <Download className="size-4" aria-hidden /> Exportar meus dados (JSON)
          </Button>
          <Button variant="danger" onClick={() => setConfirmClear(true)}>
            <Trash2 className="size-4" aria-hidden /> {mode === 'demo' ? 'Apagar dados de demonstração…' : 'Apagar todos os meus dados…'}
          </Button>
        </div>
      </Section>

      <Link
        to="/estado-do-beta"
        className="flex min-h-14 items-center justify-between rounded-2xl border border-border bg-card px-4 text-sm font-semibold hover:bg-card-2"
      >
        Estado do beta (o que funciona e o que não)
        <span aria-hidden className="text-accent">›</span>
      </Link>
      <p className="pb-2 text-center text-xs text-dim">METADAY BETA 0.1</p>

      <Sheet
        open={downgradeOpen}
        onOpenChange={setDowngradeOpen}
        title="Quais objetivos manter ativos?"
        description={`No plano Grátis você pode ter até ${FREE_ACTIVE_GOAL_LIMIT} objetivos ativos. Os demais ficam suspensos — nada é excluído e você pode reativá-los depois.`}
      >
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {model.activeGoals.map((g) => {
              const checked = keepIds.includes(g.id);
              const disabled = !checked && keepIds.length >= FREE_ACTIVE_GOAL_LIMIT;
              return (
                <li key={g.id}>
                  <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-5 accent-[#E9AE12]"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => setKeepIds((cur) => (cur.includes(g.id) ? cur.filter((x) => x !== g.id) : [...cur, g.id]))}
                    />
                    <span className="min-w-0 break-words">{g.title}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="tabular text-xs text-muted">
            {keepIds.length} de {FREE_ACTIVE_GOAL_LIMIT} selecionados
          </p>
          <Button disabled={keepIds.length === 0} onClick={() => void confirmDowngrade()}>
            Confirmar e voltar ao Grátis
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={setConfirmRestore}
        title="Restaurar dados de demonstração?"
        confirmLabel="Restaurar demonstração"
        description={
          <p>
            O conteúdo atual da <strong>demonstração</strong> será substituído pelos dados fictícios originais. Seus dados reais
            não são afetados.
          </p>
        }
        onConfirm={() => run(() => actions.restoreDemo(), 'Dados de demonstração restaurados.')}
      />
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title={mode === 'demo' ? 'Apagar os dados de demonstração?' : 'Apagar todos os seus dados?'}
        destructive
        confirmLabel="Apagar definitivamente"
        description={
          <p>
            Objetivos, hábitos, check-ins e configurações {mode === 'demo' ? 'da demonstração' : 'deste dispositivo'} serão
            removidos. <strong>Esta ação não pode ser desfeita.</strong> Considere exportar seus dados antes.
          </p>
        }
        onConfirm={() => run(() => actions.clearAllData(), 'Dados apagados.')}
      />
    </div>
  );
}
