/**
 * Datas civis e fuso horário.
 *
 * Convenção: uma "data civil" é 'YYYY-MM-DD' sem fuso. Diferenças entre datas civis
 * são calculadas por aritmética em UTC sobre os componentes (NUNCA dividindo
 * milissegundos de instantes locais por 86.400.000), o que é imune a horário de verão.
 */
import type { CivilDate } from './types.ts';

const CIVIL_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export interface Ymd {
  y: number;
  m: number;
  d: number;
}

export function isValidCivilDate(value: string): boolean {
  const match = CIVIL_RE.exec(value);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function parseCivil(value: CivilDate): Ymd {
  const match = CIVIL_RE.exec(value);
  if (!match || !isValidCivilDate(value)) throw new RangeError(`Data civil inválida: ${value}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function pad(n: number, size = 2): string {
  return String(n).padStart(size, '0');
}

export function formatCivil(y: number, m: number, d: number): CivilDate {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

function civilToUtcMs(value: CivilDate): number {
  const { y, m, d } = parseCivil(value);
  return Date.UTC(y, m - 1, d);
}

function utcMsToCivil(ms: number): CivilDate {
  const dt = new Date(ms);
  return formatCivil(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(value: CivilDate, days: number): CivilDate {
  return utcMsToCivil(civilToUtcMs(value) + days * DAY_MS);
}

/** Dias entre duas datas civis: positivo quando `to` é posterior a `from`. */
export function diffDays(from: CivilDate, to: CivilDate): number {
  return Math.round((civilToUtcMs(to) - civilToUtcMs(from)) / DAY_MS);
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(value: CivilDate): number {
  return new Date(civilToUtcMs(value)).getUTCDay();
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(value: CivilDate, months: number): CivilDate {
  const { y, m, d } = parseCivil(value);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return formatCivil(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export function startOfMonth(value: CivilDate): CivilDate {
  const { y, m } = parseCivil(value);
  return formatCivil(y, m, 1);
}

/** Primeiro dia da semana (conforme `weekStartsOn`) que contém `value`. */
export function startOfWeek(value: CivilDate, weekStartsOn: 0 | 1): CivilDate {
  const offset = (weekdayOf(value) - weekStartsOn + 7) % 7;
  return addDays(value, -offset);
}

export function compareCivil(a: CivilDate, b: CivilDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Fuso horário
// ---------------------------------------------------------------------------

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function detectTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isValidTimeZone(tz) ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

interface ZonedParts {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const out: Record<string, number> = {};
  for (const part of getFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') out[part.type] = parseInt(part.value, 10);
  }
  return {
    y: out.year ?? 1970,
    m: out.month ?? 1,
    d: out.day ?? 1,
    h: (out.hour ?? 0) % 24,
    mi: out.minute ?? 0,
    s: out.second ?? 0,
  };
}

/** Data civil de um instante no fuso informado ("hoje" do usuário). */
export function toCivilDate(instant: Date, timeZone: string): CivilDate {
  const p = zonedParts(instant, timeZone);
  return formatCivil(p.y, p.m, p.d);
}

/**
 * "Relógio de parede": ms desde 1970 tratando os componentes locais (no fuso)
 * como se fossem UTC. Útil para diferenças dentro do calendário do usuário.
 */
export function wallClockMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const fraction = ((instant.getTime() % 1000) + 1000) % 1000;
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) + fraction;
}

/** Meia-noite (00:00:00) de uma data civil em "relógio de parede". */
export function wallMidnightMs(value: CivilDate): number {
  return civilToUtcMs(value);
}

// ---------------------------------------------------------------------------
// Formatação (pt-BR)
// ---------------------------------------------------------------------------

function utcDate(value: CivilDate): Date {
  return new Date(civilToUtcMs(value));
}

const ptDay = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const ptDayShort = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const ptLong = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const ptMonth = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long', year: 'numeric' });

export function formatCivilPt(value: CivilDate): string {
  return ptDay.format(utcDate(value));
}
export function formatCivilShortPt(value: CivilDate): string {
  return ptDayShort.format(utcDate(value));
}
export function formatCivilLongPt(value: CivilDate): string {
  return ptLong.format(utcDate(value));
}
export function formatMonthPt(value: CivilDate): string {
  const text = ptMonth.format(utcDate(value));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const WEEKDAY_LABELS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
export const WEEKDAY_LABELS_LONG = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

/** Ordem dos dias da semana (índices 0–6) começando em `weekStartsOn`. */
export function orderedWeekdays(weekStartsOn: 0 | 1): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
}
