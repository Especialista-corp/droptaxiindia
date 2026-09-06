# MontaJá — Marketplace de Montagem de Móveis (Fase 1 / MVP)

Web app (Next.js + Supabase) do "Uber dos Montadores": clientes agendam a
montagem de móveis, montadores aceitam ou contrapropõem, o pagamento fica
retido em garantia (Pix via Asaas) e o cliente acompanha o prestador chegando
em tempo real.

A modelagem é multi-categoria desde o dia 1 (`service_categories` /
`service_items`) — adicionar encanador, eletricista ou frete nas próximas
fases exige apenas cadastro de categoria/preços, sem refatoração.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Supabase (Postgres + Auth + Storage + Realtime)
- Asaas (Pix, escrow, split de comissão)
- Google Maps JS API (rastreamento ao vivo) — opcional
- Web Push + Resend (notificações) — opcionais
- PWA instalável (manifest + service worker)

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar o projeto Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Rode as migrações em `supabase/migrations/` (em ordem) no SQL Editor do
   projeto, ou via Supabase CLI:

   ```bash
   npx supabase link --project-ref <seu-project-ref>
   npx supabase db push
   ```

3. Isso cria o schema completo (usuários, prestadores, catálogo, pedidos,
   propostas, pagamentos, avaliações, rastreamento, notificações), as
   políticas de RLS, os buckets de Storage e o seed do catálogo de montagem
   de móveis com os preços de referência do mercado.
4. Em **Authentication → Providers**, habilite e-mail/senha. Para o fluxo de
   verificação de telefone via OTP, configure um provedor de SMS (Twilio) em
   **Authentication → Phone**.
5. Copie `Project URL`, `anon key` e `service_role key` para o `.env.local`.

### 3. Criar o primeiro admin

Depois de cadastrar um usuário normalmente pelo app, promova-o a admin
rodando no SQL Editor:

```sql
update public.users set role = 'admin' where email = 'voce@exemplo.com';
```

### 4. Configurar o Asaas (pagamentos)

1. Crie uma conta sandbox em [asaas.com](https://www.asaas.com/).
2. Gere uma API Key em **Integrações → API** e coloque em `ASAAS_API_KEY`.
3. Configure um webhook apontando para
   `https://<seu-dominio>/api/payments/webhook`, com os eventos
   `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_REFUNDED`,
   `PAYMENT_OVERDUE` e `PAYMENT_DELETED`. Defina um token de autenticação no
   webhook e replique em `ASAAS_WEBHOOK_TOKEN`.

### 5. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha. Apenas as variáveis do
Supabase e do Asaas são obrigatórias para o fluxo principal — Google Maps,
Web Push e Resend são opcionais e o app funciona com degradação graciosa
sem eles (mapa mostra aviso, notificações ficam só in-app).

### 6. Rodar localmente

```bash
npm run dev
```

## Cron jobs (regras de negócio automáticas)

As rotas abaixo implementam as regras de negócio 1, 2 e 3 da especificação
(sinal vencido, confirmação D-1, liberação automática após 72h). Em produção
na Vercel elas são acionadas pelo `vercel.json` já incluso no projeto. Para
rodar localmente ou em outro provedor, chame-as periodicamente com um cron
externo, enviando `Authorization: Bearer $CRON_SECRET`:

- `GET /api/cron/requeue-sinal-vencido` — a cada 15 min
- `GET /api/cron/d1-confirmacao` — 1x/dia
- `GET /api/cron/d1-realocacao` — a cada hora
- `GET /api/cron/auto-release` — a cada hora

## Estrutura

```
src/
  app/
    (auth)/            cadastro e login (cliente e prestador)
    cliente/           fluxo do cliente (novo pedido, pedidos, perfil)
    prestador/         fluxo do prestador (pedidos, agenda, carteira, perfil)
    admin/             painel administrativo
    api/               rotas de pagamento, webhook, push e cron
  components/          design system (botões, cards, bottom sheet, mapa)
  lib/                 Supabase clients, Asaas, regras de negócio, validação
  types/database.ts    tipos do schema Postgres
supabase/migrations/   schema SQL + RLS + seed do catálogo
```

## Deploy

1. Importe o repositório na [Vercel](https://vercel.com/new).
2. Configure as variáveis de ambiente (seção 5 acima) no projeto Vercel.
3. Defina `CRON_SECRET` no projeto — a Vercel injeta automaticamente o header
   `Authorization: Bearer $CRON_SECRET` nas chamadas de cron quando essa
   variável existe.
4. Deploy. Os cron jobs em `vercel.json` já ficam agendados automaticamente.

## O que falta para produção real

- Assets de ícone PNG (hoje o manifest usa um SVG placeholder em
  `public/icons/icon.svg`) — trocar pela identidade visual final.
- Integração de antecedentes/verificação documental do prestador (hoje é
  aprovação manual pelo admin olhando os documentos enviados).
- Split de pagamento via subcontas Asaas (hoje o repasse ao prestador é
  registrado internamente na carteira; o saque via Pix para a conta bancária
  cadastrada do prestador deve ser automatizado com Asaas Connect/subcontas).
- Verificação de telefone via OTP (requer provedor de SMS configurado no
  Supabase Auth).
