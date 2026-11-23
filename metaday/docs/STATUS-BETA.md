# STATUS DO BETA 0.1

> Gerado por `npm run docs:status` a partir de `src/features/beta-status/statusData.ts`. **Não edite à mão.**
> Registro de 2026-11-23. Evidências vêm de testes automatizados do repositório, não de verificação em produção.

| Situação | Quantidade |
|---|---|
| Funcional | 17 |
| Demonstrativo | 3 |
| Pendente | 15 |
| Falhou | 0 |

## Funcional

| Área | Recurso | Evidência / observação |
|---|---|---|
| Início | Objetivo principal único com dias restantes, contador d/h/m/s, CTA e acesso a "Meus objetivos" | tests/smoke/app-flows.test.tsx (Home); captura 320–desktop em tests/e2e/layout.e2e.mjs |
| Início | Estados vazio, concluído (celebração sem contagem), prazo encerrado e sem principal | app-flows.test.tsx ("meta concluída com prazo futuro NÃO aparece como pendente", primeiro acesso) |
| Metas | Criar, editar, concluir, pausar, arquivar, restaurar, excluir (com confirmação) e filtros | tests/integration/goals.test.ts (21 testes) + app-flows.test.tsx |
| Metas | Um único objetivo principal; troca; promoção automática ao arquivar/pausar | goals.test.ts ("trocar o principal…", "arquivar o principal promove…") |
| Plano | FREE: máx. 3 objetivos ativos, validado na camada de dados (inclusive concorrência); liberar vaga ao concluir/arquivar | goals.test.ts (plano FREE…, criações concorrentes) + tests/unit/plan.test.ts |
| Plano | Downgrade sem exclusão: seleção de até 3 e suspensão reversível | goals.test.ts (downgrade Premium → Grátis) |
| Check-in | Registrar, corrigir, excluir; atualiza meta; idempotente (sem envio duplo) | tests/integration/checkins-habits.test.ts + app-flows.test.tsx (duplo clique) |
| Hábitos | CRUD, recorrência semanal, vínculo a metas, grade semanal, sequência e constância não punitivas, pausas | tests/unit/habits.test.ts (12) + checkins-habits.test.ts + app-flows.test.tsx |
| Contagem | Dias civis por fuso: hoje, amanhã, passado, bissexto, virada de mês/dia, fuso, horário de verão | tests/unit/countdown.test.ts (11) + dates.test.ts (8) |
| Metas | Progresso (0–100%, valor real preservado), tempo decorrido e ritmo/risco com critério explícito | tests/unit/progress.test.ts (12) |
| Calendário | Navegação por mês, marcadores (check-in, hábito, prazo), legenda, detalhe do dia, início da semana configurável | tests/unit/reports-calendar.test.ts + captura em 5 larguras |
| Relatórios | KPIs e gráfico de 14 dias a partir de registros reais; estado vazio; "como calculamos" | reports-calendar.test.ts + app-flows.test.tsx (gráfico real e estado vazio) |
| Dados | Persistência em IndexedDB com esquema versionado; recarregar mantém dados; demo e dados reais em bancos separados | goals.test.ts (persistência) e demo-data.test.ts (fake-indexeddb) |
| Dados | Restaurar demonstração com confirmação (só dados demo); exportar JSON; apagar dados | demo-data.test.ts + app-flows.test.tsx (restaurar). Exportar JSON: gerado via exportJson() testado; download no navegador não testado |
| Interface | Sem overflow horizontal em 320/360/390/412 px e desktop; nada sob a barra inferior; sem erros de console (13 telas) | tests/e2e/layout.e2e.mjs em Chromium (executado em 2026-11-23) |
| PWA | Manifest, ícones, service worker com pré-cache versionado; abre offline após a 1ª visita | tests/e2e/offline.e2e.mjs em Chromium (executado em 2026-11-23). Não testado: instalação em Android real, atualização entre versões |
| Configurações | Nome, início da semana e fuso horário persistidos | checkins-habits.test.ts (configurações) |

## Demonstrativo

| Área | Recurso | Evidência / observação |
|---|---|---|
| Plano | Premium é SIMULAÇÃO local (providerRef "demo-local"); nenhuma cobrança | O comportamento (ilimitado) é testado; o pagamento NÃO existe. A UI informa isso. |
| Interface | Faixa do patrocinador permanente (espaço reservado, sem patrocinador real) | Posição fixa sem sobrepor a navegação verificada no e2e; conteúdo é placeholder |
| Dados | Dados de demonstração fictícios relativos a "hoje" | demo-data.test.ts |

## Pendente

| Área | Recurso | Evidência / observação |
|---|---|---|
| Acessibilidade | Auditoria com leitor de tela, navegação só por teclado e contraste medido | Usamos rótulos/ARIA/Radix e áreas de toque ≥ 44px, mas não houve auditoria manual |
| Interface | Fidelidade visual às capturas do protótipo Lovable | As capturas não estavam acessíveis ao agente; foi seguido o PRD. Falta comparação lado a lado |
| Conta | Cadastro obrigatório, login (Google, e-mail, código, biometria), sessões | Entrega D. O beta é local, sem conta e sem falsa autenticação |
| Backend | Supabase (Auth, Postgres, RLS), sincronização multidispositivo e backup em nuvem | Entrega D. Interfaces de repositório prontas para a troca |
| Plano | Cobrança do Premium e webhooks | Entrega D; preço e fornecedor ainda indefinidos |
| Publicidade | Anúncios comuns, plataforma de anunciantes e patrocínio real | Entrega D |
| Lembretes | Lembretes/notificações (permissão + serviço) | Entrega D. A UI mostra o controle desabilitado "Em desenvolvimento" |
| Relatórios | Exportação PDF/XLSX/CSV/PNG/JPG e relatórios agendados | Entrega D. A UI mostra "Em desenvolvimento" sem botão |
| IA | Assistente IA, timeline enriquecida, centros de IA | Entrega D |
| Personalização | Idiomas EN/ES, tema claro, layouts, widgets, atalhos, menus personalizáveis (52A–52Q) | Entrega D; BETA 0.1 só PT-BR e tema escuro oficial |
| Android | Widgets, atalhos, notificações nativas, Play Store | Entrega D; exige implementação nativa |
| Metas | Marcos intermediários, histórico de alterações, reagendamento, recorrência de séries, biblioteca de hábitos/modelos | Decisões 38–44; entrega D |
| Empresa | Centros empresariais (suporte, DevOps, segurança, LGPD, governança, QA de IA…) | Decisões 50–51; entrega D |
| Privacidade | Central de privacidade completa, consentimentos, menores | Parcial: exportar/apagar dados locais existem; consentimentos não |
| Fase 2 | 52R e 52S (perfis e automações de perfis) | Fora do escopo aprovado; ver docs/PRD-FASE-2.md |
