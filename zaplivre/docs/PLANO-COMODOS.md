# Plano Cômodos

**"Cada coisa no seu lugar."**

Status: aprovado, **prioridade máxima**. Nenhuma etapa foi implementada ainda.

> O WhatsApp é uma caixa onde tudo cai junto. O ZapLivre é uma casa onde cada coisa tem
> o seu cômodo.

## 1. Objetivo

Sair de três abas fixas para uma **arquitetura de abas** que se molda à vida de cada
pessoa. Um mensageiro que se personaliza é uma categoria nova de produto, e é a vantagem
que a Meta está estruturalmente impedida de copiar: o faturamento dela depende de empresa
e amigo dividirem a mesma caixa de entrada.

## 2. A descoberta que organiza tudo: dois tipos de aba

Misturar os dois tipos é o erro que transforma qualquer aplicativo num labirinto de menus.

**Abas de arquivo (endereço).** A conversa mora em uma só. São mutuamente exclusivas.
Hoje: Social, Trabalho, Atendimento. Novas: Passageiras, Murais, Cofre, Balcão, Perto.

**Abas de lente (ponto de vista).** Não guardam conversa nenhuma. Atravessam todas as
outras e mostram uma fatia do que já existe. O comprovante que a mãe mandou no Social e o
boleto que a loja mandou no Atendimento aparecem juntos na lente Dinheiro, sem sair do
lugar de origem. Novas: Dinheiro, Combinados, Assistente.

Com essa separação dá para ter dez abas sem confundir ninguém, porque lente não compete
com endereço. O WhatsApp não tem nem uma coisa nem outra.

## 3. Catálogo de abas

### Já existem

| Aba | Tipo | O que é |
| --- | --- | --- |
| Social | arquivo | Amigos e família. |
| Trabalho | arquivo | Equipes e projetos. |
| Atendimento | arquivo | Empresas e suporte. |

### Onda 1 (o impacto imediato)

**💰 Dinheiro** · lente
Todo comprovante de Pix, boleto, cobrança e vaquinha que passa pelas conversas cai aqui
sozinho, separado por mês e por pessoa. Responde: quem me deve, o que eu devo, cadê o
comprovante do aluguel. **O aplicativo não move um centavo**, ele organiza o rastro de
papel que já existe. O código atual já reconhece arquivos com nome de comprovante
(`CATEGORY_RULES` em `server/files.js`), então metade do caminho está andada.

**⏳ Passageiras** · arquivo
A conversa nasce com prazo de validade. Motorista, entregador, eletricista, vendedor do
Marketplace. Passado o prazo, a conversa se arquiva sozinha, o contato não polui a lista
para sempre e, se houver telefone liberado, ele é revogado no mesmo instante (integração
direta com o Plano Chave Dupla). Ninguém no mundo tem conversa com data de validade.

**🔒 Cofre** · arquivo oculto
Aba invisível até você digitar uma senha própria. Dentro dela, a peça que mais importa no
Brasil: **senha de coação**. Sob ameaça, você digita uma senha diferente e o aplicativo
abre limpo, com conversas comuns, enquanto o conteúdo real permanece invisível e um
alerta silencioso pode ser disparado. Roubo de celular com desbloqueio forçado é epidemia
nacional e a Meta nunca vai priorizar isso.

**🧩 Loja de Abas** · mecanismo
As abas não vêm todas ligadas. A pessoa escolhe as que quer, como quem instala aplicativo.
O aplicativo de um estudante fica diferente do de um lojista, que fica diferente do de uma
mãe com três filhos na escola.

### Onda 2 (retenção)

**📣 Murais** · arquivo com interface própria
Condomínio, escola, igreja, associação de bairro. Isso não é conversa, é quadro de avisos,
e tratar como conversa gera o inferno de duzentas mensagens por dia. A tela muda: feed de
avisos com autor e data, responder fica recolhido, resumo do dia no topo.

**🧠 Assistente** · lente com IA
Não é um contato para conversar, é uma inteligência que enxerga as suas próprias abas, com
sua permissão. Responde: o que eu prometi essa semana, qual boleto vence amanhã, o que
aconteceu no grupo do condomínio enquanto eu viajava. A Meta tem uma IA **dentro** do
chat. Esta é uma IA que enxerga o **seu** chat.

**🗓️ Combinados** · lente
Todo "vamos sábado?" que virou sim vira um cartão com data, extraído da conversa e
confirmado com um toque. A aba mostra o que você combinou e ainda não cumpriu.

### Onda 3 (expansão)

**🏪 Balcão** · arquivo
Modo negócio leve para quem vende sem CNPJ e sem site: manicure, bolo caseiro, brechó,
mecânico. Catálogo simples, pedidos organizados, um arroba próprio para receber cliente,
sem precisar virar empresa formal.

**🏘️ Perto** · arquivo
Vizinhança verificada por região, opcional. Achado e perdido, indicação de profissional,
alerta de rua. Ocupa o espaço dos grupos de bairro sem o caos deles.

## 4. Mecânicas transversais

1. **Máximo de 4 abas na tela do celular.** As demais ficam atrás de um botão "mais". Aba
   demais mata o produto.
2. **Nada ligado por padrão** além das três atuais. O usuário nunca abre o aplicativo e
   encontra dez abas vazias.
3. **Abas que nascem sozinhas.** O aplicativo observa e oferece: "Percebi 12 comprovantes
   de Pix este mês. Quer ativar a aba Dinheiro?" A pessoa nunca configura, só aceita ou
   recusa. O produto cresce junto com o usuário.
4. **Triagem automática reversível.** Toda sugestão de aba para uma conversa nova é
   explicável e desfazível com um toque. Nada é movido em silêncio.
5. **Aba vazia não aparece.** Só aparece quando tem conteúdo ou foi ativada de propósito.

## 5. Etapas de execução

### Onda 1

**Etapa 0. Fundação do sistema de abas** · 2 dias
- Trocar o campo fixo `category` por um registro de abas (`tab_key`), com a distinção
  arquivo x lente no código.
- Tabela `user_tabs`: quais abas cada pessoa ativou, em que ordem, com que ajustes.
- Barra de abas adaptativa com limite de 4 e botão "mais".
- Migração: `social`, `work` e `desk` viram abas registradas, sem quebrar nada.
- *Aceite:* usuário existente abre o aplicativo e vê exatamente as três abas de hoje,
  com as conversas nos mesmos lugares.

**Etapa 1. Dinheiro** · 3 dias
- Detector de comprovante, boleto, Pix e cobrança em anexos e em texto, com extração de
  valor, data e contraparte quando possível.
- Tabela `facts`, que serve também a Combinados depois.
- Tela: agrupamento por mês, "quem me deve" e "o que eu devo", marcar como pago, busca.
- Toda extração é uma **sugestão confirmável**, nunca um lançamento silencioso.
- *Aceite:* enviar comprovante numa conversa Social e um boleto numa conversa de
  Atendimento; os dois aparecem juntos em Dinheiro sem sair das conversas de origem.

**Etapa 2. Passageiras** · 2 dias
- Prazo de validade na conversa, escolhido ao abrir ou depois: 24 horas, 7 dias, 30 dias.
- Arquivamento automático, revogação de liberação de telefone junto, opção de prorrogar ou
  tornar permanente antes de expirar.
- *Aceite:* conversa criada com 24 horas some da lista no prazo e a liberação de telefone
  vinculada é revogada no mesmo momento.

**Etapa 3. Cofre e senha de coação** · 3 dias
- PIN próprio do cofre, separado do desbloqueio do aparelho. Aba invisível até desbloquear.
- Mover conversa para o cofre e tirar de lá.
- Senha de coação: abre um estado limpo e plausível do aplicativo, sem o cofre e sem
  rastro de que ele existe. Alerta silencioso opcional para um contato de confiança.
- Bloqueio de captura de tela dentro do cofre, quando o sistema permitir.
- *Aceite:* com a senha de coação, nenhuma tela, busca, notificação ou contador revela a
  existência do cofre.
- **Esta etapa exige revisão de segurança dedicada antes de ir ao ar.**

**Etapa 4. Loja de Abas e sugestão automática** · 2 dias
- Catálogo de abas com descrição, tipo e prévia. Ativar, desativar e reordenar.
- Motor de sugestão com gatilhos por comportamento e cartão de convite.
- *Aceite:* após alguns comprovantes, o aplicativo oferece a aba Dinheiro uma única vez;
  recusar não repete a oferta por 60 dias.

**Subtotal da Onda 1: cerca de 12 dias.**

### Onda 2

**Etapa 5. Murais** · 3 dias
Grupo em modo mural, com papel de quem pode publicar aviso, feed cronológico, resposta
recolhida e resumo do dia. Converter grupo existente em mural.

**Etapa 6. Assistente** · 3 dias
Pergunta em linguagem natural sobre as próprias conversas, com consentimento explícito por
aba e resposta sempre citando de onde tirou a informação.

**Etapa 7. Combinados** · 2 dias
Detecção de compromisso com data, cartão de confirmação de um toque, lista do que foi
combinado e não cumprido.

**Subtotal da Onda 2: cerca de 8 dias.**

### Onda 3

**Etapa 8. Balcão** · 3 dias · **Etapa 9. Perto** · 3 dias

**Subtotal da Onda 3: cerca de 6 dias.**

**Total do Plano Cômodos: 26 dias de trabalho, algo entre 5 e 6 semanas.**

## 6. Modelo de dados

```
user_tabs        user_id, tab_key, enabled, position, config (JSON)
tab_suggestions  user_id, tab_key, reason, shown_at, answer

chats            + tab_key TEXT            (substitui category)
                 + expires_at INTEGER      (Passageiras)
                 + in_vault INTEGER        (Cofre)
                 + mural INTEGER, mural_posters TEXT  (Murais)

facts            id, user_id, chat_id, message_id, kind ('money'|'commitment'),
                 amount, direction ('in'|'out'), counterpart_id, due_at,
                 status, confidence, confirmed_at, created_at
                 -- a tabela das lentes: fatos extraídos das conversas

vault            user_id, pin_hash, duress_pin_hash, panic_contact, updated_at
```

Uma única tabela `facts` atende Dinheiro e Combinados. Toda lente futura entra aqui com um
novo `kind`, sem tocar no resto do sistema.

## 7. API

| Método | Caminho | Para quê |
| --- | --- | --- |
| GET | `/api/tabs/catalog` | Catálogo da loja de abas |
| GET, PUT | `/api/me/tabs` | Abas ativas, ordem e ajustes |
| GET | `/api/facts?kind=money&mes=` | Lente Dinheiro |
| PATCH | `/api/facts/:id` | Confirmar, corrigir, marcar como pago |
| PUT | `/api/chats/:id/expiry` | Prazo da conversa passageira |
| PUT | `/api/vault/pin` | Definir PIN e senha de coação |
| POST | `/api/vault/unlock` | Abrir o cofre |
| PUT | `/api/chats/:id/vault` | Mover conversa para o cofre |
| PUT | `/api/chats/:id/mural` | Ligar modo mural |
| POST | `/api/assistant/ask` | Pergunta do Assistente |

## 8. Telas

1. Barra de abas adaptativa com limite de 4 e botão "mais".
2. Loja de Abas: catálogo com prévia, ativar, desativar, reordenar.
3. Dinheiro: meses, pessoas, pendentes, busca, cartão de confirmação.
4. Passageiras: prazo visível na conversa, aviso antes de expirar.
5. Cofre: tela de PIN, lista oculta, ajustes de coação.
6. Murais: feed de avisos com resumo do dia.
7. Assistente: pergunta, resposta com origem citada, controle de permissão por aba.
8. Cartão de convite de aba nova.

## 9. Testes

- Migração das três abas atuais sem perda nem troca de lugar.
- Lente Dinheiro atravessando conversas de abas diferentes.
- Expiração de conversa passageira revogando telefone junto.
- Cofre sob senha de coação sem vazar em busca, notificação, contador ou lista de mídias.
- Sugestão de aba oferecida uma vez e respeitando a recusa.
- Ponta a ponta no navegador com dois usuários e as abas da Onda 1.

## 10. Riscos e decisões que ficam para a execução

- **Falso positivo na detecção de dinheiro.** Toda extração é sugestão confirmável. Nunca
  lançar em silêncio, nunca somar sozinho.
- **Cofre é promessa de segurança.** Precisa de revisão dedicada e de honestidade sobre os
  limites: o modo coação protege contra quem exige o desbloqueio na hora, não contra
  perícia forense no aparelho. Escrever isso na própria tela.
- **PIN perdido.** Decidir entre recuperação, que enfraquece o cofre, e perda definitiva,
  que é mais seguro e mais duro.
- **Assistente contra criptografia de ponta a ponta.** Quando Social e Trabalho forem
  cifrados, o Assistente roda no aparelho ou não roda. Decidir na Etapa 6.
- **Inchaço.** Máximo de 4 abas na tela e nada ligado por padrão. Se lançarmos oito abas de
  uma vez, viramos o inchaço que estamos criticando.
- **Perto e Balcão trazem moderação e responsabilidade.** Avaliar antes da Onda 3.
- **Dinheiro não é serviço financeiro.** Não processa, não intermedia, não guarda saldo.
  Deixar isso explícito na interface e nos termos, para não atrair regulação de pagamentos.

## 11. Ordem geral dos planos, atualizada

1. **Plano Cômodos** (este) — prioridade máxima.
2. **Plano Chave Dupla** — privacidade do telefone.
3. Funções do WhatsApp que faltam, sem pagamentos, das simples às pesadas.
4. Criptografia de ponta a ponta em Social e Trabalho.
5. Chamadas de voz e vídeo.
6. Aplicativos nativos nas lojas.
7. Escala, antiabuso e LGPD.
