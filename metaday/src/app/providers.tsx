import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ClockProvider, type Clock } from './clock.tsx';
import { DataProvider } from './data.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import type { DataLayer } from '@/data/repositories.ts';

export function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } } });
}

interface AppProvidersProps {
  children: ReactNode;
  /** Somente testes: camada de dados já criada e relógio fixo. */
  layer?: DataLayer;
  clock?: Clock;
  queryClient?: QueryClient;
}

export function AppProviders({ children, layer, clock, queryClient }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? makeQueryClient());
  return (
    <ClockProvider clock={clock}>
      <QueryClientProvider client={client}>
        <DataProvider layer={layer}>
          <ErrorBoundary>{children}</ErrorBoundary>
          <Toaster
            theme="dark"
            position="top-center"
            toastOptions={{
              style: { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border-strong)' },
            }}
          />
        </DataProvider>
      </QueryClientProvider>
    </ClockProvider>
  );
}
