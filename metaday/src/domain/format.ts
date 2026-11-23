const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function formatNumber(value: number): string {
  return nf.format(value);
}

export const UNIT_PRESETS = ['km', 'horas', 'livros', 'R$'] as const;

export function formatQuantity(value: number, unit?: string): string {
  if (!unit) return formatNumber(value);
  if (unit === 'R$') return `R$ ${formatNumber(value)}`;
  return `${formatNumber(value)} ${unit}`;
}

/** "62 de 100 km" / "R$ 800 de R$ 5.000" / "62 km". */
export function formatProgressText(current: number, target: number | undefined, unit?: string): string {
  if (target === undefined) return formatQuantity(current, unit);
  if (unit === 'R$') return `R$ ${formatNumber(current)} de R$ ${formatNumber(target)}`;
  return `${formatNumber(current)} de ${formatNumber(target)}${unit ? ` ${unit}` : ''}`;
}

export const FREQUENCY_LABELS = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  flexible: 'Flexível',
} as const;

export const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' } as const;

export const MOOD_LABELS = {
  very_low: 'Muito mal',
  low: 'Mal',
  neutral: 'Ok',
  good: 'Bem',
  great: 'Ótimo',
} as const;
