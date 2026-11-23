import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  diffDays,
  formatCivilPt,
  isValidCivilDate,
  startOfWeek,
  toCivilDate,
  weekdayOf,
  wallClockMs,
} from '@/domain/dates.ts';

describe('datas civis', () => {
  it('valida datas reais (inclui 29/02 só em ano bissexto)', () => {
    expect(isValidCivilDate('2028-02-29')).toBe(true);
    expect(isValidCivilDate('2027-02-29')).toBe(false);
    expect(isValidCivilDate('2026-13-01')).toBe(false);
    expect(isValidCivilDate('2026-1-1')).toBe(false);
  });

  it('diffDays ignora horário de verão (aritmética civil, não ms/86.400.000)', () => {
    // EUA: relógio avança em 2026-03-08; Brasil/Europa em outras datas — a conta civil é a mesma.
    expect(diffDays('2026-03-07', '2026-03-10')).toBe(3);
    expect(diffDays('2026-10-24', '2026-11-01')).toBe(8);
    expect(diffDays('2026-11-23', '2026-11-23')).toBe(0);
    expect(diffDays('2026-11-24', '2026-11-23')).toBe(-1);
  });

  it('ano bissexto e virada de mês/ano', () => {
    expect(diffDays('2028-02-28', '2028-03-01')).toBe(2);
    expect(diffDays('2027-02-28', '2027-03-01')).toBe(1);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('addMonths ajusta o dia ao último dia do mês quando necessário', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('dia da semana e início de semana configurável', () => {
    expect(weekdayOf('2026-11-23')).toBe(1); // segunda-feira
    expect(startOfWeek('2026-11-25', 1)).toBe('2026-11-23'); // semana começando na segunda
    expect(startOfWeek('2026-11-25', 0)).toBe('2026-11-22'); // semana começando no domingo
    expect(startOfWeek('2026-11-22', 1)).toBe('2026-11-16'); // domingo pertence à semana anterior (segunda-primeiro)
  });

  it('toCivilDate respeita o fuso do usuário', () => {
    const instant = new Date('2026-11-24T01:00:00Z');
    expect(toCivilDate(instant, 'America/Sao_Paulo')).toBe('2026-11-23');
    expect(toCivilDate(instant, 'Asia/Tokyo')).toBe('2026-11-24');
    expect(toCivilDate(instant, 'UTC')).toBe('2026-11-24');
  });

  it('wallClockMs devolve o horário de parede do fuso', () => {
    const instant = new Date('2026-11-24T01:00:00Z');
    expect(new Date(wallClockMs(instant, 'America/Sao_Paulo')).toISOString()).toBe('2026-11-23T22:00:00.000Z');
  });

  it('formata datas em pt-BR', () => {
    expect(formatCivilPt('2026-12-31')).toMatch(/31 de dez\.? de 2026/);
  });
});
