# Plano Segundo App

**"O app que todo brasileiro mantém ao lado."**

Status: ideias 1 a 14 aprovadas em 14/11/2026. Ideia 15 (Cofre de Contatos e Aviso de
Mudança) em análise. **Nenhuma etapa foi implementada.** A ordem de execução em relação aos
outros planos está em aberto (seção 8).

Origem: estudos "ZapLivre IA e Crescimento" e "Ideias Ousadas ZapLivre", de 14/11/2026.
Números e fontes citados nos estudos vieram de busca na web e de blogs de parceiros; onde
houve divergência, está dito no próprio estudo.

## 1. Objetivo

Não tirar o WhatsApp do celular de ninguém no curto prazo. Telegram e Signal convivem com
ele há anos. A rota realista para ser "igual ou mais forte" no Brasil é ser o **segundo
app**: o que resolve o que o primeiro deixa de fora. Cada ideia usa um destes motores de
instalação:

| Motor | O que move a pessoa |
| --- | --- |
| **Dor** | Medo e perda: golpe, roubo de celular, banimento, desconhecido insistente. |
| **Valor solo** | Serve antes de os amigos chegarem, então dá motivo para instalar sozinho. |
| **Grupo** | Viral: gente migra junto, nunca sozinha. |
| **Bolso** | Economia ou ganho para quem vende. |

Estas ideias são o motivo de **baixar**. O motivo de **ficar** é a paridade mínima:
criptografia de ponta a ponta, chamadas, figurinhas e multi-dispositivo. Esses itens já estão
nos roteiros do README e do Plano Baú (seção 15). Sem eles o app vira curiosidade.

## 2. Regras que valem para todas as ideias

1. **Nada de bibliotecas não oficiais do WhatsApp e nada de envio automatizado por ele.**
   Viola os termos e causa o banimento que queremos ajudar a evitar. Só importamos arquivos
   que a própria pessoa exporta.
2. **Dado de terceiros** (contatos, conversas importadas) é processado no aparelho sempre que
   possível. O que subir ao servidor vai cifrado ou com consentimento explícito e específico.
3. **A empresa nunca inicia conversa.** Regra vigente em `docs/API.md` e `docs/DECISOES.md`.
   Nenhuma ideia a contorna sem decisão registrada.
4. **Sem pagamentos dentro do aplicativo.** Funções de dinheiro só organizam o rastro.
5. **Alerta, nunca promessa de proteção total.** Toda detecção é explicável e reversível com
   um toque.
6. **IA de conversa** passa pelo menu de IA: faixa Livre por padrão, dado processado no
   Brasil, com rótulo de origem. Texto de desconhecido que entra em IA é tratado como dado,
   nunca como instrução (risco de injeção de comando).
7. **Estimativas de esforço são palpites** a validar na execução. Pequeno é 2 a 3 dias,
   médio 5 a 8, grande 15 ou mais.

## 3. Relação com os planos existentes

| Ideia | Já existe nos planos | O que este plano acrescenta |
| --- | --- | --- |
| 1. Garimpo | **Baú, Etapa 8** (importador do WhatsApp) e Cômodos, lente Dinheiro e Combinados | Entrada pensada como motivo de instalação, busca em linguagem natural, painel "o que achei" |
| 4. Escudo Anti-Golpe | Baú, Etapa 7 (antifraude do boleto) | Sinais de conversa, palavra secreta, selo de empresa |
| 5. Plano B | Chave Dupla (@usuário) e Cômodos, Balcão | Reserva antecipada, kit "se meu número cair" |
| 9. Reputação | Cômodos, Balcão (Onda 3) e Passageiras | Avaliação verificada pela própria conversa |
| 10. Áudio mastigado | Transcrição existente e Cômodos, Combinados | Extração de endereço, valor, data e pedido |
| 8. Grupo-Evento | Baú (armazenamento, desduplicação) e Passageiras | Álbum automático e "Livro do evento" |

## 4. Catálogo

### Ideia 1. Garimpo · Valor solo · esforço médio

Importar o histórico exportado do WhatsApp e devolver comprovantes por mês, documentos,
links, endereços e "o que eu prometi", com busca em linguagem natural.
**É a Etapa 8 do Plano Baú com mais saídas. Não construir duas vezes.**
- Leitor da exportação (`.zip` e `.txt`) no navegador, com mídias e datas originais.
- Varredura com o detector existente, alimentando `facts` e `documents`.
- Busca em linguagem natural sobre o importado, em modelo da faixa Livre.
- *Aceite:* importar uma exportação real traz mensagens e mídias com as datas originais;
  "cadê o comprovante do aluguel de março" devolve o item; nada sobe ao servidor sem a
  pessoa aceitar.
- *Riscos:* o formato da exportação varia por idioma, sistema e versão, e a exportação tem
  limite de tamanho (a confirmar). Há mensagens de terceiros, então processar localmente.

### Ideia 2. Porteiro IA · Dor · esforço médio

Desconhecido que escreve cai numa sala de espera. A IA pergunta quem é e o que quer. A
pessoa vê um resumo e escolhe aceitar, bloquear ou "agora não".
- Sala de espera por conta, com lista de permissão: contatos, empresas verificadas por
  @domínio e quem chega por link ou QR do próprio perfil.
- Prazo de espera configurável; sem resposta, o pedido expira.
- A IA só resume. Não executa ação nem ferramenta a partir do texto do desconhecido.
- *Aceite:* desconhecido não aciona notificação comum; aceitar vira conversa normal;
  empresa verificada e quem chega por link passam direto.
- *Depende de:* camada de IA (faixa Livre) e Chave Dupla (o desconhecido não recebe o
  telefone).
- *Riscos:* atrito com gente legítima, como o encanador novo. Mitigar com link de convite
  e prazo curto.

### Ideia 3. Alerta de roubo para meus contatos · Dor · esforço pequeno

De outro aparelho, a pessoa aciona "meu celular foi roubado". As sessões caem e os contatos
de confiança recebem um cartão verificado: "não atenda pedido de dinheiro vindo desta conta
até ela confirmar aqui".
- Tabela de contatos de confiança (reaproveitar `panic_contact` do Cofre, Cômodos Etapa 3).
- Acionamento exige prova de posse: código de recuperação ou código do telefone.
- Cartão expira em 24 horas ou quando a pessoa toca "já recuperei".
- *Aceite:* acionado de outro aparelho, a sessão antiga cai em segundos e o cartão chega.
- *Limite honesto:* só protege contatos que também estão no ZapLivre. Não protege o WhatsApp.

### Ideia 4. Escudo Anti-Golpe · Dor · esforço médio

- Aviso quando um contato troca nome e foto e logo pede dinheiro.
- **Palavra secreta da família:** pergunta e resposta guardadas com hash, para desafiar quem
  diz ser parente.
- Selo de empresa verificada por @domínio e CNPJ em destaque, contra o falso atendente.
- Aviso em link suspeito. Integra o antifraude do boleto (Baú, Etapa 7).
- *Aceite:* contato que troca foto e nome e escreve "preciso de um Pix" recebe faixa de aviso.
- *Riscos:* falso positivo e falso negativo. A tela diz que é um alerta, não uma garantia.

### Ideia 5. Plano B do WhatsApp · Bolso · esforço pequeno

Reserva antecipada do @, vitrine pública e kit "se meu número cair": texto pronto, QR e
cartão imprimível. Vem junto com **banimento com defesa** no próprio ZapLivre: aviso,
motivo e apelação com humano em 24 horas.
- *Aceite:* pessoa com @ reservado gera o cartão com QR; abrir o link num navegador sem
  conta mostra a vitrine.
- *Cuidado:* a mensagem aos clientes parte do celular da própria pessoa. Nunca automatizar.
- *Depende de:* Chat por link (ideia 6) e Balcão.

### Ideia 6. Chat por link, sem instalar · Bolso e Grupo · esforço médio

O cliente toca num link e a conversa abre no navegador. Instalar vem depois.
- Sessão de convidado com cadastro leve; histórico preservado ao criar conta.
- *Aceite:* abrir o link de uma empresa num navegador novo permite mandar mensagem sem
  instalar e sem telefone; ao criar conta depois, a conversa continua.
- *Atenção:* hoje o telefone é obrigatório e verificado por SMS no cadastro (Chave Dupla,
  regra 1). Convidado sem telefone muda essa regra e precisa de decisão (seção 8).
- A API já diz que a empresa é encontrada por @domínio, link ou QR. Conferir no código se
  o link já abre sem conta.

### Ideia 7. Migrar meu grupo + Desbloqueio coletivo · Grupo · esforço médio

O administrador importa a conversa do grupo, cria o grupo aqui e recebe o convite pronto.
O painel mostra "12 de 40 já entraram". Metas coletivas ligam recursos do grupo: tópicos,
resumo diário, álbum maior, mural.
- Reusa o importador do Baú (Etapa 8). O convite é texto e link que o administrador envia
  por conta própria, nunca por automação.
- *Aceite:* o grupo importado mostra o progresso e, ao cruzar o limiar, o recurso liga para
  todos.
- *Depende de:* ter o que liberar (tópicos e resumo estão no backlog, seção 9).
- *Risco:* pode parecer jogo de pontos. Testar com um grupo real antes de ampliar.

### Ideia 8. Grupo-Evento com álbum automático · Grupo · esforço grande

Grupo com data de fim. As fotos de todos entram num álbum compartilhado, há lista "quem traz
o quê" e placar de vaquinha **só de anotação**. No fim, vira o "Livro do evento".
- Reusa armazenamento e desduplicação do Baú e a expiração de Passageiras.
- Quem não tem conta abre o álbum por link (ideia 6).
- *Aceite:* foto enviada ao grupo aparece no álbum sem ação; no fim do evento gera o Livro;
  o álbum expira no prazo.
- *Riscos:* custo de armazenamento (álbum tem validade) e privacidade (cada pessoa escolhe
  o que entra).

### Ideia 9. Reputação nascida da conversa · Bolso · esforço médio

Ao fim de uma conversa de Balcão ou Passageiras, um toque avalia. Só conta quem conversou de
verdade. O perfil mostra nota, número de atendimentos e tempo médio de resposta, calculado do
histórico real.
- *Aceite:* só quem teve conversa elegível avalia; avaliação duplicada é bloqueada; denúncia
  de avaliação leva a revisão.
- *Depende de:* Balcão (Cômodos Etapa 8) e moderação (camada 4 do estudo).
- *Risco:* difamação e avaliação combinada. Regras claras antes de publicar notas.

### Ideia 10. Áudio mastigado · Valor solo · esforço médio

Áudio longo vira capítulos e cartões: endereço, valor, dia, pedido. Um toque cria o
lembrete. O WhatsApp já transcreve no aparelho; o diferencial é extrair o que fazer.
- Preferir processar no aparelho. No servidor, só com consentimento por aba, como no
  Assistente.
- *Aceite:* conjunto de teste de áudios reais com meta de acerto a calibrar.
- *Depende de:* transcrição existente e Cômodos Etapa 7 (Combinados).

### Ideia 11. Bot MEI · Bolso · esforço pequeno

Robô gratuito na Loja de Bots com lembrete do DAS (confirmar a data), da declaração anual e
respostas simples com links oficiais. Há de 16,5 a 17 milhões de MEIs (Sebrae e Fecomércio).
- Começar só com lembretes e links oficiais. Aviso fixo: "não substitui contador".
- *Aceite:* bot de conta verificada envia lembretes agendados e responde com fonte.

### Ideia 12. Modo Dados Zero · Bolso · esforço médio

Muitos planos das operadoras liberam o WhatsApp sem descontar a franquia e o ZapLivre
desconta. Modo economia: texto compacto, miniaturas, mídia só no Wi-Fi com fila e contador de
consumo do mês.
- Medir primeiro o peso real por mensagem, depois fixar a meta.
- Frente comercial, fora do código: conversar com operadoras sobre zero-rating.
- *Aceite:* mídia pendente sai sozinha ao conectar no Wi-Fi; contador bate com a medição.

### Ideia 13. Fábrica de Bom-dia · Grupo · esforço pequeno

Cartões prontos de bom dia, com nome, enviados de forma agendada. Aposta cultural, não medida.
- Começar com modelos prontos; gerar imagem por IA só depois, por causa do custo.
- Qualquer membro pode silenciar os cartões do grupo.
- *Depende de:* mensagem agendada (backlog, seção 9).

### Ideia 14. Zap Família · Grupo · esforço grande · risco alto

Contas supervisionadas para menores, com contatos aprovados pelos responsáveis, no espírito
do ECA Digital (em vigor desde 17/03/2026).
- Só depois das quatro camadas de moderação e de parecer jurídico. Não achei detalhe das
  obrigações do ECA Digital para mensageiros: falta ler a lei e o decreto.
- *Aceite:* definido após o parecer.

## 5. Ideia 15 (em análise): Cofre de Contatos e Aviso de Mudança

Proposta do dono do produto: importar os contatos do WhatsApp como backup, para quem for
banido não perder as pessoas, e permitir trocar de número e avisar os contatos.

**O que a pesquisa mostrou (14/11/2026, fontes em blogs e imprensa, não na Meta):**
- Conta banida pode pedir análise dentro do app ("Solicitar análise"), com resposta em cerca
  de 24 horas. Se negada, dá para registrar um novo número.
- Causas comuns: apps modificados (como GB WhatsApp), spam, automação e denúncias. A Meta
  divulgou mais de 6,8 milhões de contas banidas no mundo em jan a jun de 2025.
- O relatório "Solicitar informações da conta" traz a lista de grupos e, segundo uma fonte,
  contatos salvos. Não traz mensagens. Leva até três dias e vem em `.zip` com HTML e JSON.
  Não achei exportação oficial só de contatos. Conferir com arquivo real.
- O seletor de contatos do navegador (Contact Picker) só funciona no Chrome para Android;
  no iPhone não está disponível por padrão.

**Desenho proposto:**
1. **Importar a lista de pessoas por quatro caminhos oficiais:** arquivo `.vcf` ou `.csv`
   exportado da agenda ou do Google Contatos (qualquer navegador); seletor de contatos
   (Chrome Android); números e nomes que aparecem em conversas e grupos exportados (Garimpo,
   pega clientes não salvos); relatório de informações da conta do WhatsApp.
2. **Guardar cifrado no aparelho.** O servidor guarda só o texto cifrado, com chave derivada
   da senha ou do código de recuperação. "Nós não lemos" resolve a maior parte do problema
   de LGPD com dado de terceiros. Esquecer a senha perde o backup, como no Cofre.
3. **Trocar de número.** Fluxo novo (hoje não existe no código): verificar o número novo
   por SMS e provar posse da conta atual ou do código de recuperação. O @usuário continua. Quem
   está no ZapLivre vê a mesma pessoa e não precisa ser avisado.
4. **Aviso aos contatos que não estão no ZapLivre**, por canais permitidos: cartão e página
   pública "mudei de número" com link e QR para a pessoa divulgar onde puder; e, se a decisão
   for sim, SMS em nome da pessoa.
5. **Salvaguardas do SMS:** só para contatos que a própria pessoa importou; um por contato;
   teto por dia; texto fixo, sem pedir dinheiro e sem link encurtado; remetente identificado;
   opção de parar; texto manda confirmar por outro meio antes de qualquer pedido de dinheiro;
   contas novas ficam limitadas nas primeiras horas.
6. **Nunca** enviar nada pelo WhatsApp por automação.

**Riscos que precisam de decisão:**
- "Mudei de número" é a frase do golpe do falso parente. O aviso só tem selo quando o dono
  prova posse da conta, e se integra à palavra secreta (ideia 4).
- Spammers banidos podem usar a ferramenta para refazer a audiência. A regra "empresa nunca
  inicia conversa" continua valendo e o SMS tem teto e reputação.
- O SMS tem custo e envolve regras de operadora e da Anatel (conferir). Sem pagamentos no
  aplicativo, quem paga? O código já tem `smsWebhookUrl` para o SMS de cadastro.
- Importar números de terceiros: a LGPD isenta tratamento por pessoa natural para fins
  exclusivamente particulares e não econômicos. MEIs usam para fim econômico. Confirmar com
  advogado.
- A demanda é hipótese. Validar com lista de espera antes de construir.

## 6. Modelo de dados e API (rascunho)

```
contact_vault      user_id, blob_cifrado, kdf_params, version, updated_at
trusted_contacts   user_id, contact_user_id, created_at
theft_alerts       id, user_id, raised_at, expires_at, cleared_at
screening          owner_id, sender_id, summary, status ('waiting'|'accepted'|'blocked'|'later'|'expired'), created_at
secret_words       user_id, contact_user_id, question, answer_hash
guest_sessions     id, workspace_id|user_id, token_hash, created_at, upgraded_user_id
event_groups       chat_id, ends_at, album_id, book_attachment_id
reviews            id, subject_user_id, author_user_id, chat_id, stars, text, status, created_at
number_changes     id, user_id, old_phone_hash, new_phone_hash, proof ('recovery'|'otp'), created_at
```

| Método | Caminho | Para quê |
| --- | --- | --- |
| POST | `/api/import/whatsapp` | Importador (compartilhado com o Baú, Etapa 8) |
| PUT, GET | `/api/vault/contacts` | Backup cifrado de contatos (ideia 15) |
| POST | `/api/me/theft-alert` | Alerta de roubo |
| GET, POST | `/api/screening` e `/api/screening/:id` | Porteiro IA |
| POST | `/api/me/change-phone` | Troca de número (ideia 15) |
| POST | `/api/guest/session` | Chat por link |

## 7. Riscos transversais

- **Inchaço.** Quatorze ideias não saem juntas. Quem abre o app não pode encontrar dez
  novidades de uma vez. Valem as regras de abas do Plano Cômodos: nada ligado por padrão.
- **Promessa de segurança.** Escudo e Alerta de roubo são alertas. A interface nunca diz
  "protegido".
- **Moderação.** Reputação, Grupo-Evento, Bots e Zap Família exigem as quatro camadas do
  estudo (privado por padrão, hash de mídia, moderação do que é público, denúncia com humano).
- **IA.** Custo de faixa Livre com cota e teto mensal definido pelo dono do produto.
- **Criptografia de ponta a ponta.** Quando Social e Trabalho forem cifrados, as ideias que
  leem conversa (Porteiro, Áudio, Escudo) rodam no aparelho ou não rodam.

## 8. Ordem e decisões em aberto

Ordem geral atual dos planos (Plano Baú, seção 15): Cômodos fundação, Baú, restante do
Cômodos, Chave Dupla, funções do WhatsApp que faltam, E2E, chamadas, nativos, escala e LGPD.

**Proposta de encaixe, a decidir pelo dono do produto:**

| Onda | Ideias | Entra depois de |
| --- | --- | --- |
| S1 Entrada | 1 Garimpo, 3 Alerta de roubo, 5 Plano B, 6 Chat por link, 15 se aprovada | Baú, Etapa 8 |
| S2 Confiança | 2 Porteiro IA, 4 Escudo, 7 Migrar grupo, 12 Dados Zero | Chave Dupla e camada de IA |
| S3 Crescimento | 9 Reputação, 10 Áudio, 11 Bot MEI, 8 Grupo-Evento, 13 Bom-dia | Balcão, Combinados, Loja de Bots |
| S4 Regulatório | 14 Zap Família | Moderação e parecer jurídico |

**Decisões em aberto:**
1. Ordem das ondas em relação a Cômodos, Baú e Chave Dupla.
2. Convidado sem telefone (ideia 6) contra a regra 1 da Chave Dupla.
3. Aviso por SMS (ideia 15): sim ou não, quem paga e qual o teto.
4. Backup de contatos cifrado: aceitar que esquecer a senha perde o backup?
5. Parecer jurídico: LGPD com dado de terceiros, SMS em nome do usuário, ECA Digital.
6. Teto de gasto mensal da faixa Livre de IA.
7. Validar a demanda do backup de contatos com lista de espera.

## 9. Backlog: propostas anteriores sem aprovação explícita

Modo Desconectar (abas com horário), Loja de Bots e Hub de IAs, documento com prazo e marca
d'água, tópicos em grupos, mensagem agendada e soneca, tradução automática, tutor de estudos
com IA (cuidado com menores). Algumas são pré-requisito das ideias 7 e 13.
