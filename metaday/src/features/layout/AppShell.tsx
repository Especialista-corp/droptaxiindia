import { User } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useData } from '@/app/data.tsx';
import { UpgradeProvider } from '@/features/shared/UpgradeProvider.tsx';
import { BottomNav } from './BottomNav.tsx';
import { Sidebar } from './Sidebar.tsx';
import { SponsorBand } from './SponsorBand.tsx';
import { Wordmark } from './Wordmark.tsx';

export function AppShell() {
  const { mode } = useData();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // A cada NAVEGAÇÃO (não no carregamento inicial): volta ao topo e move o foco para o
  // conteúdo, para leitores de tela anunciarem a troca de tela. No carregamento inicial o
  // foco fica no topo do documento, para que o link "Ir para o conteúdo" seja alcançável
  // pelo primeiro Tab (senão o auto-foco "rouba" esse primeiro Tab).
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    el.scrollTo?.({ top: 0 });
    el.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <UpgradeProvider>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-foreground"
      >
        Ir para o conteúdo
      </a>
      <div className="flex h-dvh w-full overflow-hidden bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="pt-safe flex-none border-b border-border bg-chrome md:hidden">
            <div className="flex h-14 items-center justify-between px-4">
              <Wordmark />
              <Link
                to="/configuracoes"
                aria-label="Perfil e configurações"
                className="inline-flex size-11 items-center justify-center rounded-xl text-muted hover:bg-card-2 hover:text-foreground"
              >
                <User className="size-5" aria-hidden />
              </Link>
            </div>
          </header>
          {mode === 'demo' && (
            <div
              role="status"
              className="flex-none bg-accent/15 px-4 py-1.5 text-center text-xs font-semibold text-accent"
              data-testid="demo-ribbon"
            >
              Modo demonstração · dados fictícios
            </div>
          )}
          <main id="conteudo" ref={mainRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden outline-none">
            <div className="mx-auto w-full max-w-2xl px-4 py-5 md:py-8">
              <Outlet />
            </div>
          </main>
          <SponsorBand />
          <BottomNav />
        </div>
      </div>
    </UpgradeProvider>
  );
}
