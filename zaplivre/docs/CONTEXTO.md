# ZapLivre · Contexto e memória do projeto

Índice mestre de tudo que foi decidido. Consulte aqui antes de retomar o trabalho.

## 1. O que é

Mensageiro de código aberto, gratuito para pessoas físicas e com assinatura fixa para
empresas, feito para o Brasil. Alternativa ao WhatsApp. Aplicativo web instalável (PWA),
servidor Node.js 22 com Express, Socket.IO e SQLite embutido (`node:sqlite`).

Pasta: `zaplivre/`. Branch: `claude/whatsapp-clone-app-wlxki0`. PR #3.

## 2. Planos aprovados, na ordem de execução

| Ordem | Plano | Documento | Situação |
| --- | --- | --- | --- |
| 1 | **Cômodos**, etapa 0 (fundação do sistema de abas) | `PLANO-COMODOS.md` | Aprovado, prioridade máxima |
| 2 | **Baú** (chassi, custódia, fotos) | `PLANO-BAU.md` | Aprovado |
| 3 | **Cômodos**, restante (abas Dinheiro, Passageiras, Cofre, Murais, Assistente, Combinados, Balcão, Perto) | `PLANO-COMODOS.md` | Aprovado |
| 4 | **Chave Dupla** (privacidade do telefone) | `PLANO-CHAVE-DUPLA.md` | Aprovado |
| 5 | Funções do WhatsApp que faltam, sem pagamentos | seção 5 abaixo | Aprovado, sem plano escrito |
| 6 | Criptografia de ponta a ponta, chamadas, apps nativos, escala, LGPD | `DECISOES.md` | Roteiro |

Outros documentos: `API.md` (integração de robôs), `DECISOES.md` (criptografia contra IA,
antispam, descoberta de contatos).

## 3. Já construído e testado

Servidor e PWA em português com: cadastro por `@usuário` com telefone privado verificado
por SMS; empresas por `@domínio` verificado por DNS; três abas Social, Trabalho e
Atendimento; conversas e grupos de até 256 pessoas; texto, fotos, documentos e áudios;
transcrição e resumo sob demanda; painel de mídias com categorias e etiquetas; recibos,
presença, digitando, responder, apagar, bloquear; API pública `/api/v1` com chave e
webhooks assinados; Kanban de atendimento; passagem robô para humano; planos de assinatura
com webhook de cobrança; notificações, modo escuro, instalação como aplicativo.

Seis cenários de teste automatizado passando. Fluxo completo simulado no Chromium.

## 4. Decisões de produto já tomadas

- **Chassi nasce do documento, não da pessoa.** Impressão digital do conteúdo. Não vaza
  dado pessoal, não quebra na troca de número, permite reconhecer o mesmo boleto ou a
  mesma foto chegando por pessoas diferentes.
- **Cota de armazenamento híbrida.** Cota grátis financiada pelas assinaturas das
  empresas, mais cota extra contratável. A cota extra vende espaço, nunca funcionalidade.
- **O que foi guardado permanece.** Quem enviou apaga da conversa, mas não apaga a cópia
  que o outro escolheu guardar.
- **Leitura de print no servidor**, somente no que a pessoa marcou para guardar.
- **Empresa nunca inicia conversa.** Só responde a quem a procurou. Limite de envios por
  hora por plano. Bloqueio disponível.
- **Abas de arquivo contra abas de lente.** Arquivo é endereço e é exclusivo. Lente é
  ponto de vista e atravessa tudo. Máximo de quatro abas na tela, nada ligado por padrão.
- **Criptografia por aba.** Social e Trabalho cifrados no futuro. Atendimento legível pela
  empresa, como na API do WhatsApp Business.
- **Não é serviço financeiro.** Não processa, não intermedia, não guarda saldo.

## 5. Funções do WhatsApp ainda ausentes, aprovadas para inclusão

Sem pagamentos dentro do aplicativo, por decisão do dono.

**Simples, meio dia a um dia cada:** reações com emoji, encaminhar mensagem, fixar
mensagem e favoritos, mensagens temporárias, envio de localização, envio de vídeo.

**Médias, dois a cinco dias cada:** figurinhas e GIFs, Status de 24 horas, comunidades e
canais de transmissão, backup e restauração.

**Pesadas, uma a três semanas cada:** criptografia de ponta a ponta, chamadas de voz e
vídeo por WebRTC, multi-aparelho completo com sincronização.

Motivo da ausência inicial: escopo. A primeira construção priorizou o núcleo de um
mensageiro e a segunda seguiu o roteiro de vantagens do estudo. Cerca de metade das
ausências é trabalho de um dia.

## 6. Onde o aplicativo roda

Funciona no celular como PWA instalável, com ícone na tela inicial, notificações,
microfone, câmera e agenda. No Android a experiência é quase nativa. No iPhone funciona
com limitações de notificação e sem acesso à agenda. No computador roda no navegador ou
instalado. O aplicativo nativo nas lojas está no roteiro e o caminho mais barato é
empacotar o mesmo código com Capacitor, de duas a três semanas mais as contas de
desenvolvedor.

## 7. Chamadas de voz e vídeo

Viáveis por WebRTC. Falta sinalização pelo socket, servidor TURN (único custo real), tela
de chamada, e o aplicativo nativo para tocar em segundo plano no iPhone. De quatro a seis
dias para chamadas individuais. Chamada em grupo fica para depois.

## 8. Monetização: o que a empresa ganha por pagar

Cobrança com chassi e baixa automática, antifraude em nome da empresa, cota patrocinada
para os clientes dela, painel de recebimentos, cofre da empresa com selo de integridade,
selo de verificada, mais atendentes, limites maiores de API, relatórios contábeis.

## 9. Decisões ainda em aberto

1. **Geolocalização obrigatória para guardar foto.** Proposta do dono, com recomendação
   técnica contrária registrada no `PLANO-BAU.md`.
2. **Google Fotos como destino do baú.** Depende de confirmar as regras atuais da
   interface de programação do Google.
3. **A empresa enxerga o vínculo entre o boleto que emitiu e o comprovante do cliente?**
   Deixada em aberto de propósito, para análise posterior.

## 10. Avisos permanentes

- "WhatsApp" é marca registrada da Meta. Nome, logotipo e identidade visual do ZapLivre
  são próprios.
- Sem criptografia de ponta a ponta, o operador do servidor lê as mensagens. Deixar isso
  explícito aos usuários até o item ser entregue.
- Licença AGPL-3.0.
