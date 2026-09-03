# ZapLivre

**Mensagens grátis, feitas para o Brasil.**

ZapLivre é um mensageiro de código aberto, sem anúncios e sem cobrança, pensado como
alternativa ao WhatsApp para brasileiros. Funciona como aplicativo instalável (PWA) no
celular e no computador, direto pelo navegador.

> ⚠️ Este é um MVP (produto mínimo viável). Veja a seção *Roteiro* para o que ainda falta
> antes de um lançamento público.

## Funcionalidades

- Cadastro pelo número de celular com código de verificação (SMS via webhook; em
  desenvolvimento o código aparece na tela).
- Conversas individuais e grupos (até 256 participantes) com administradores.
- Mensagens de texto e fotos (redimensionadas no aparelho antes de enviar).
- Confirmação de envio, entrega e leitura (✓, ✓✓, ✓✓ azul).
- "Online", "visto por último" e "digitando...".
- Responder mensagens e apagar para todos.
- Notificações no navegador/celular e ícone com contador de não lidas.
- Instalável como aplicativo (PWA) com funcionamento offline da interface.
- Interface 100% em português, modo claro e escuro, layout para celular e desktop.
- Sincronização com a agenda do celular (API de contatos do Chrome no Android).

## Rodando localmente

Requisitos: Node.js 22.13 ou superior (usa o SQLite embutido do Node, sem compilar nada).

```bash
cd zaplivre
npm install
npm run dev      # modo desenvolvimento: código de verificação aparece na tela
```

Abra <http://localhost:3000>. Para testar uma conversa, abra uma segunda janela anônima
e cadastre outro número.

Testes automatizados:

```bash
npm test
```

## Colocando em produção

```bash
PORT=3000 DB_FILE=/var/lib/zaplivre/zaplivre.db SMS_WEBHOOK_URL=https://seu-provedor/enviar npm start
```

| Variável          | Descrição                                                                          |
| ----------------- | ---------------------------------------------------------------------------------- |
| `PORT`            | Porta HTTP (padrão 3000).                                                          |
| `DB_FILE`         | Caminho do banco SQLite (padrão `data/zaplivre.db`).                               |
| `SMS_WEBHOOK_URL` | URL que recebe `POST {"to": "+55...", "message": "..."}` e dispara o SMS.          |
| `DEV_SHOW_OTP`    | `1` devolve o código na resposta da API. **Nunca use em produção.**                |

O webhook de SMS é propositalmente genérico: basta um pequeno adaptador para Zenvia,
Twilio, TotalVoice, Comtele ou qualquer outro provedor brasileiro.

Com Docker:

```bash
docker build -t zaplivre .
docker run -p 3000:3000 -v zaplivre-data:/app/data -e SMS_WEBHOOK_URL=... zaplivre
```

Coloque um proxy com HTTPS na frente (Caddy, Nginx ou o balanceador da nuvem). HTTPS é
obrigatório para PWA, notificações e acesso à agenda de contatos.

## Arquitetura

```
zaplivre/
├── server/
│   ├── index.js   # Express + Socket.IO, rotas REST e eventos em tempo real
│   ├── auth.js    # OTP por telefone, sessões
│   ├── chats.js   # conversas, grupos, mensagens, recibos
│   └── db.js      # esquema SQLite (node:sqlite) e utilitários
├── public/        # PWA: index.html, app.js, styles.css, sw.js, manifest, ícones
└── test/          # testes de API e tempo real (node:test)
```

Cliente e servidor se comunicam por REST (`/api/...`) para carregar dados e por
WebSocket (Socket.IO) para mensagens, recibos, presença e digitação.

## Roteiro até o lançamento

1. **Criptografia de ponta a ponta** (protocolo Signal ou X3DH + Double Ratchet). Hoje as
   mensagens ficam legíveis no servidor. Isso é o item mais importante antes de lançar.
2. **Áudio, vídeo e documentos** com armazenamento em objeto (S3 compatível) em vez de
   base64 no banco.
3. **Chamadas de voz e vídeo** via WebRTC.
4. **Aplicativos nativos** (Android/iOS) com notificações push do sistema. O PWA já cobre
   Android; no iPhone o PWA funciona com limitações de notificação.
5. **Escala**: trocar SQLite por PostgreSQL e usar o adaptador Redis do Socket.IO para
   rodar várias instâncias.
6. **Antiabuso**: denúncias, bloqueio de contatos, limites por conta.
7. **LGPD**: política de privacidade, exportação e exclusão de dados da conta.

## Avisos importantes

- **Marca**: "WhatsApp" é marca registrada da Meta. Não use o nome, o logotipo ou o visual
  idêntico do WhatsApp na divulgação. ZapLivre tem identidade própria.
- **Segurança**: sem criptografia de ponta a ponta o operador do servidor tem acesso às
  mensagens. Deixe isso claro aos usuários até o item 1 do roteiro estar pronto.
- **Licença**: AGPL-3.0. Quem hospedar uma versão modificada precisa disponibilizar o
  código.
