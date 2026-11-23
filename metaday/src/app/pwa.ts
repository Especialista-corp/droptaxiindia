import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

/**
 * Registra o service worker (cache versionado pelo Workbox: cada build gera nova revisão
 * do pré-cache). Quando há versão nova, avisa e deixa o usuário decidir quando atualizar —
 * nunca recarrega sozinho no meio de um registro.
 */
export function registerPwa(): void {
  if (import.meta.env.DEV) return;
  const update = registerSW({
    onNeedRefresh() {
      toast('Nova versão disponível', {
        duration: Infinity,
        action: { label: 'Atualizar', onClick: () => void update(true) },
      });
    },
    onOfflineReady() {
      toast.success('Pronto para uso offline neste dispositivo.');
    },
  });
}
