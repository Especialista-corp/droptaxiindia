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
- Deploy em Docker (VPS própria), com agendador de tarefas em container

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

## Tarefas automáticas (regras de negócio)

As rotas `/api/cron/*` implementam as regras automáticas. Na VPS quem as chama
é o container `cron` (`deploy/cron.sh`), pela rede interna do Docker, enviando
`Authorization: Bearer $CRON_SECRET`. Em produção, sem `CRON_SECRET` definido
as rotas respondem 503.

| Rota | Frequência | O que faz |
|---|---|---|
| `requeue-sinal-vencido` | a cada 15 min | devolve à fila o pedido cujo sinal não foi pago em 2h |
| `d1-realocacao` | a cada hora | tira o pedido do montador que não confirmou presença |
| `auto-release` | a cada hora | libera o pagamento 72h após as fotos, sem contestação |
| `d1-confirmacao` | 1x/dia (9h de Brasília) | pede ao montador para confirmar o serviço de amanhã |
| `documentos-vencidos` | 1x/dia (8h) | suspende quem não enviou os documentos em 7 dias |
| `uso-plataforma` | 1x/dia (9h) | avisa os admins quando o consumo do Supabase passa de 70% / 90% |
| `limpar-rastreamento` | 1x/dia (0h) | apaga posições de GPS com mais de 7 dias |

As chamadas de hora em hora também mantêm o projeto gratuito do Supabase
ativo (ele pausa após 7 dias sem consultas).

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

## Deploy (VPS com Docker)

O app roda como container Docker em uma VPS própria; o Supabase continua
sendo o banco/auth/storage. Não há dependência da Vercel.

```bash
cd deploy
cp ../.env.example .env        # preencha as chaves
docker compose up -d --build   # constrói a imagem e sobe app + agendador
```

- As variáveis `NEXT_PUBLIC_*` são embutidas no build: ao alterá-las é preciso
  reconstruir (`docker compose up -d --build`).
- O container `app` expõe a porta 3000 só na rede do Docker; o proxy reverso
  (Traefik) publica em HTTPS. Recomenda-se a Cloudflare na frente do domínio.
- Healthcheck: `GET /api/health`.
- Aplique as migrações de `supabase/migrations/` no projeto Supabase antes do
  primeiro deploy e a cada nova migração.

### Limites do plano do Supabase

O painel admin mostra o consumo de banco, arquivos e usuários ativos frente
aos limites do plano, e o cron `uso-plataforma` notifica os admins em 70% e
90%. Os limites vêm das variáveis `SUPABASE_LIMITE_*` (padrão: plano gratuito).
O tráfego (egress) não é mensurável por SQL — acompanhe no painel do Supabase.

As fotos são reduzidas no aparelho antes do envio (`src/lib/compress-image.ts`,
~350 KB cada), o que poupa o armazenamento e acelera o upload no 4G.

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
