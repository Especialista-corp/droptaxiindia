# API pública do ZapLivre para robôs e integrações

Esta API existe para que empresas conectem assistentes de IA e automações (n8n, Typebot,
Make, LangChain ou qualquer ferramenta que fale HTTP) **sem risco de bloqueio**. Não há
taxa por mensagem: a empresa paga uma assinatura fixa mensal.

## Autenticação

Gere uma chave em *Empresa → Integrações → Gerar chave de API*. Envie em todas as
chamadas:

```
X-Api-Key: zl_live_...
```

Base: `https://SEU-SERVIDOR/api/v1`

## Receber mensagens (webhook)

Configure a URL em *Empresa → Integrações → Webhook*. O ZapLivre envia um `POST` JSON
para cada evento, assinado com HMAC-SHA256 do corpo no cabeçalho `X-ZapLivre-Signature`
(segredo mostrado ao salvar a URL).

| Evento                 | Quando                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| `conversation.opened`  | Um cliente iniciou conversa com a empresa.                             |
| `message.received`     | O cliente enviou uma mensagem **e o robô não está pausado**.           |
| `conversation.handoff` | Um atendente humano assumiu (`to: "human"`) ou devolveu (`to: "bot"`). |

Exemplo de `message.received`:

```json
{
  "event": "message.received",
  "workspaceId": "…",
  "sentAt": 1788470000000,
  "data": {
    "conversation": { "id": "…", "customer": { "id": "…", "handle": "@carlos", "name": "Carlos" }, "status": "open", "botPaused": false, "tags": [] },
    "message": { "id": "…", "conversationId": "…", "from": "…", "type": "text", "text": "Vocês têm bolo de cenoura?", "attachment": null, "createdAt": 1788470000000 }
  }
}
```

No n8n: nó **Webhook** (POST) → seu fluxo/IA → nó **HTTP Request** chamando o envio abaixo.

## Endpoints

| Método | Caminho                                | Descrição                                                        |
| ------ | -------------------------------------- | ---------------------------------------------------------------- |
| GET    | `/me`                                  | Dados da empresa e do usuário-robô.                              |
| GET    | `/conversations?status=open`           | Lista conversas (`open`, `in_progress`, `done`).                 |
| GET    | `/conversations/:id`                   | Uma conversa.                                                    |
| GET    | `/conversations/:id/messages?limit=50` | Histórico (`before=<timestamp>` para paginar).                   |
| POST   | `/conversations/:id/messages`          | Envia texto: `{"text": "Olá!"}`.                                 |
| POST   | `/conversations/:id/handoff`           | `{"to": "human"}` pausa o robô e pede humano; `{"to": "bot"}` volta. |
| PATCH  | `/conversations/:id`                   | `{"status": "done", "tags": ["encomenda"], "assigneeId": null}`. |

Exemplo:

```bash
curl -X POST https://SEU-SERVIDOR/api/v1/conversations/ID/messages \
  -H "X-Api-Key: zl_live_..." -H "Content-Type: application/json" \
  -d '{"text": "Temos sim! R$ 35."}'
```

## Regras antispam (valem para todos)

- A empresa **nunca inicia** conversa. Só responde a quem a procurou pelo `@dominio`,
  por link ou QR code. Isso mantém a aba Social livre de mensagens comerciais.
- Limite de envios por hora conforme o plano (contra abuso, não contra uso normal).
- O usuário pode bloquear a empresa a qualquer momento; envios passam a falhar com 403.

## Cobrança

`POST /api/billing/webhook` com cabeçalho `X-Billing-Secret` ativa o plano quando o
provedor de pagamento (Asaas, Pagar.me, Stripe, Mercado Pago) confirma:

```json
{ "reference": "<workspaceId>:<plano>", "months": 1, "provider": "asaas" }
```
