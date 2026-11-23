import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toCivilDate } from '@/domain/dates.ts';
import type { CivilDate } from '@/domain/types.ts';

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

const ClockContext = createContext<Clock>(systemClock);

/** Relógio injetável: testes fornecem um relógio fixo; a produção usa o do sistema. */
export function ClockProvider({ clock = systemClock, children }: { clock?: Clock; children: ReactNode }) {
  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

export function useClock(): Clock {
  return useContext(ClockContext);
}

/** Instante atual, atualizado a cada `intervalMs` (somente enquanto `enabled`). */
export function useNow(intervalMs = 1000, enabled = true): Date {
  const clock = useClock();
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(clock.now());
    const id = setInterval(() => setNow(clock.now()), intervalMs);
    return () => clearInterval(id);
  }, [clock, intervalMs, enabled]);
  return now;
}

/** Data civil de "hoje" no fuso do usuário; muda sozinha na virada do dia. */
export function useToday(timeZone: string): CivilDate {
  const clock = useClock();
  const [today, setToday] = useState<CivilDate>(() => toCivilDate(clock.now(), timeZone));
  useEffect(() => {
    const update = () => setToday(toCivilDate(clock.now(), timeZone));
    update();
    const id = setInterval(update, 15_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', update);
    };
  }, [clock, timeZone]);
  return useMemo(() => today, [today]);
}
