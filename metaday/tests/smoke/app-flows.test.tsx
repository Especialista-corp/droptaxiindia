import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DEMO_IDS } from '@/data/seed.ts';
import { goalInput, makeLayer } from '../helpers.ts';
import { renderApp } from '../renderApp.tsx';

async function demoLayer() {
  const layer = await makeLayer({ mode: 'demo' });
  await layer.admin.seedDemo();
  return layer;
}

describe('navegação (smoke)', () => {
  it('barra inferior: Início | Metas | Check-in | Hábitos | Mais; Mais abre as 4 telas', async () => {
    const user = userEvent.setup();
    renderApp(await demoLayer());
    const nav = (await screen.findAllByRole('navigation', { name: 'Navegação principal' })).find((n) => !n.closest('aside'))!;
    for (const label of ['Início', 'Metas', 'Check-in', 'Hábitos', 'Mais']) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
    await user.click(within(nav).getByRole('button', { name: /mais/i }));
    const dialog = await screen.findByRole('dialog');
    for (const label of ['Contagem regressiva', 'Calendário', 'Relatórios', 'Configurações']) {
      expect(within(dialog).getByRole('button', { name: label })).toBeInTheDocument();
    }
    await user.click(within(dialog).getByRole('button', { name: 'Calendário' }));
    expect(await screen.findByRole('heading', { name: 'Calendário', level: 1 })).toBeInTheDocument();
  });

  it.each([
    ['/metas', 'Meus objetivos'],
    ['/checkin', 'Check-in'],
    ['/habitos', 'Hábitos'],
    ['/contagem', 'Contagem regressiva'],
    ['/calendario', 'Calendário'],
    ['/relatorios', 'Relatórios'],
    ['/configuracoes', 'Configurações'],
    ['/estado-do-beta', 'Estado do beta'],
    [`/metas/${DEMO_IDS.goalRun}`, 'Meia maratona'],
  ])('rota %s renderiza "%s"', async (route, heading) => {
    renderApp(await demoLayer(), route);
    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
  });
});

describe('Home: objetivo principal', () => {
  it('primeiro acesso → criar objetivo → aparece na Home como principal', async () => {
    const user = userEvent.setup();
    renderApp(await makeLayer());
    expect(await screen.findByText('Qual é o seu primeiro objetivo?')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /criar meu primeiro objetivo/i }));
    await user.type(await screen.findByLabelText('Título'), 'Ler 5 livros');
    await user.click(screen.getByRole('button', { name: 'Criar objetivo' }));
    expect(await screen.findByRole('heading', { name: 'Ler 5 livros', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Objetivo principal', { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId('days-remaining')).toHaveTextContent('30');
    expect(screen.getByRole('link', { name: 'Registrar atividade de hoje' })).toBeInTheDocument();
  });

  it('mostra um único cartão dominante com progresso e tempo decorrido separados', async () => {
    renderApp(await demoLayer());
    await screen.findByRole('heading', { name: 'Meia maratona', level: 1 });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Progresso da meta')).toBeInTheDocument();
    expect(screen.getByText('Tempo decorrido')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /meus objetivos/i })).toHaveAttribute('href', '/metas');
  });

  it('contador detalhado expande dias/horas/min/seg', async () => {
    const user = userEvent.setup();
    renderApp(await demoLayer());
    await user.click(await screen.findByRole('button', { name: /ver contagem detalhada/i }));
    const group = screen.getByRole('group', { name: /contagem regressiva detalhada/i });
    for (const unit of ['dias', 'horas', 'min', 'seg']) expect(within(group).getByText(unit)).toBeInTheDocument();
  });

  it('meta concluída com prazo futuro NÃO aparece como pendente', async () => {
    const layer = await demoLayer();
    await layer.goals.setStatus(DEMO_IDS.goalRun, 'completed');
    renderApp(layer);
    expect(await screen.findByText('Meta alcançada!')).toBeInTheDocument();
    expect(screen.queryByText(/dias restantes/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('days-remaining')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Arquivar objetivo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar objetivo' })).toBeInTheDocument();
  });

  it('trocar o objetivo principal atualiza a Home e mantém apenas um principal', async () => {
    const user = userEvent.setup();
    const layer = await demoLayer();
    renderApp(layer, '/metas');
    await user.click(await screen.findByRole('button', { name: 'Ações para Ler 12 livros' }));
    await user.click(await screen.findByRole('button', { name: /definir como objetivo principal/i }));
    await waitFor(async () => expect((await layer.goals.list()).filter((g) => g.isPrimary).map((g) => g.title)).toEqual(['Ler 12 livros']));
  });
});

describe('plano FREE / Premium (UI)', () => {
  it('quarta meta ativa é bloqueada com explicação e oferta Premium; nada se perde', async () => {
    const user = userEvent.setup();
    const layer = await demoLayer();
    renderApp(layer, '/metas');
    expect(await screen.findByTestId('plan-usage')).toHaveTextContent('3 de 3');
    await user.click(screen.getByRole('button', { name: /novo objetivo/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/até 3 objetivos ativos/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/não está disponível para compra/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /simular premium/i })).toBeInTheDocument();
    expect(await layer.goals.list()).toHaveLength(5);
  });

  it('acesso direto a /metas/nova no limite mostra explicação, não o formulário', async () => {
    renderApp(await demoLayer(), '/metas/nova');
    expect(await screen.findByText('Limite do plano Grátis atingido')).toBeInTheDocument();
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument();
  });

  it('Premium (simulação) libera a quarta meta, deixando claro que não há cobrança', async () => {
    const user = userEvent.setup();
    const layer = await demoLayer();
    renderApp(layer, '/configuracoes');
    expect(await screen.findByText(/nenhuma cobrança é feita/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Simular Premium' }));
    await waitFor(async () => expect((await layer.subscription.get()).plan).toBe('premium'));
    await layer.goals.create(goalInput({ title: 'Quarta' }));
    expect((await layer.goals.list()).filter((g) => g.status === 'active')).toHaveLength(4);
  });
});

describe('check-in', () => {
  it('registra, atualiza o objetivo e não duplica com duplo clique', async () => {
    const user = userEvent.setup();
    const layer = await demoLayer();
    const before = (await layer.goals.get(DEMO_IDS.goalRun))!.currentValue;
    renderApp(layer, `/checkin?meta=${DEMO_IDS.goalRun}`);
    await user.type(await screen.findByLabelText(/quantidade/i), '5');
    const submit = screen.getByRole('button', { name: 'Registrar check-in' });
    await user.dblClick(submit);
    expect(await screen.findByTestId('checkin-confirmation')).toBeInTheDocument();
    expect((await layer.goals.get(DEMO_IDS.goalRun))!.currentValue).toBe(before + 5);
    expect((await layer.checkIns.list()).filter((c) => c.localDate === '2026-11-23')).toHaveLength(1);
  });

  it('permite excluir um registro com confirmação, ajustando o valor', async () => {
    const user = userEvent.setup();
    const layer = await demoLayer();
    const c = await layer.checkIns.create({ goalId: DEMO_IDS.goalRun, localDate: '2026-11-23', quantity: 3 });
    const before = (await layer.goals.get(DEMO_IDS.goalRun))!.currentValue;
    renderApp(layer, '/checkin');
    await user.click(await screen.findByRole('button', { name: /excluir check-in de 23/i }));
    await user.click(await screen.findByRole('button', { name: 'Excluir' }));
    await waitFor(async () => expect(await layer.checkIns.list()).not.toContainEqual(expect.objectContaining({ id: c.id })));
    expect((await layer.goals.get(DEMO_IDS.goalRun))!.currentValue).toBe(before - 3);
  });
});

describe('hábitos', () => {
  it('dias fora da recorrência ficam desabilitados e dias programados alternam', async () => {
    const user = userEvent.setup();
    const layer = await demoLayer();
    renderApp(layer, '/habitos');
    const rows = await screen.findAllByTestId('habit-row');
    const treino = rows.find((r) => within(r).queryByText('Correr ou caminhar'))!;
    // 2026-11-23 (segunda) é programado; 2026-11-22 (domingo) não é para este hábito
    expect(treino.querySelector('[data-date="2026-11-22"]')).toBeDisabled();
    const monday = treino.querySelector<HTMLButtonElement>('[data-date="2026-11-23"]')!;
    expect(monday).toBeEnabled();
    await user.click(monday);
    await waitFor(() => expect(treino.querySelector('[data-date="2026-11-23"]')).toHaveAttribute('data-state', 'done'));
  });
});

describe('relatórios e estados pendentes', () => {
  it('zero registros → estado vazio (sem gráfico falso)', async () => {
    renderApp(await makeLayer(), '/relatorios');
    expect(await screen.findByText('Sem registros nos últimos 14 dias')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-chart')).not.toBeInTheDocument();
  });

  it('gráfico de 14 dias reflete registros reais', async () => {
    renderApp(await demoLayer(), '/relatorios');
    await screen.findByTestId('activity-chart');
    const bars = screen.getAllByTestId('activity-bar');
    expect(bars).toHaveLength(14);
    expect(bars.some((b) => Number(b.getAttribute('data-checkins')) > 0)).toBe(true);
  });

  it('exportação PDF aparece como "Em desenvolvimento", sem botão de download', async () => {
    renderApp(await demoLayer(), '/relatorios');
    const card = await screen.findByTestId('export-pending');
    expect(within(card).getByText('Em desenvolvimento')).toBeInTheDocument();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('configurações: lembretes desabilitados e integrações pendentes (sem CTAs falsos)', async () => {
    renderApp(await demoLayer(), '/configuracoes');
    const sw = await screen.findByRole('switch');
    expect(sw).toBeDisabled();
    expect(screen.getAllByText('Pendente').length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByRole('button', { name: /entrar com google/i })).not.toBeInTheDocument();
  });

  it('restaurar demonstração pede confirmação e restaura só dados demo', async () => {
    const user = userEvent.setup();
    const layer = await demoLayer();
    await layer.goals.remove(DEMO_IDS.goalBooks);
    renderApp(layer, '/configuracoes');
    await user.click(await screen.findByRole('button', { name: /restaurar dados de demonstração/i }));
    const dialog = await screen.findByRole('alertdialog');
    expect(await layer.goals.get(DEMO_IDS.goalBooks)).toBeUndefined(); // ainda não restaurou
    await user.click(within(dialog).getByRole('button', { name: 'Restaurar demonstração' }));
    await waitFor(async () => expect(await layer.goals.get(DEMO_IDS.goalBooks)).toBeDefined());
  });
});
