// Fonte única do "Estado do beta" (tela interna + docs/STATUS-BETA.md).
// Arquivo sem dependências de runtime: pode ser lido por `node scripts/gen-status-doc.ts`.

export type FeatureStatus = 'funcional' | 'demonstrativo' | 'pendente' | 'falhou';

export interface StatusItem {
  id: string;
  area: string;
  name: string;
  status: FeatureStatus;
  evidence: string;
}

export const STATUS_DATE = '2026-11-23';

export const STATUS_ITEMS: StatusItem[] = [];
