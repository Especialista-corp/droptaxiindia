import { describe, expect, it } from 'vitest';
import { describeCountdown, getCountdown, splitDuration } from '@/domain/countdown.ts';

const SP = 'America/Sao_Paulo'; // UTC-3 (sem horário de verão desde 2019)

/** Instante a partir de um horário local de São Paulo (UTC-3). */
const sp = (iso: string) => new Date(`${iso}-03:00`);

describe('contagem regressiva — semântica do dia-alvo inclusivo', () => {
  it('hoje é o dia-alvo: 0 dias restantes, estado "today", contador até 23:59:59', () => {
    const c = getCountdown('2026-11-23', sp('2026-11-23T10:00:00.000'), SP);
    expect(c.state).toBe('today');
    expect(c.daysRemaining).toBe(0);
    expect(c.parts).toEqual({ days: 0, hours: 13, minutes: 59, seconds: 59 });
    expect(describeCountdown(c)).toBe('Hoje é o dia-alvo');
  });

  it('amanhã: 1 dia restante; dias do contador detalhado coincidem com os dias civis', () => {
    const c = getCountdown('2026-11-24', sp('2026-11-23T10:00:00.000'), SP);
    expect(c.state).toBe('future');
    expect(c.daysRemaining).toBe(1);
    expect(c.parts.days).toBe(1);
    expect(describeCountdown(c)).toBe('Falta 1 dia');
  });

  it('data passada: estado "past" com dias de atraso e contador zerado', () => {
    const c = getCountdown('2026-11-20', sp('2026-11-23T10:00:00.000'), SP);
    expect(c.state).toBe('past');
    expect(c.daysOverdue).toBe(3);
    expect(c.daysRemaining).toBe(0);
    expect(c.parts).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    expect(describeCountdown(c)).toBe('Prazo encerrado há 3 dias');
    expect(describeCountdown(getCountdown('2026-11-22', sp('2026-11-23T10:00:00.000'), SP))).toBe('Prazo encerrado ontem');
  });

  it('virada do dia: 23:59:59 ainda é o dia anterior; 00:00:00 já é o novo dia', () => {
    const before = getCountdown('2026-11-23', sp('2026-11-22T23:59:59.000'), SP);
    expect(before.daysRemaining).toBe(1);
    expect(before.state).toBe('future');
    const after = getCountdown('2026-11-23', sp('2026-11-23T00:00:00.000'), SP);
    expect(after.daysRemaining).toBe(0);
    expect(after.state).toBe('today');
    // parts.days SEMPRE igual a daysRemaining, inclusive à meia-noite exata.
    expect(after.parts.days).toBe(0);
    expect(after.parts.hours).toBe(23);
  });

  it('o dia-alvo termina no último instante: 23:59:59.999 ainda é "today"; 00:00:00 do dia seguinte é "past"', () => {
    const last = getCountdown('2026-11-23', sp('2026-11-23T23:59:59.999'), SP);
    expect(last.state).toBe('today');
    expect(last.remainingMs).toBe(0);
    const next = getCountdown('2026-11-23', sp('2026-11-24T00:00:00.000'), SP);
    expect(next.state).toBe('past');
    expect(next.daysOverdue).toBe(1);
  });

  it('ano bissexto', () => {
    expect(getCountdown('2028-03-01', sp('2028-02-28T12:00:00.000'), SP).daysRemaining).toBe(2);
    expect(getCountdown('2027-03-01', sp('2027-02-28T12:00:00.000'), SP).daysRemaining).toBe(1);
    expect(getCountdown('2028-03-01', sp('2028-02-29T12:00:00.000'), SP).daysRemaining).toBe(1);
  });

  it('mudança de mês e de ano', () => {
    expect(getCountdown('2026-12-01', sp('2026-11-30T08:00:00.000'), SP).daysRemaining).toBe(1);
    expect(getCountdown('2027-01-01', sp('2026-12-31T08:00:00.000'), SP).daysRemaining).toBe(1);
    expect(getCountdown('2027-01-01', sp('2026-11-23T08:00:00.000'), SP).daysRemaining).toBe(39);
  });

  it('fuso horário: o mesmo instante gera "hoje" diferente por fuso', () => {
    const instant = new Date('2026-11-24T01:00:00Z'); // 22:00 de 23/11 em SP; 10:00 de 24/11 em Tóquio
    expect(getCountdown('2026-11-24', instant, 'America/Sao_Paulo').daysRemaining).toBe(1);
    expect(getCountdown('2026-11-24', instant, 'Asia/Tokyo').daysRemaining).toBe(0);
    expect(getCountdown('2026-11-24', instant, 'Asia/Tokyo').state).toBe('today');
  });

  it('mudança de fuso do usuário altera o dia local sem alterar a data-alvo', () => {
    const instant = new Date('2026-11-23T23:30:00Z');
    expect(getCountdown('2026-11-24', instant, 'America/Sao_Paulo').daysRemaining).toBe(1); // 20:30 em SP
    expect(getCountdown('2026-11-24', instant, 'Europe/Lisbon').daysRemaining).toBe(1); // 23:30 em Lisboa
    expect(getCountdown('2026-11-24', instant, 'Asia/Tokyo').daysRemaining).toBe(0); // 08:30 de 24/11 em Tóquio
  });

  it('horário de verão não altera os dias civis restantes (EUA: 08/03/2026)', () => {
    const ny = 'America/New_York';
    const c = getCountdown('2026-03-10', new Date('2026-03-07T17:00:00Z'), ny);
    expect(c.daysRemaining).toBe(3);
    expect(c.parts.days).toBe(3);
  });

  it('splitDuration', () => {
    expect(splitDuration(90_061_000)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
    expect(splitDuration(-5)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
