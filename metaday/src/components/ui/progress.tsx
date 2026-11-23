import { cn } from '@/lib/utils.ts';

interface ProgressBarProps {
  /** 0–100; null = indeterminado (sem valor-alvo). */
  value: number | null;
  label: string;
  valueText?: string;
  tone?: 'accent' | 'muted';
  className?: string;
}

/** Barra de progresso acessível (role=progressbar). */
export function ProgressBar({ value, label, valueText, tone = 'accent', className }: ProgressBarProps) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className={cn('w-full', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null ? undefined : Math.round(pct)}
        aria-valuetext={valueText ?? (value === null ? 'Sem valor-alvo' : `${Math.round(pct)}%`)}
        className="h-2 w-full overflow-hidden rounded-full bg-background"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', tone === 'accent' ? 'bg-accent' : 'bg-muted')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
