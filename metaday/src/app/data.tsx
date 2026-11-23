import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dbNameFor } from '@/data/idb/db.ts';
import { createIdbDataLayer } from '@/data/idb/createIdbDataLayer.ts';
import type { DataLayer } from '@/data/repositories.ts';
import type { DataMode } from '@/domain/types.ts';
import { useClock } from './clock.tsx';

const MODE_KEY = 'metaday:mode';

export function readStoredMode(): DataMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'local';
  } catch {
    return 'local';
  }
}

function storeMode(mode: DataMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* armazenamento indisponível: o modo vale só nesta sessão */
  }
}

interface DataContextValue {
  mode: DataMode;
  layer: DataLayer;
  setMode: (mode: DataMode) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

interface DataProviderProps {
  children: ReactNode;
  /** Camada já criada (testes). Quando presente, não abre o IndexedDB. */
  layer?: DataLayer;
  initialMode?: DataMode;
}

/**
 * Abre o banco correspondente ao modo (local ou demonstração) e o expõe aos componentes.
 * Os dois modos usam bancos IndexedDB distintos: demo nunca se mistura com dados reais.
 */
export function DataProvider({ children, layer: injected, initialMode }: DataProviderProps) {
  const clock = useClock();
  const [mode, setModeState] = useState<DataMode>(() => injected?.mode ?? initialMode ?? readStoredMode());
  const [layer, setLayer] = useState<DataLayer | null>(injected ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (injected) return;
    let cancelled = false;
    let opened: DataLayer | null = null;
    setLayer(null);
    setError(null);
    (async () => {
      try {
        const next = await createIdbDataLayer({ dbName: dbNameFor(mode), mode, now: () => clock.now() });
        if (mode === 'demo' && (await next.admin.isEmpty())) await next.admin.seedDemo();
        if (cancelled) {
          next.close();
          return;
        }
        opened = next;
        setLayer(next);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao abrir o armazenamento local.');
      }
    })();
    return () => {
      cancelled = true;
      opened?.close();
    };
  }, [mode, injected, clock]);

  const setMode = useCallback((next: DataMode) => {
    storeMode(next);
    setModeState(next);
  }, []);

  const value = useMemo(() => (layer ? { mode, layer, setMode } : null), [mode, layer, setMode]);

  if (error) {
    return (
      <div role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-bold">Não foi possível abrir o armazenamento deste dispositivo</h1>
        <p className="text-sm text-muted">
          O METADAY BETA 0.1 guarda os dados no navegador (IndexedDB). Verifique se o armazenamento não está bloqueado
          (por exemplo, em janela privada) e recarregue a página.
        </p>
        <p className="text-xs text-dim">{error}</p>
      </div>
    );
  }
  if (!value) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-dvh items-center justify-center text-sm text-muted">
        Carregando METADAY…
      </div>
    );
  }
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData deve ser usado dentro de <DataProvider>');
  return ctx;
}
