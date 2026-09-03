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
- Texto, fotos, documentos e **áudios com transcrição e resumo sob demanda**.
- **Painel de mídias e documentos** por conversa: fotos, áudios, documentos e links
  organizados, com categorias automáticas (comprovante, contrato, planilha...) e etiquetas.
- Recibos ✓ ✓✓ ✓✓azul, online, visto por último, digitando, responder, apagar para todos.
- Bloqueio de contatos e empresas. Link de convite `https://seu-servidor/@usuario`.
- Notificações, contador no ícone, modo escuro, instalável como app.

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

Abra <http://localhost:3000>. Para testar, abra uma janela anônima e cadastre outro
número. Para testar atendimento: menu → *Minhas empresas* → cadastre um domínio, depois
na outra conta procure `@dominio` em *Nova conversa*.

Testes automatizados (API, webhooks, robô, Kanban, arquivos, transcrição, tempo real):

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
│   └── DECISOES.md    # decisões de produto (criptografia, antispam, descoberta)
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
