export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDataAgendada(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** Dias inteiros restantes até o prazo (mínimo 0), ou null se não há prazo. */
export function diasRestantesAte(prazoIso: string | null) {
  if (!prazoIso) return null;
  return Math.max(0, Math.ceil((new Date(prazoIso).getTime() - Date.now()) / (24 * 3_600_000)));
}
