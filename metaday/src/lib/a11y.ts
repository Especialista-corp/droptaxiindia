import { useEffect, useRef } from 'react';

/**
 * Restaura o foco para quem o tinha antes de um Dialog/AlertDialog abrir.
 *
 * O Radix já faz isso por padrão, mas nesta combinação de versões (React 19 +
 * @radix-ui/react-dialog 1.3.1) a restauração interna às vezes falha e o foco cai em
 * `<body>` ao fechar — uma regressão real para quem navega só por teclado (verificado
 * em `tests/e2e/a11y.e2e.mjs`). Esta rede de segurança só age quando o foco de fato
 * se perdeu (foi para `<body>` ou sumiu), nunca sobrescrevendo uma restauração que já
 * funcionou.
 */
export function useRestoreFocusOnClose(open: boolean): void {
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      return;
    }
    const el = triggerRef.current;
    triggerRef.current = null;
    if (!(el instanceof HTMLElement)) return;
    const id = window.setTimeout(() => {
      const lost = document.activeElement === null || document.activeElement === document.body;
      if (lost && document.contains(el)) el.focus();
    }, 50);
    return () => window.clearTimeout(id);
  }, [open]);
}
