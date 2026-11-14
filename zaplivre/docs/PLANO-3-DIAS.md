# Plano 3 Dias · do protótipo ao piloto real

**"Um amigo instala, usa uma semana inteira e não volta para o WhatsApp para falar com você."**

Status: **Dias 1 e 2 entregues** (14/11). Dia 3 pendente.

## 1. Por que este plano existe

Os quatro planos aprovados (Cômodos, Baú, Chave Dupla, funções ausentes do WhatsApp)
somam cerca de 45 dias de trabalho. Três dias não entregam nada disso inteiro.

Então a pergunta muda. Não é *quanto dos planos cabe em três dias*. É *o que falta para
o aplicativo ser usável de verdade por 10 a 50 pessoas*. Essa lista é curta e cabe.

Tudo que está nos outros planos continua valendo e continua na fila. Este plano não
substitui nenhum deles; ele abre a porta para que eles sejam construídos em cima de algo
que pessoas de verdade já estão usando.

## 2. Diagnóstico: o que realmente falta

Verificado no código em 2026-11-14, commit `b7e4bc1`.

### Bloqueios que impedem qualquer uso real

| # | Falta | Onde se vê | Por que é bloqueio |
| --- | --- | --- | --- |
| 1 | **Notificação com o app fechado** | `public/sw.js` não trata evento `push`; `app.js:944` só notifica com a aba aberta | Mensageiro que não avisa não é mensageiro. Fechou o navegador, a mensagem some até a pessoa voltar. |
| 2 | **Entrada sem SMS contratado** | `DEV_SHOW_OTP=1` em `package.json` | Em produção, qualquer um entraria como qualquer um. Falha de segurança, não inconveniência. |
| 3 | **Busca de mensagens** | nenhuma rota de busca em `server/index.js` | Conversa de uma semana já fica inútil sem busca. Expectativa básica. |
| 4 | **Servidor no ar** | `Dockerfile` existe, implantação não | Roda só na minha máquina. Ninguém pode testar. |
| 5 | **Backup** | SQLite e mídias em disco solto | Servidor morre, tudo some. Com fotos de família dentro, é inaceitável. |

### Faltas que fazem o usuário sentir que falta coisa

Vídeo, localização, reações com emoji, encaminhar mensagem, fixar conversa, silenciar,
arquivar. Nenhuma é difícil; juntas são a diferença entre "parece um protótipo" e
"parece o WhatsApp".

### O que já está pronto e não precisa de nada

Identidade por `@usuário` com telefone privado, empresas por domínio verificado por DNS,
três abas, grupos, áudio com transcrição e resumo, painel de mídias, recibos, presença,
responder, apagar, bloquear, API pública com chave e webhooks, Kanban, robô para humano,
planos de assinatura, modo escuro, instalação como aplicativo.

## 3. O plano

### Dia 1 · Entrar e ser avisado ✅ ENTREGUE

Os dois bloqueios que não têm volta, mais a busca.

**1.1 Notificação de verdade (Web Push)** · ✅ feito
- Chaves VAPID geradas uma vez e guardadas como variável de ambiente.
- Tabela `push_subscriptions`: endpoint, chaves, usuário, aparelho.
- Service worker passa a tratar o evento `push` e a abrir a conversa certa no clique.
- Disparo dentro do `deliver()` em `server/index.js`, só para quem não está com a
  conversa aberta naquele instante.
- Agrupamento por conversa, para não virar vinte avisos de uma mesma pessoa.
- *Aceite:* celular com a tela bloqueada e o aplicativo fechado recebe o aviso em
  segundos, e o toque abre a conversa certa.
- *Observação:* no iPhone exige que o aplicativo tenha sido instalado na tela inicial.
  Isso é limitação da Apple, não nossa, e precisa aparecer na tela de boas-vindas.

**1.2 Modo convite** · ✅ feito
- Tabela `invites`: código de seis letras, quem criou, quantos usos, validade.
- Entrada por código em vez de SMS, para o piloto. Dispensa contratar disparo de SMS.
- `DEV_SHOW_OTP` deixa de existir. O caminho de SMS real (`SMS_WEBHOOK_URL`) continua
  pronto para quando houver contrato.
- Tela do dono para gerar e revogar convites.
- *Aceite:* pessoa recebe um link com código, entra, escolhe o `@usuário` e conversa.
  Sem o código, ninguém entra.

**1.3 Busca** · ✅ feito
- Índice de texto do SQLite (FTS5) sobre as mensagens, respeitando quem pode ver o quê.
- Busca global na lista de conversas e busca dentro de uma conversa, com salto para a
  mensagem.
- *Aceite:* achar uma mensagem de duas semanas atrás em menos de um segundo.

> **Como ficou, na prática.** `ACCESS_MODE=invite` liga o piloto. O servidor vazio
> imprime no terminal um código de primeiro acesso; quem o usa vira administrador e
> passa a emitir convites pelo menu. Cada conta nova recebe um código de recuperação,
> mostrado uma única vez, que é como ela volta a entrar sem SMS. `DEV_SHOW_OTP` deixou
> de ser o único caminho sem SMS. A busca usa o índice FTS5 do próprio SQLite, ignora
> acento e maiúscula, respeita quem participa de cada conversa e some com a mensagem
> apagada. O aviso com o aplicativo fechado sai pelo Web Push e não é enviado para quem
> já está com a tela aberta.

### Dia 2 · Parecer o WhatsApp ✅ ENTREGUE

Tudo aqui é curto. O valor está em serem muitos de uma vez.

- ✅ **Vídeo** no envio, com tocador dentro da conversa e no painel de mídias. Limite
  próprio de 60 MB, porque 25 MB não dá nem meio minuto de celular.
- ✅ **Localização**, enviada como ponto que abre no mapa de quem recebe. O ZapLivre não
  desenha mapa nem fala com serviço de mapa nenhum.
- ✅ **Reações com emoji**, uma por pessoa, repetir desfaz, em tempo real.
- ✅ **Encaminhar mensagem** para até 20 conversas de uma vez, com marca de origem. O
  arquivo não é duplicado em disco.
- ✅ **Fixar no topo**, **silenciar** e **arquivar**, cada um valendo só para quem fez.
  Conversa silenciada não dispara aviso no celular.
- ✅ **Mensagens temporárias** por conversa (24 horas, 7 dias, 90 dias), com relógio no
  servidor para sumirem mesmo de quem não abrir a conversa.
- ✅ **Backup e restauração** (`npm run backup`, `npm run restaurar`), com cópia
  consistente do banco mesmo com o servidor rodando, conferência de integridade e
  guarda do que estava no ar antes de restaurar.
- *Aceite:* uma pessoa que usa WhatsApp abre o ZapLivre e não sente falta de nada no
  primeiro dia.

> **Nota de migração.** As restrições do banco não aceitavam os tipos novos e não podem
> ser alteradas por `ALTER TABLE`; um banco criado antes recusaria vídeo e localização em
> silêncio. A tabela é reconstruída na subida, preservando linhas, índices e gatilhos da
> busca. Testado sobre um banco da versão anterior.

### Dia 3 · Fundação e produção

**3.1 Plano Cômodos, Etapa 0** · fundação do sistema de abas
Exatamente como está em `PLANO-COMODOS.md`: `tab_key` no lugar de `category`, tabela
`user_tabs`, distinção arquivo contra lente no código, barra adaptativa com limite de
quatro abas. O usuário existente abre e vê as mesmas três abas de hoje.

Sem isso, cada aba nova dos planos futuros vira remendo. Com isso, Dinheiro, Passageiras,
Cofre e as demais entram como peça encaixada.

**3.2 Preparo de produção**
- `docker-compose` com HTTPS automático, domínio e renovação de certificado.
- Variáveis de ambiente documentadas, com as chaves de verdade separadas do código.
- Revisão de segurança do que entrou nos três dias.
- Tela de boas-vindas com o aviso honesto: ainda não há criptografia de ponta a ponta, o
  operador do servidor consegue ler as mensagens.
- Testes automatizados cobrindo o que foi construído.

## 4. O que este plano deliberadamente não faz

- **Criptografia de ponta a ponta.** Uma a três semanas. Vai com o aviso honesto até lá.
- **Chamadas de voz e vídeo.** Quatro a seis dias mais um servidor TURN pago.
- **Aplicativo nativo nas lojas.** Duas a três semanas mais as contas de desenvolvedor.
- **Plano Baú, Chave Dupla e o resto do Cômodos.** Continuam na fila, agora em cima de
  uma base que já está no ar.
- **Status de 24 horas, figurinhas, comunidades.** Não bloqueiam o piloto.

## 5. O que depende de você, não de mim

1. **Domínio e servidor.** Algo entre trinta e sessenta reais por mês serve para o
   piloto. Sem isso o Dia 3 entrega tudo pronto, mas não no ar.
2. **Decidir a ordem.** Este plano põe a Etapa 0 do Cômodos no Dia 3. Você a marcou como
   prioridade máxima. O argumento para adiá-la é que ela é invisível ao usuário, e
   invisível não faz ninguém usar. A decisão é sua.
3. **As dez primeiras pessoas.** Quem vai receber convite. Gente que fala com você todo
   dia, senão o teste não testa nada.

## 6. Decisões ainda em aberto, herdadas

Continuam esperando, sem bloquear este plano:

1. Geolocalização obrigatória para guardar foto (recomendação técnica contrária
   registrada em `PLANO-BAU.md`).
2. Google Fotos como destino do baú.
3. A empresa enxerga o vínculo entre o boleto que emitiu e o comprovante do cliente?
