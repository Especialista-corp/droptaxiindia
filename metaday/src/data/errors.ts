import type { PlanId } from '@/domain/types.ts';

export class MetadayError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'MetadayError';
    this.code = code;
  }
}

/** Tentativa de ter mais objetivos ativos do que o plano permite (validada na camada de dados). */
export class PlanLimitError extends MetadayError {
  readonly plan: PlanId;
  readonly limit: number;
  constructor(plan: PlanId, limit: number) {
    super(
      'PLAN_LIMIT',
      `O plano Grátis permite até ${limit} objetivos ativos. Conclua ou arquive um objetivo para liberar uma vaga — nenhum dado é perdido.`,
    );
    this.plan = plan;
    this.limit = limit;
  }
}

export class DowngradeSelectionRequiredError extends MetadayError {
  readonly activeCount: number;
  readonly limit: number;
  constructor(activeCount: number, limit: number) {
    super(
      'DOWNGRADE_SELECTION_REQUIRED',
      `Você tem ${activeCount} objetivos ativos. Escolha até ${limit} para manter ativos; os demais serão suspensos (sem exclusão) e podem ser reativados depois.`,
    );
    this.activeCount = activeCount;
    this.limit = limit;
  }
}

export class NotFoundError extends MetadayError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} não encontrado(a): ${id}`);
  }
}

export class GoalNotActiveError extends MetadayError {
  constructor(message = 'Este objetivo não está ativo.') {
    super('GOAL_NOT_ACTIVE', message);
  }
}

export class ValidationError extends MetadayError {
  readonly issues: { path: string; message: string }[];
  constructor(issues: { path: string; message: string }[]) {
    super('VALIDATION', issues.map((i) => i.message).join('; ') || 'Dados inválidos');
    this.issues = issues;
  }
}

export function isPlanLimitError(e: unknown): e is PlanLimitError {
  return e instanceof PlanLimitError;
}
export function isDowngradeSelectionRequired(e: unknown): e is DowngradeSelectionRequiredError {
  return e instanceof DowngradeSelectionRequiredError;
}

/** Nomes de DOMException relevantes do IndexedDB que merecem uma mensagem própria. */
const STORAGE_ERROR_NAMES = new Set(['QuotaExceededError', 'InvalidStateError', 'VersionError']);

export function errorMessage(e: unknown): string {
  if (e instanceof MetadayError) return e.message;
  if (e instanceof DOMException && STORAGE_ERROR_NAMES.has(e.name)) {
    return e.name === 'QuotaExceededError'
      ? 'O armazenamento deste dispositivo está cheio. Libere espaço (ou exporte e apague dados antigos em Configurações) e tente de novo.'
      : 'Não foi possível acessar o armazenamento local agora. Feche outras abas do METADAY e tente de novo.';
  }
  if (e instanceof Error) return e.message;
  return 'Algo deu errado. Tente novamente.';
}
