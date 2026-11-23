import type { Countdown } from '@/domain/countdown.ts';
import { cn } from '@/lib/utils.ts';

const pad = (n: number) => String(n).padStart(2, '0');

/** Contador detalhado dias · horas · minutos · segundos (números tabulares; leitura única para leitores de tela). */
export function CountdownTiles({ countdown, className }: { countdown: Countdown; className?: string }) {
  const { days, hours, minutes, seconds } = countdown.parts;
  const items = [
    { value: String(days), label: days === 1 ? 'dia' : 'dias' },
    { value: pad(hours), label: 'horas' },
    { value: pad(minutes), label: 'min' },
    { value: pad(seconds), label: 'seg' },
  ];
  return (
    <div className={cn('grid grid-cols-4 gap-2', className)} role="group" aria-label="Contagem regressiva detalhada">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center rounded-xl border border-border bg-background px-1 py-2">
          <span className="tabular text-2xl font-bold leading-none text-accent" aria-hidden="true">
            {item.value}
          </span>
          <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted" aria-hidden="true">
            {item.label}
          </span>
        </div>
      ))}
      <span className="sr-only">
        {days} dias, {hours} horas, {minutes} minutos e {seconds} segundos restantes
      </span>
    </div>
  );
}
