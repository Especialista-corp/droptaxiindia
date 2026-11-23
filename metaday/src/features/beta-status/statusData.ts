// Fonte única do "Estado do beta" (tela interna + docs/STATUS-BETA.md).
// Sem dependências de runtime: pode ser lido por `node scripts/gen-status-doc.ts`.
// REGRA: só marque "funcional" com teste automatizado ou verificação registrada na evidência.

export type FeatureStatus = 'funcional' | 'demonstrativo' | 'pendente' | 'falhou';

export interface StatusItem {
  id: string;
  area: string;
  name: string;
  status: FeatureStatus;
  evidence: string;
}

export const STATUS_DATE = '2026-11-23';

const F = 'funcional' as const;
const D = 'demonstrativo' as const;
const P = 'pendente' as const;

export const STATUS_ITEMS: StatusItem[] = [
  // ------------------------------------------------------------------ Funcional
  { id: 'home', area: 'Início', name: 'Objetivo principal único com dias restantes, contador d/h/m/s, CTA e acesso a "Meus objetivos"', status: F, evidence: 'tests/smoke/app-flows.test.tsx (Home); captura 320–desktop em tests/e2e/layout.e2e.mjs' },
  { id: 'home-states', area: 'Início', name: 'Estados vazio, concluído (celebração sem contagem), prazo encerrado e sem principal', status: F, evidence: 'app-flows.test.tsx ("meta concluída com prazo futuro NÃO aparece como pendente", primeiro acesso)' },
  { id: 'goals-crud', area: 'Metas', name: 'Criar, editar, concluir, pausar, arquivar, restaurar, excluir (com confirmação) e filtros', status: F, evidence: 'tests/integration/goals.test.ts (21 testes) + app-flows.test.tsx' },
  { id: 'primary', area: 'Metas', name: 'Um único objetivo principal; troca; promoção automática ao arquivar/pausar', status: F, evidence: 'goals.test.ts ("trocar o principal…", "arquivar o principal promove…")' },
  { id: 'plan-limit', area: 'Plano', name: 'FREE: máx. 3 objetivos ativos, validado na camada de dados (inclusive concorrência); liberar vaga ao concluir/arquivar', status: F, evidence: 'goals.test.ts (plano FREE…, criações concorrentes) + tests/unit/plan.test.ts' },
  { id: 'downgrade', area: 'Plano', name: 'Downgrade sem exclusão: seleção de até 3 e suspensão reversível', status: F, evidence: 'goals.test.ts (downgrade Premium → Grátis)' },
  { id: 'checkin', area: 'Check-in', name: 'Registrar, corrigir, excluir; atualiza meta; idempotente (sem envio duplo)', status: F, evidence: 'tests/integration/checkins-habits.test.ts + app-flows.test.tsx (duplo clique)' },
  { id: 'habits', area: 'Hábitos', name: 'CRUD, recorrência semanal, vínculo a metas, grade semanal, sequência e constância não punitivas, pausas', status: F, evidence: 'tests/unit/habits.test.ts (12) + checkins-habits.test.ts + app-flows.test.tsx' },
  { id: 'countdown', area: 'Contagem', name: 'Dias civis por fuso: hoje, amanhã, passado, bissexto, virada de mês/dia, fuso, horário de verão', status: F, evidence: 'tests/unit/countdown.test.ts (11) + dates.test.ts (8)' },
  { id: 'progress', area: 'Metas', name: 'Progresso (0–100%, valor real preservado), tempo decorrido e ritmo/risco com critério explícito', status: F, evidence: 'tests/unit/progress.test.ts (12)' },
  { id: 'calendar', area: 'Calendário', name: 'Navegação por mês, marcadores (check-in, hábito, prazo), legenda, detalhe do dia, início da semana configurável', status: F, evidence: 'tests/unit/reports-calendar.test.ts + captura em 5 larguras' },
  { id: 'reports', area: 'Relatórios', name: 'KPIs e gráfico de 14 dias a partir de registros reais; estado vazio; "como calculamos"', status: F, evidence: 'reports-calendar.test.ts + app-flows.test.tsx (gráfico real e estado vazio)' },
  { id: 'persistence', area: 'Dados', name: 'Persistência em IndexedDB com esquema versionado; recarregar mantém dados; demo e dados reais em bancos separados', status: F, evidence: 'goals.test.ts (persistência) e demo-data.test.ts (fake-indexeddb)' },
  { id: 'demo-reset', area: 'Dados', name: 'Restaurar demonstração com confirmação (só dados demo); exportar JSON; apagar dados', status: F, evidence: 'demo-data.test.ts + app-flows.test.tsx (restaurar). Exportar JSON: gerado via exportJson() testado; download no navegador não testado' },
  { id: 'layout', area: 'Interface', name: 'Sem overflow horizontal em 320/360/390/412 px e desktop; nada sob a barra inferior; sem erros de console (13 telas)', status: F, evidence: 'tests/e2e/layout.e2e.mjs em Chromium (executado em 2026-11-23)' },
  { id: 'pwa-offline', area: 'PWA', name: 'Manifest, ícones, service worker com pré-cache versionado; abre offline após a 1ª visita', status: F, evidence: 'tests/e2e/offline.e2e.mjs em Chromium (executado em 2026-11-23). Não testado: instalação em Android real, atualização entre versões' },
  { id: 'a11y-automated', area: 'Acessibilidade', name: 'Varredura automatizada (axe-core, WCAG 2.1 A/AA) nas 13 telas; navegação só por teclado nos fluxos críticos', status: F, evidence: 'tests/e2e/a11y.e2e.mjs em Chromium (executado em 2026-11-23): 0 violações; skip-link, abrir/fechar "Mais" com teclado e criar objetivo via Tab/Enter verificados' },
  { id: 'settings', area: 'Configurações', name: 'Nome, início da semana e fuso horário persistidos', status: F, evidence: 'checkins-habits.test.ts (configurações)' },

  // -------------------------------------------------------------- Demonstrativo
  { id: 'premium-sim', area: 'Plano', name: 'Premium é SIMULAÇÃO local (providerRef "demo-local"); nenhuma cobrança', status: D, evidence: 'O comportamento (ilimitado) é testado; o pagamento NÃO existe. A UI informa isso.' },
  { id: 'sponsor', area: 'Interface', name: 'Faixa do patrocinador permanente (espaço reservado, sem patrocinador real)', status: D, evidence: 'Posição fixa sem sobrepor a navegação verificada no e2e; conteúdo é placeholder' },
  { id: 'demo-data', area: 'Dados', name: 'Dados de demonstração fictícios relativos a "hoje"', status: D, evidence: 'demo-data.test.ts' },

  // ------------------------------------------------------------------- Pendente
  { id: 'a11y-manual', area: 'Acessibilidade', name: 'Auditoria manual com leitor de tela real (NVDA/VoiceOver/TalkBack) e contraste medido', status: P, evidence: 'Só foi feita auditoria automatizada (abaixo); leitura humana com leitor de tela ainda não ocorreu' },
  { id: 'error-handling', area: 'Robustez', name: 'Falha de renderização não derruba o app; falha de armazenamento tem tela explicativa', status: F, evidence: 'tests/smoke/robustness.test.tsx (ErrorBoundary, abertura do IndexedDB falhando); mensagens específicas para QuotaExceededError/InvalidStateError em src/data/errors.ts' },
  { id: 'visual-fidelity', area: 'Interface', name: 'Fidelidade visual às capturas do protótipo Lovable', status: P, evidence: 'As capturas não estavam acessíveis ao agente; foi seguido o PRD. Falta comparação lado a lado' },
  { id: 'auth', area: 'Conta', name: 'Cadastro obrigatório, login (Google, e-mail, código, biometria), sessões', status: P, evidence: 'Entrega D. O beta é local, sem conta e sem falsa autenticação' },
  { id: 'backend', area: 'Backend', name: 'Supabase (Auth, Postgres, RLS), sincronização multidispositivo e backup em nuvem', status: P, evidence: 'Entrega D. Interfaces de repositório prontas para a troca' },
  { id: 'billing', area: 'Plano', name: 'Cobrança do Premium e webhooks', status: P, evidence: 'Entrega D; preço e fornecedor ainda indefinidos' },
  { id: 'ads', area: 'Publicidade', name: 'Anúncios comuns, plataforma de anunciantes e patrocínio real', status: P, evidence: 'Entrega D' },
  { id: 'notifications', area: 'Lembretes', name: 'Lembretes/notificações (permissão + serviço)', status: P, evidence: 'Entrega D. A UI mostra o controle desabilitado "Em desenvolvimento"' },
  { id: 'export', area: 'Relatórios', name: 'Exportação PDF/XLSX/CSV/PNG/JPG e relatórios agendados', status: P, evidence: 'Entrega D. A UI mostra "Em desenvolvimento" sem botão' },
  { id: 'ai', area: 'IA', name: 'Assistente IA, timeline enriquecida, centros de IA', status: P, evidence: 'Entrega D' },
  { id: 'i18n-theme', area: 'Personalização', name: 'Idiomas EN/ES, tema claro, layouts, widgets, atalhos, menus personalizáveis (52A–52Q)', status: P, evidence: 'Entrega D; BETA 0.1 só PT-BR e tema escuro oficial' },
  { id: 'android', area: 'Android', name: 'Widgets, atalhos, notificações nativas, Play Store', status: P, evidence: 'Entrega D; exige implementação nativa' },
  { id: 'milestones', area: 'Metas', name: 'Marcos intermediários, histórico de alterações, reagendamento, recorrência de séries, biblioteca de hábitos/modelos', status: P, evidence: 'Decisões 38–44; entrega D' },
  { id: 'enterprise', area: 'Empresa', name: 'Centros empresariais (suporte, DevOps, segurança, LGPD, governança, QA de IA…)', status: P, evidence: 'Decisões 50–51; entrega D' },
  { id: 'privacy-center', area: 'Privacidade', name: 'Central de privacidade completa, consentimentos, menores', status: P, evidence: 'Parcial: exportar/apagar dados locais existem; consentimentos não' },
  { id: 'phase2', area: 'Fase 2', name: '52R e 52S (perfis e automações de perfis)', status: P, evidence: 'Fora do escopo aprovado; ver docs/PRD-FASE-2.md' },
];
