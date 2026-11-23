/**
 * Contagem regressiva.
 *
 * SEMÂNTICA DA DATA-ALVO (decisão documentada; ver docs/PRD-FASE-1.md §Lacunas):
 *  - A data-alvo é INCLUSIVA: o prazo termina no ÚLTIMO instante do dia-alvo
 *    (23:59:59.999 locais, no fuso configurado pelo usuário).
 *  - "Dias restantes" = diferença entre datas civis (alvo − hoje). No dia-alvo,
 *    dias restantes = 0 e o estado é "today" (ainda dá tempo até 23:59:59).
 *  - Após o dia-alvo, o estado é "past" e informamos há quantos dias o prazo passou.
 *  - O contador detalhado (d/h/m/s) usa relógio de parede no fuso do usuário até
 *    esse último instante. Por construção, `parts.days === daysRemaining` sempre.
 *    Em dias de troca de horário de verão o contador segue o relógio de parede
 *    (pode diferir 1h do tempo físico decorrido).
 */
import { addDays, diffDays, toCivilDate, wallClockMs, wallMidnightMs } from './dates.ts';
import type { CivilDate } from './types.ts';

export type CountdownState = 'future' | 'today' | 'past';

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export interface Countdown {
  state: CountdownState;
  /** Diferença de datas civis (alvo − hoje); 0 no dia-alvo; 0 quando passou. */
  daysRemaining: number;
  /** Dias desde o fim do prazo (0 se ainda não passou). */
  daysOverdue: number;
  parts: CountdownParts;
  /** ms de relógio de parede até o último instante do dia-alvo (0 se passou). */
  remainingMs: number;
}

const ZERO_PARTS: CountdownParts = { days: 0, hours: 0, minutes: 0, seconds: 0 };

export function splitDuration(ms: number): CountdownParts {
  if (ms <= 0) return { ...ZERO_PARTS };
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

export function getCountdown(targetDate: CivilDate, now: Date, timeZone: string): Countdown {
  const today = toCivilDate(now, timeZone);
  const delta = diffDays(today, targetDate);

  if (delta < 0) {
    return { state: 'past', daysRemaining: 0, daysOverdue: -delta, parts: { ...ZERO_PARTS }, remainingMs: 0 };
  }

  const lastInstantOfTargetDay = wallMidnightMs(addDays(targetDate, 1)) - 1;
  const remainingMs = Math.max(0, lastInstantOfTargetDay - wallClockMs(now, timeZone));
  return {
    state: delta === 0 ? 'today' : 'future',
    daysRemaining: delta,
    daysOverdue: 0,
    parts: splitDuration(remainingMs),
    remainingMs,
  };
}

export function pluralDays(n: number): string {
  return n === 1 ? '1 dia' : `${n} dias`;
}

/** Texto curto e humano: "Amanhã", "Hoje é o dia!", "Faltam 12 dias". */
export function describeCountdown(c: Countdown): string {
  if (c.state === 'today') return 'Hoje é o dia-alvo';
  if (c.state === 'past') return c.daysOverdue === 1 ? 'Prazo encerrado ontem' : `Prazo encerrado há ${c.daysOverdue} dias`;
  if (c.daysRemaining === 1) return 'Falta 1 dia';
  return `Faltam ${c.daysRemaining} dias`;
}
