/**
 * Patrocinador permanente no rodapé (FREE e PREMIUM). No BETA 0.1 é um ESPAÇO RESERVADO
 * de demonstração — não há patrocinador real nem anúncios. Ocupa uma faixa própria no
 * fluxo do layout (nunca sobrepõe a navegação nem o conteúdo).
 */
export function SponsorBand() {
  return (
    <aside aria-label="Patrocinador (espaço de demonstração)" className="flex-none border-t border-border bg-chrome">
      <div className="mx-auto flex h-8 max-w-2xl items-center justify-center gap-2 px-4 text-[11px] text-dim">
        <span className="rounded border border-border-strong px-1.5 py-px font-semibold uppercase tracking-wide">
          Patrocinador
        </span>
        <span className="truncate">Espaço de demonstração</span>
      </div>
    </aside>
  );
}
