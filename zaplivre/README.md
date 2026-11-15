# ZapLivre

**Mensagens grátis, feitas para o Brasil.**

ZapLivre é um mensageiro de código aberto, sem anúncios, gratuito para pessoas e com
assinatura fixa para empresas. Foi desenhado para resolver as dores do WhatsApp: mistura
de vida pessoal com trabalho e cobranças, exposição do número de telefone, cobrança por
mensagem e bloqueio de contas que usam automação.

Funciona como aplicativo instalável (PWA) no celular e no computador, pelo navegador.

> ⚠️ É um MVP avançado. Veja *Roteiro* para o que falta antes do lançamento público.

## O que o ZapLivre faz

### Para pessoas (grátis)

- **Identidade por @usuário.** O telefone serve só para confirmar que é você e nunca aparece
  para outras pessoas ou empresas. Amigos podem te achar pela agenda apenas se você permitir.
- **Três abas:** *Social* (amigos e família), *Trabalho* (equipes e projetos) e
  *Atendimento* (empresas). Empresas só existem na aba Atendimento; nunca poluem a Social.
- Conversas individuais e grupos (até 256 pessoas) com administradores.
- Texto, fotos, **vídeos**, documentos, **localização** e **áudios com transcrição e
  resumo sob demanda**.
- **Reações com emoji**, **encaminhar** para várias conversas, **fixar no topo**,
  **silenciar**, **arquivar** e **mensagens temporárias** (24 horas, 7 dias, 90 dias).
- **Painel de mídias e documentos** por conversa: fotos, áudios, documentos e links
  organizados, com categorias automáticas (comprovante, contrato, planilha...) e etiquetas.
- Recibos ✓ ✓✓ ✓✓azul, online, visto por último, digitando, responder, apagar para todos.
- Bloqueio de contatos e empresas. Link de convite `https://seu-servidor/@usuario`.
- **Aviso com o aplicativo fechado** (Web Push), contador no ícone, modo escuro,
  instalável como app.
- **Busca de mensagens** em todas as conversas, ignorando acento e maiúscula, com salto
  para a mensagem encontrada.
- **Modo convite** para piloto fechado, sem precisar contratar disparo de SMS.

### Para empresas (assinatura fixa, mensagens ilimitadas)

- **Identidade por domínio** (`@suaempresa.com.br`), verificado por registro DNS. Sem chip.
- **Sem taxa por mensagem.** Planos fixos mensais com 14 dias grátis.
- **API aberta e webhooks** para conectar robôs de n8n, Typebot, Make, LangChain ou qualquer
  ferramenta, sem risco de bloqueio. Documentação em [docs/API.md](docs/API.md).
- **Robô → humano com um clique.** O atendente vê a conversa da IA em tempo real, clica em
  *Assumir* e o robô para. *Devolver ao robô* reativa.
- **Painel Kanban** (Em aberto, Em atendimento, Concluído) com arrastar e soltar, etiquetas
  e responsável, dentro do próprio app.
- Vários atendentes por empresa, cada resposta identificada pelo nome do atendente.
- **Antispam de fábrica:** a empresa nunca inicia conversa, só responde a quem a procurou.
  Limite de envios por hora conforme o plano. Cliente pode bloquear.

## Rodando localmente

Requisitos: Node.js 22.13 ou superior (usa o SQLite embutido do Node, sem compilar nada).

```bash
cd zaplivre
npm install
npm run dev      # código de verificação aparece na tela
```

Para o piloto fechado, sem contratar SMS:

```bash
ACCESS_MODE=invite npm start
```

O servidor imprime no terminal o código de primeiro acesso. Quem o usar vira
administrador e passa a emitir convites pelo menu. Cada conta recebe um código de
recuperação, mostrado uma única vez, que é como ela volta a entrar depois.

Abra <http://localhost:3000>. Para testar, abra uma janela anônima e cadastre outro
número. Para testar atendimento: menu → *Minhas empresas* → cadastre um domínio, depois
na outra conta procure `@dominio` em *Nova conversa*.

### Em produção

```bash
cp .env.example .env    # preencha DOMINIO e EMAIL_HTTPS
docker compose up -d
```

HTTPS automático, backup diário e verificação de saúde já vêm configurados. O passo a
passo completo, para quem não é programador, está em [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md).

### Backup

```bash
npm run backup                                  # grava em data/backups
npm run restaurar data/backups/2026-11-14T16-00-00
```

O banco é copiado com `VACUUM INTO`, que gera um arquivo consistente mesmo com o servidor
rodando. Restaurar guarda o que estava no ar antes de sobrescrever.

Testes automatizados (API, webhooks, robô, Kanban, arquivos, transcrição, tempo real,
notificação, convites, busca, vídeo, localização, reações, encaminhar, temporárias):

```bash
npm test
```

## Colocando em produção

```bash
PORT=3000 DB_FILE=/var/lib/zaplivre/zaplivre.db SMS_WEBHOOK_URL=https://seu-provedor/enviar npm start
```

| Variável                 | Descrição                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `PORT`                   | Porta HTTP (padrão 3000).                                                            |
| `DB_FILE`                | Caminho do banco SQLite (padrão `data/zaplivre.db`).                                 |
| `UPLOAD_DIR`             | Pasta dos arquivos enviados (padrão `data/uploads`).                                 |
| `STORAGE_DRIVER`         | Onde gravar os arquivos novos: `local` (padrão) ou `s3`.                             |
| `S3_BUCKET`              | Bucket de um serviço compatível com S3 (AWS, R2, B2, MinIO, Wasabi).                 |
| `S3_ACCESS_KEY_ID`       | Chave de acesso do bucket. Vem com `S3_SECRET_ACCESS_KEY`.                           |
| `S3_REGION`              | Região (padrão `us-east-1`; no Cloudflare R2, `auto`).                               |
| `S3_ENDPOINT`            | Endereço do serviço, se não for a AWS. Usa o estilo `endpoint/bucket/arquivo`.       |
| `S3_PATH_STYLE`          | `0` troca para `bucket.endpoint/arquivo`. Só vale com `S3_ENDPOINT`.                 |
| `S3_PREFIX`              | Pasta dentro do bucket, para dividir o bucket com outros sistemas.                   |
| `SMS_WEBHOOK_URL`        | URL que recebe `POST {"to": "+55...", "message": "..."}` e dispara o SMS.            |
| `BILLING_WEBHOOK_SECRET` | Segredo do webhook do provedor de pagamento (`X-Billing-Secret`).                    |
| `OPENAI_API_KEY`         | Ativa transcrição de áudio (Whisper) e, com `SUMMARY_MODEL`, o resumo em tópicos.    |
| `OPENAI_BASE_URL`        | Endpoint compatível (padrão `https://api.openai.com/v1`; serve para Whisper próprio).|
| `TRANSCRIBE_WEBHOOK_URL` | Alternativa: seu próprio serviço que recebe o áudio e devolve `{"text": "..."}`.     |
| `DEV_SHOW_OTP`           | `1` devolve o código na resposta da API. **Nunca use em produção.**                  |

Com Docker:

```bash
docker build -t zaplivre .
docker run -p 3000:3000 -v zaplivre-data:/app/data -e SMS_WEBHOOK_URL=... zaplivre
```

Coloque um proxy com HTTPS na frente (Caddy, Nginx ou o balanceador da nuvem). HTTPS é
obrigatório para PWA, notificações, microfone e agenda de contatos.

## Arquitetura

```
zaplivre/
├── server/
│   ├── index.js       # Express + Socket.IO, rotas REST, API pública /api/v1, webhooks
│   ├── auth.js        # OTP por telefone, @usuário, sessões
│   ├── chats.js       # conversas, abas, grupos, mensagens, tickets, antispam, bloqueio
│   ├── workspaces.js  # empresas: domínio, DNS, atendentes, chave de API, webhook, planos
│   ├── files.js       # fotos, áudios, documentos, painel de mídias, transcrição
│   └── db.js          # esquema SQLite (node:sqlite) e migrações
├── public/            # PWA: index.html, app.js, styles.css, sw.js, manifest, ícones
├── docs/
│   ├── API.md         # API para robôs e integrações
│   ├── DECISOES.md    # decisões de produto (criptografia, antispam, descoberta)
│   └── PLANO-*.md     # planos aprovados: Cômodos, Baú, Chave Dupla, Segundo App
└── test/              # testes com node:test
```

## Roteiro até o lançamento

1. **Criptografia de ponta a ponta nas abas Social e Trabalho.** Atendimento continua
   legível pela empresa (como na API do WhatsApp Business). Ver `docs/DECISOES.md`.
2. **Chamadas de voz e vídeo** via WebRTC.
3. **Aplicativos nativos** (Android/iOS) com push do sistema. O PWA já cobre Android.
4. **Escala**: PostgreSQL, armazenamento S3 e adaptador Redis do Socket.IO.
5. **Antiabuso**: denúncias, reputação de empresas.
6. **LGPD**: política de privacidade, exportação e exclusão de dados.
7. **Nós prontos** para n8n e Make na loja de integrações deles.
8. **Mini-apps e formulários no chat** (pedidos, agendamento).

## Avisos importantes

- **Marca**: "WhatsApp" é marca registrada da Meta. ZapLivre tem nome e identidade próprios.
- **Segurança**: sem criptografia de ponta a ponta o operador do servidor tem acesso às
  mensagens. Deixe isso claro aos usuários até o item 1 do roteiro estar pronto.
- **Licença**: AGPL-3.0.
