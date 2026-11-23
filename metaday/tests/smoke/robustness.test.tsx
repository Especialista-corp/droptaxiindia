import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { makeQueryClient } from '@/app/providers.tsx';
import { ErrorBoundary } from '@/app/ErrorBoundary.tsx';
import { makeLayer } from '../helpers.ts';
import { renderApp } from '../renderApp.tsx';

function Boom(): never {
  throw new Error('falha simulada de renderização');
}

describe('ErrorBoundary', () => {
  it('captura um erro de renderização e mostra uma saída, sem derrubar a página', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Algo deu errado nesta tela');
    expect(screen.getByText(/continuam salvos neste dispositivo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('um erro em uma tela não some com a mensagem original (detalhe técnico disponível)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('falha simulada de renderização')).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('Rotas com identificador inexistente (não deletam nem quebram a tela)', () => {
  it('objetivo inexistente mostra estado amigável', async () => {
    renderApp(await makeLayer(), '/metas/id-que-nao-existe');
    expect(await screen.findByText('Objetivo não encontrado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voltar para meus objetivos/i })).toHaveAttribute('href', '/metas');
  });

  it('editar objetivo inexistente mostra estado amigável', async () => {
    renderApp(await makeLayer(), '/metas/id-que-nao-existe/editar');
    expect(await screen.findByText('Objetivo não encontrado')).toBeInTheDocument();
  });

  it('hábito inexistente mostra estado amigável', async () => {
    renderApp(await makeLayer(), '/habitos/id-que-nao-existe/editar');
    expect(await screen.findByText('Hábito não encontrado')).toBeInTheDocument();
  });
});

describe('Armazenamento indisponível', () => {
  it('quando o IndexedDB falha ao abrir, mostra explicação e não uma tela em branco', async () => {
    vi.resetModules();
    vi.doMock('@/data/idb/createIdbDataLayer.ts', () => ({
      createIdbDataLayer: vi.fn().mockRejectedValue(new DOMException('blocked', 'InvalidStateError')),
    }));
    const { AppProviders: FreshAppProviders } = await import('@/app/providers.tsx');
    const { AppRoutes: FreshAppRoutes } = await import('@/app/routes.tsx');
    render(
      <FreshAppProviders queryClient={makeQueryClient()}>
        <MemoryRouter initialEntries={['/']}>
          <FreshAppRoutes />
        </MemoryRouter>
      </FreshAppProviders>,
    );
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível abrir o armazenamento/i));
    vi.doUnmock('@/data/idb/createIdbDataLayer.ts');
    vi.resetModules();
  });
});

describe('Formulários resistem a reenvio e a campos em branco', () => {
  it('check-in sem quantidade registra apenas presença, sem erro', async () => {
    const user = userEvent.setup();
    const layer = await makeLayer();
    const goal = await layer.goals.create({
      title: 'Meditar',
      startDate: '2026-11-01',
      targetDate: '2026-12-01',
      frequency: 'daily',
      priority: 'low',
    });
    renderApp(layer, `/checkin?meta=${goal.id}`);
    await user.click(await screen.findByRole('button', { name: 'Registrar check-in' }));
    expect(await screen.findByTestId('checkin-confirmation')).toBeInTheDocument();
    expect((await layer.checkIns.list())).toHaveLength(1);
  });

  it('título de objetivo vazio é bloqueado com mensagem de erro (sem quebrar)', async () => {
    const user = userEvent.setup();
    renderApp(await makeLayer(), '/metas/nova');
    await user.click(await screen.findByRole('button', { name: 'Criar objetivo' }));
    expect(await screen.findByText('Informe um título')).toBeInTheDocument();
  });
});
