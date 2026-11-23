import { Lock } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.tsx';
import { Sheet } from '@/components/ui/sheet.tsx';
import { FREE_ACTIVE_GOAL_LIMIT } from '@/domain/plan.ts';

interface UpgradeContextValue {
  /** Abre a explicação do limite do plano Grátis (não coercitiva; nenhum dado é perdido). */
  promptUpgrade: () => void;
}

const UpgradeContext = createContext<UpgradeContextValue | null>(null);

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const promptUpgrade = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ promptUpgrade }), [promptUpgrade]);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <UpgradeContext.Provider value={value}>
      {children}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Limite do plano Grátis atingido"
        description={`O plano Grátis permite até ${FREE_ACTIVE_GOAL_LIMIT} objetivos ativos. Seus dados estão seguros: nada foi apagado.`}
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-background p-3 text-sm text-muted">
            <p className="font-semibold text-foreground">Para criar ou reativar outro objetivo</p>
            <p className="mt-1">Conclua, pause ou arquive um objetivo ativo: isso libera uma vaga e preserva todo o histórico.</p>
            <Button variant="secondary" className="mt-3 w-full" onClick={() => go('/metas')}>
              Ver meus objetivos
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-background p-3 text-sm text-muted">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <Lock className="size-4 text-accent" aria-hidden /> Premium: objetivos ativos ilimitados
            </p>
            <p className="mt-1">
              O Premium ainda <strong className="text-foreground">não está disponível para compra</strong> no BETA 0.1
              (não há cobrança integrada). Você pode testar o comportamento com a simulação local, sem custo.
            </p>
            <Button variant="outline" className="mt-3 w-full" onClick={() => go('/configuracoes#plano')}>
              Simular Premium em Configurações
            </Button>
          </div>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Agora não
          </Button>
        </div>
      </Sheet>
    </UpgradeContext.Provider>
  );
}

export function useUpgradePrompt(): UpgradeContextValue {
  const ctx = useContext(UpgradeContext);
  if (!ctx) throw new Error('useUpgradePrompt deve ser usado dentro de <UpgradeProvider>');
  return ctx;
}
