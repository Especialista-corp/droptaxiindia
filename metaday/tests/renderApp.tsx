import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders, makeQueryClient } from '@/app/providers.tsx';
import { AppRoutes } from '@/app/routes.tsx';
import type { DataLayer } from '@/data/repositories.ts';
import { TEST_NOW } from './helpers.ts';

export function renderApp(layer: DataLayer, route = '/') {
  return render(
    <AppProviders layer={layer} clock={{ now: () => TEST_NOW }} queryClient={makeQueryClient()}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  );
}
