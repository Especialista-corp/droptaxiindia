import { describe, expect, it } from 'vitest';
import {
  DowngradeSelectionRequiredError,
  errorMessage,
  GoalNotActiveError,
  isDowngradeSelectionRequired,
  isPlanLimitError,
  NotFoundError,
  PlanLimitError,
  ValidationError,
} from '@/data/errors.ts';

describe('errorMessage — mensagens voltadas ao usuário', () => {
  it('erros de domínio usam sua própria mensagem', () => {
    expect(errorMessage(new PlanLimitError('free', 3))).toMatch(/até 3 objetivos ativos/i);
    expect(errorMessage(new NotFoundError('Objetivo', 'x'))).toMatch(/não encontrado/i);
    expect(errorMessage(new GoalNotActiveError())).toMatch(/não está ativo/i);
    expect(errorMessage(new ValidationError([{ path: 'title', message: 'Informe um título' }]))).toBe('Informe um título');
    expect(errorMessage(new DowngradeSelectionRequiredError(5, 3))).toMatch(/escolha até 3/i);
  });

  it('armazenamento cheio (QuotaExceededError) tem mensagem acionável, não genérica', () => {
    const msg = errorMessage(new DOMException('cota excedida', 'QuotaExceededError'));
    expect(msg).toMatch(/armazenamento.*cheio/i);
    expect(msg).toMatch(/configurações/i);
  });

  it('armazenamento indisponível (InvalidStateError/VersionError) orienta fechar outras abas', () => {
    expect(errorMessage(new DOMException('', 'InvalidStateError'))).toMatch(/outras abas/i);
    expect(errorMessage(new DOMException('', 'VersionError'))).toMatch(/outras abas/i);
  });

  it('erro genérico do navegador usa a própria mensagem; não-erro usa texto padrão', () => {
    expect(errorMessage(new Error('falha de rede'))).toBe('falha de rede');
    expect(errorMessage('string qualquer')).toBe('Algo deu errado. Tente novamente.');
    expect(errorMessage(undefined)).toBe('Algo deu errado. Tente novamente.');
  });

  it('type guards reconhecem só o próprio tipo', () => {
    expect(isPlanLimitError(new PlanLimitError('free', 3))).toBe(true);
    expect(isPlanLimitError(new Error('x'))).toBe(false);
    expect(isDowngradeSelectionRequired(new DowngradeSelectionRequiredError(5, 3))).toBe(true);
    expect(isDowngradeSelectionRequired(new PlanLimitError('free', 3))).toBe(false);
  });
});
