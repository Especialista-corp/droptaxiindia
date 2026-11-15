# Plano Chave Dupla

**"Meu número, minhas regras."**

Status: aprovado, aguardando execução. Nenhuma etapa deste plano foi implementada ainda.

## 1. Objetivo

Transformar a maior dor do WhatsApp (entregar o telefone para uma empresa e nunca mais
conseguir tomá-lo de volta) no principal motivo para alguém migrar para o ZapLivre.

Cada pessoa tem duas chaves:

- **@usuário**: pública, é como as pessoas e empresas te encontram.
- **Telefone**: privada, verificada por SMS, única por conta (como um CPF). Só aparece
  para quem você autorizar.

Empresas têm a obrigação inversa: são sempre transparentes, com @domínio e telefone
comercial verificado visíveis para todo mundo.

## 2. Regra de visibilidade

| Quem está olhando | Vê o @usuário | Vê o telefone |
| --- | --- | --- |
| Amigos e família (aba Social) | Sim | Sim, por padrão. A pessoa pode desligar. |
| Empresas (aba Atendimento) | Sim | **Não**, a menos que a pessoa libere. |
| Empresa com liberação ativa | Sim | Sim, pelo prazo escolhido pela pessoa. |
| Qualquer um olhando uma empresa | Sim (@domínio) | **Sim, sempre** (telefone comercial verificado). |

## 3. Regras de negócio

1. O telefone continua obrigatório e verificado por SMS no cadastro. Nada muda aí.
2. Contatos pessoais veem o telefone quando existe conversa na aba Social entre os dois e a
   pessoa mantém ligada a opção "amigos veem meu número" (ligada por padrão).
3. Empresas nunca recebem o telefone por padrão, nem pela interface, nem pela API dos robôs,
   nem pelo webhook.
4. A pessoa pode liberar o telefone para uma empresa específica com prazo: **só hoje**,
   **7 dias**, **até concluir este atendimento** ou **sempre**. Pode revogar a qualquer momento.
5. Liberação "até concluir este atendimento" cai automaticamente quando o ticket vai para
   "Concluído" no Kanban.
6. A empresa pode **solicitar** o telefone, com um motivo em texto. A pessoa aprova ou nega
   com um toque. Pedido negado não pode ser repetido por 7 dias.
7. Toda consulta ao telefone por uma empresa é registrada (quem, quando, por qual canal:
   interface, API ou webhook).
8. Para criar uma empresa, o responsável confirma um **telefone comercial** por SMS. Ele fica
   visível no perfil da empresa para todos. CNPJ é opcional, mas quando informado aparece no
   perfil.
9. Bloquear uma empresa revoga qualquer liberação ativa na mesma hora.
10. A pessoa pode exportar e apagar o histórico de liberações (base para a LGPD).

## 4. Etapas de execução

### Etapa 0. Preparação (meio dia)

- Revisar `publicUser()` em `server/auth.js`: hoje ele nunca devolve telefone. Passará a
  receber o contexto de quem está olhando.
- Criar função central `phoneVisibleTo(ownerId, viewerId, contexto)` em um novo módulo
  `server/privacy.js`. Toda exibição de telefone passa por ela. Nenhum outro lugar decide.
- Critério de aceite: teste unitário cobrindo as quatro linhas da tabela de visibilidade.

### Etapa 1. Amigos veem o número (meio dia)

- Preferência `friends_see_phone` no usuário (padrão ligado), editável no perfil.
- Telefone aparece nos dados do contato (painel "Dados da conversa") quando há conversa
  Social entre os dois e a preferência está ligada.
- Critério de aceite: Ana e Bia em conversa Social veem o telefone uma da outra; Ana desliga
  a opção e Bia deixa de ver; uma empresa nunca vê.

### Etapa 2. Liberação com prazo para empresas (1 dia)

- Tabela `phone_grants`: pessoa, empresa, tipo de prazo, expira em, ligada ao ticket (quando
  for "até concluir"), criada em, revogada em.
- Endpoints: criar liberação, listar minhas liberações, revogar.
- Botão "Liberar meu telefone" no painel da conversa de Atendimento, com as quatro opções de
  prazo. Faixa no topo do chat mostrando "Telefone liberado até ...".
- Ao mudar ticket para "Concluído", revogar liberações do tipo "até concluir".
- Bloquear empresa revoga liberações.
- Critério de aceite: teste ponta a ponta com liberação de 7 dias, consulta pela empresa
  (interface e API), revogação, e queda automática ao concluir o ticket.

### Etapa 3. A empresa pede, a pessoa decide (1 dia)

- Tabela `phone_requests`: empresa, pessoa, motivo, status (pendente, aprovado, negado),
  criada em, respondida em.
- Endpoint e botão "Solicitar telefone" para atendentes e para a API dos robôs.
- Cartão no chat da pessoa com o motivo e dois botões: "Liberar por 7 dias" e "Não".
- Pedido negado bloqueia novo pedido da mesma empresa por 7 dias.
- Critério de aceite: fluxo completo pedido, aprovação, exibição e negação com bloqueio de
  novo pedido.

### Etapa 4. Painel "Quem tem meu número" e registro de uso (1 dia)

- Tabela `phone_access_log`: empresa, pessoa, canal (interface, api, webhook), quando.
- Tela no perfil: lista de empresas com liberação ativa, desde quando, quantas vezes
  consultaram, botão "Revogar" em cada uma. Histórico de liberações passadas.
- Exportar em JSON e apagar histórico.
- Critério de aceite: cada consulta pela empresa gera uma linha; revogar pela tela faz a
  empresa perder o acesso imediatamente.

### Etapa 5. Empresa transparente por obrigação (1 dia)

- Cadastro de empresa exige telefone comercial confirmado por SMS antes de ficar visível
  nas buscas. CNPJ opcional com validação de dígitos.
- Perfil público da empresa mostra @domínio, telefone comercial, CNPJ (se houver), selo de
  domínio verificado e data de cadastro.
- API pública: `GET /api/v1/me` devolve o telefone comercial; nunca o de clientes sem
  liberação.
- Critério de aceite: empresa sem telefone confirmado não aparece em buscas; perfil
  público exibe os dados; API devolve telefone do cliente só com liberação ativa.

### Etapa 6. Documentação, marketing e lançamento (meio dia)

- Atualizar `README.md`, `docs/API.md` (campo `phone` condicional) e `docs/DECISOES.md`.
- Texto da página inicial e do onboarding: "No WhatsApp você entrega seu número para a
  loja para sempre. No ZapLivre você empresta e toma de volta."
- Tela de boas-vindas no primeiro acesso explicando as duas chaves em três passos.

**Total estimado: 5 a 6 dias de trabalho.**

## 5. Modelo de dados (resumo)

```
users            + friends_see_phone INTEGER DEFAULT 1
workspaces       + commercial_phone TEXT, commercial_phone_verified INTEGER, cnpj TEXT
phone_grants     id, user_id, workspace_id, scope ('today'|'7d'|'ticket'|'always'),
                 chat_id (quando scope = 'ticket'), expires_at, created_at, revoked_at
phone_requests   id, workspace_id, user_id, chat_id, reason, status, created_at, answered_at
phone_access_log id, workspace_id, user_id, channel ('ui'|'api'|'webhook'), created_at
```

## 6. API (resumo)

| Método | Caminho | Quem usa |
| --- | --- | --- |
| PATCH | `/api/me` (`friendsSeePhone`) | Pessoa |
| POST | `/api/workspaces/:id/phone-grant` (`scope`, `chatId`) | Pessoa |
| GET | `/api/me/phone-grants` | Pessoa |
| DELETE | `/api/phone-grants/:id` | Pessoa |
| GET | `/api/me/phone-access-log` | Pessoa |
| POST | `/api/chats/:id/phone-request` (`reason`) | Atendente |
| POST | `/api/v1/conversations/:id/phone-request` (`reason`) | Robô |
| POST | `/api/phone-requests/:id/answer` (`approve`, `scope`) | Pessoa |
| POST | `/api/workspaces/:id/commercial-phone` e `/verify-phone` | Dono da empresa |

## 7. Telas

1. Perfil: opção "Amigos podem ver meu número" e link "Quem tem meu número".
2. Dados da conversa (Social): telefone do contato quando permitido.
3. Dados da conversa (Atendimento): telefone comercial da empresa, botão "Liberar meu
   telefone" com prazos, ou "Revogar" quando ativo.
4. Chat de Atendimento: faixa "Telefone liberado até ..." e cartão de pedido da empresa.
5. Painel "Quem tem meu número": lista, contadores, revogar, histórico, exportar, apagar.
6. Cadastro de empresa: telefone comercial com código SMS e CNPJ opcional.
7. Boas-vindas: três passos explicando as duas chaves.

## 8. Testes

- Unitários em `phoneVisibleTo` para todas as combinações.
- API: liberação, expiração, revogação, queda ao concluir ticket, pedido e resposta, registro
  de acesso, bloqueio revogando, API dos robôs sem telefone por padrão.
- Ponta a ponta no Chromium: pessoa libera por 7 dias, empresa vê, pessoa revoga, empresa
  deixa de ver.

## 9. Riscos e decisões que ficam para a execução

- **Custo de SMS**: verificar telefone comercial gera um SMS por empresa. Aceitável.
- **"Sempre"**: liberação permanente pode virar arrependimento. Mostrar aviso e lembrar a
  pessoa a cada 90 dias com opção de revogar.
- **Amigos**: a regra "há conversa Social entre os dois" é simples e cobre o caso comum, mas
  alguém adicionado a um grupo Social não vê o telefone. Decidir se grupo conta.
- **LGPD**: o registro de liberações é consentimento documentado. Guardar o texto exibido
  na hora da liberação junto com a linha.
- **Ligações**: hoje não há chamadas no app. Quando houver (WebRTC), permitir ligação
  interna sem liberar o número, o que enfraquece ainda mais a necessidade de entregar o
  telefone.

## 10. Depois deste plano

Ordem sugerida para as próximas frentes, já aprovadas em conceito:

1. Criptografia de ponta a ponta nas abas Social e Trabalho.
2. Chamadas de voz e vídeo por WebRTC (ligação interna sem número).
3. Aplicativos nativos com push do sistema.
4. Escala: PostgreSQL, armazenamento S3, Redis para o Socket.IO.
5. Denúncias e reputação de empresas.
6. Nós prontos para n8n e Make.
7. Mini-apps e formulários no chat.
