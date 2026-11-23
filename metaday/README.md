# METADAY — BETA 0.1

Aplicativo mobile-first (PWA) para definir objetivos com data-alvo, acompanhar a contagem regressiva, executar hábitos e registrar check-ins.
Esta é a **Entrega A + B** do PRD (`docs/PRD-MESTRE.md`): réplica visual + núcleo funcional, 100% local (IndexedDB), **sem conta, sem servidor, sem cobrança**.

> Este diretório vive em um subdiretório (`metaday/`) do repositório `droptaxiindia`, que contém um site estático não relacionado na raiz. Nada da raiz foi alterado.

## Requisitos
Node ≥ 22.18 e npm.

## Comandos
```bash
cd metaday
npm install
npm run dev          # desenvolvimento (http://localhost:5173)
npm run build        # typecheck + build de produção em dist/ (gera service worker)
npm run preview      # serve dist/ localmente
npm test             # testes unitários, de integração (IndexedDB) e de fluxo/navegação (Vitest)
npm run typecheck && npm run lint
npm run docs:status  # regenera docs/STATUS-BETA.md a partir de src/features/beta-status/statusData.ts
```
Testes em navegador real (Chromium; requer Playwright global e `npm run build`):
```bash
NODE_PATH="$(npm root -g)" node tests/e2e/layout.e2e.mjs [--shots]   # overflow/sobreposição em 320–desktop, 13 telas
NODE_PATH="$(npm root -g)" node tests/e2e/offline.e2e.mjs            # abre offline após a 1ª visita
NODE_PATH="$(npm root -g)" node scripts/make-icons.mjs               # regenera ícones PWA
```

## Deploy
Build estático (`dist/`) em qualquer host com **fallback de SPA para `index.html`** (Netlify/Vercel/Cloudflare Pages). Para subcaminho: `METADAY_BASE=/metaday/ npm run build`. GitHub Pages puro não tem fallback de SPA (rotas diretas dariam 404) — nenhum deploy foi realizado nesta entrega; não há URL de preview.

## Arquitetura
```
src/domain/        regras puras: datas/fuso, contagem, progresso/ritmo, plano, hábitos, relatórios, calendário
src/data/          interfaces de repositório + implementação IndexedDB transacional + seed de demonstração
src/app/           provedores (dados, relógio injetável), hooks de modelo/ações, rotas
src/features/      telas (home, goals, checkin, habits, countdown, calendar, reports, settings, beta-status, layout)
src/components/ui/ primitivos (Radix + Tailwind, estilo shadcn)
src/integrations/  reservado para Supabase/cobrança (Entrega D)
tests/             unit, integration, smoke (Vitest) e e2e (Playwright)
```
Regras críticas (limite de 3 objetivos ativos no FREE, único principal, check-in idempotente, downgrade sem perda) são aplicadas **na camada de dados, dentro de transações**, não só na UI. Trocar IndexedDB por Supabase = nova implementação de `DataLayer` (`src/data/repositories.ts`).

## Modos de dados
- **Local** (padrão): seus dados, no IndexedDB deste navegador.
- **Demonstração**: dados fictícios em banco separado; ative em Configurações ou na Home vazia.

## Estado e limitações
Veja `docs/STATUS-BETA.md` (e a tela *Configurações → Estado do beta*). Em resumo: Premium é simulação; patrocinador é espaço reservado; login, nuvem, cobrança, notificações, exportação PDF, IA e demais itens da Fase 1 seguem **pendentes (Entrega D)**.
