# Plano Baú

**"O que é insubstituível não se perde mais."**

Status: aprovado. Nenhuma etapa foi implementada ainda. Execução prevista logo após a
fundação do Plano Cômodos, porque a aba Dinheiro depende deste motor para nascer certa.

## 1. A dor

O brasileiro troca de celular e perde duas coisas que não voltam: o comprovante que ele
vai precisar numa discussão daqui a três anos, e a foto da família que não existe em
nenhum outro lugar. O WhatsApp trata as duas como mensagem descartável.

## 2. O chassi

Todo documento e toda foto guardada recebe um identificador único e permanente, o
**chassi**.

**O chassi nasce do documento, não da pessoa.** É a impressão digital criptográfica do
conteúdo, combinada com o tipo. Essa escolha é deliberada e substitui a ideia inicial de
derivar o chassi do nome e do telefone, por três motivos:

1. Um identificador derivado de dado pessoal vaza dado pessoal, o que é problema de LGPD.
2. Ele quebraria quando a pessoa trocasse de número ou de nome.
3. Impediria o mais valioso: duas pessoas diferentes reconhecerem que receberam o mesmo
   boleto, e o sistema perceber que a mesma foto de família chegou por cinco parentes.

O vínculo com a pessoa fica numa camada separada, o **dossiê**, que liga chassi, dono,
data e situação. Documento é universal e verificável. Dossiê é privado.

## 3. O Brasil já criou o chassi, e ninguém usa

Documentos brasileiros são incomumente ricos em identificadores que se autovalidam. Tudo
abaixo é lido offline, sem integração com banco, sem autorização regulatória e sem custo
por consulta. Os detalhes exatos de cada formato são confirmados na implementação.

| Documento | O que dá para ler e conferir |
| --- | --- |
| Comprovante de Pix | Identificador fim a fim de 32 caracteres começando com E, único no país, com código do banco e instante da transação. É literalmente um chassi oficial. |
| Boleto | Linha digitável com código do banco, valor, vencimento codificado e dígitos verificadores por módulo dez e módulo onze. Dá para validar matematicamente. |
| QR code do Pix | Padrão internacional com verificação de integridade no fim, chave do recebedor, valor e identificador de conciliação. |
| Nota fiscal eletrônica | Chave de acesso de 44 dígitos com UF, competência, CNPJ do emissor, número e dígito verificador. |
| CPF e CNPJ | Dígitos verificadores conferíveis. |

## 4. O diálogo, do boleto ao comprovante

Máquina de estados que o usuário enxerga como conversa:

1. **Detectado.** Chega um boleto na conversa. O sistema lê banco, valor e vencimento,
   gera o chassi e guarda como pendente.
2. **Lembrete.** Antes do vencimento, o aplicativo avisa.
3. **Pergunta.** No vencimento: "você pagou este boleto?"
4. **Comprovante.** Se sim: "me manda o comprovante que eu vinculo os dois e guardo para
   você."
5. **Conferência.** Ao receber, o sistema confere valor, data e beneficiário contra o
   boleto. Se bater, selo verde. Se não bater, ele fala: "esse comprovante é de R$ 180,
   mas o boleto era de R$ 1.800."
6. **Quitado.** Boleto e comprovante ficam ligados pelo chassi, com banco, agência, conta,
   data e valor extraídos e gravados.

## 5. Escudo antifraude do boleto

Consequência direta da leitura da linha digitável, e recurso que nenhum mensageiro tem:

- O banco emissor do boleto não bate com a empresa da conversa: **aviso antes de pagar**.
- Esse mesmo boleto já foi pago: **aviso de cobrança duplicada**.
- O valor mudou em relação ao boleto que a mesma empresa enviou antes: **aviso**.
- Dígitos verificadores inválidos: **recusa**.

Golpe do boleto é epidemia no Brasil e ninguém protege o cidadão, porque nenhum aplicativo
lê o que passa por dentro dele.

## 6. O baú: como a promessa vira engenharia

Promessa sem engenharia por trás vira processo judicial e reputação destruída. O que
sustenta o compromisso:

- **Guarda deliberada.** A pessoa marca o que é insubstituível com um toque longo. Isso
  resolve sozinho o custo, porque ninguém guarda meme, e delimita juridicamente a promessa.
- **Selo de integridade.** Impressão digital gravada na entrada e reconferida
  periodicamente. A tela mostra "verificado íntegro em tal data".
- **Carimbo do tempo público.** Uma vez por dia o sistema publica uma raiz assinada que
  resume as impressões digitais do dia. Permite provar depois que o documento existia
  naquela data e não foi alterado. Força de cartório, sem ser cartório, a custo quase zero.
- **Comprovante verificável em um link.** Endereço somente leitura com chassi, impressão
  digital e data, para o outro lado conferir que não houve adulteração.
- **Saída garantida.** Botão de baixar tudo, organizado, com índice que abre offline.
- **Guardião.** A pessoa indica quem herda o baú.

**Linguagem na tela:** "compromisso de guarda de cinco anos, renovável, com sua cópia
sempre disponível". Nunca "garantia eterna". Nunca afirmar validade fiscal da cópia.

## 7. Fotos de família

Mesma prioridade dos comprovantes, com três exigências próprias:

- **Original preservado.** Hoje o nosso próprio código comprime a imagem no celular antes
  de enviar, exatamente como o WhatsApp. Item guardado sobe sem recompressão.
- **Chassi de foto e desduplicação.** A mesma foto enviada por cinco parentes é um único
  arquivo guardado, com cinco referências. Economia grande e um momento bonito na tela:
  "essa foto você já tem, guardada desde 2019".
- **Metadados para achar depois.** Data e local de captura lidos do próprio arquivo quando
  existirem, descrição automática da cena, pessoas identificadas pelo usuário e etiquetas.

## 8. Destinos do baú

Arquitetura de destino trocável, em vez de um único depósito:

1. **ZapLivre**, com cota grátis mais cota extra contratada.
2. **Nuvem do próprio usuário**, por exemplo Google Fotos ou Google Drive, pago por ele
   diretamente ao provedor. Viabilidade técnica a confirmar, ver decisões em aberto.
3. **Pasta ou disco do próprio computador**, por exportação automática, sem custo.

**Regra de ouro: sempre duas cópias, e o catálogo é sempre nosso.** Mesmo quando os bytes
ficam num destino externo, o ZapLivre mantém chassi, impressão digital, miniatura e
metadados. Custo nosso por item cai de alguns megabytes para algumas dezenas de
kilobytes, e a promessa continua honesta na forma correta: **o depósito pode ser seu, o
catálogo é nosso, e você sempre saberá exatamente o que tinha, quando, e se está íntegro.**

## 9. Decisões tomadas

| Tema | Decisão |
| --- | --- |
| Quem paga o armazenamento | Modelo híbrido: cota grátis financiada pelas assinaturas das empresas, mais cota extra contratável pelo usuário. Cota extra vende **espaço**, nunca funcionalidade. |
| Apagar contra guardar | O que foi guardado permanece. Quem enviou pode apagar da conversa, mas não apaga a cópia que o outro escolheu guardar. Aviso claro na tela de quem envia. Sem isso a promessa é falsa. |
| Leitura de print de tela | Reconhecimento de texto no servidor, aplicado **somente** ao que a pessoa marcou para guardar. Funciona em aparelho fraco, custo controlado, e guardar já é autorizar a leitura daquele item. |

## 10. Decisões em aberto

1. **Geolocalização obrigatória para guardar foto.** Proposta original do dono do produto.
   Recomendação técnica contrária, registrada na seção de riscos. Pendente de decisão final.
2. **Google Fotos como destino.** Depende de confirmar as regras atuais da interface de
   programação do Google, em especial se o aplicativo consegue ler e recuperar o arquivo
   original de itens que não foram enviados por ele mesmo. Verificar antes de prometer.
3. **A empresa enxerga o vínculo entre o boleto que emitiu e o meu comprovante?** Deixada
   deliberadamente em aberto pelo dono do produto, para análise posterior com mais detalhe.

## 11. Etapas de execução

**Etapa 0. Armazenamento trocável e impressão digital · 3 dias**
Camada de armazenamento com driver local e driver compatível com S3. Impressão digital
calculada em toda entrada. Exclusão suave, para que item guardado nunca suma por acidente.
*Aceite:* trocar o destino por variável de ambiente sem tocar no código de negócio, e os
arquivos já existentes continuarem abrindo.

**Etapa 1. Original preservado · 1 dia**
Parar de comprimir no celular quando o item for marcado para guardar. Miniatura gerada à
parte.
*Aceite:* a foto guardada tem exatamente os mesmos bytes do arquivo original do aparelho.

**Etapa 2. Chassi e registro de documentos · 3 dias**
Tabela de documentos, geração do chassi, leitor de linha digitável com validação por
módulo dez e onze, leitor de QR code do Pix com verificação de integridade, extração do
identificador fim a fim, chave de nota fiscal, CPF e CNPJ.
*Aceite:* colar uma linha digitável válida devolve banco, valor e vencimento corretos, e
uma linha adulterada é recusada.

**Etapa 3. Leitura de print de tela · 2 dias**
Reconhecimento de texto no servidor, só no que for guardado.
*Aceite:* print de comprovante de Pix devolve identificador, valor e data.

**Etapa 4. Diálogo do boleto ao comprovante · 3 dias**
Máquina de estados completa, vínculo e conferência.
*Aceite:* divergência de valor entre boleto e comprovante gera aviso explícito.

**Etapa 5. Custódia, selo e carimbo do tempo · 3 dias**
Registro de custódia, verificação periódica, raiz diária assinada, página pública de
verificação.
*Aceite:* alterar um único byte do arquivo faz a verificação falhar e disparar alerta.

**Etapa 6. Destinos do baú · 3 dias**
Driver de destino, regra das duas cópias, catálogo sempre local.
*Aceite:* item guardado em destino externo continua listado, com miniatura, chassi e
situação de verificação.

**Etapa 7. Escudo antifraude · 2 dias**
*Aceite:* boleto cujo banco emissor não corresponde à empresa da conversa gera aviso antes
do pagamento.

**Etapa 8. Importador do WhatsApp · 3 dias**
Importação da exportação de conversa com mídias, preservando datas, e varredura do
detector sobre todo o histórico.
*Aceite:* importar uma conversa exportada traz mensagens e mídias com as datas originais e
lista os comprovantes encontrados.

**Etapa 9. Cotas e patrocínio de empresa · 2 dias**
Cota grátis, cota extra, cota patrocinada.
*Aceite:* empresa patrocina a guarda dos documentos que emite e o cliente enxerga o espaço
adicional.

**Total: 25 dias de trabalho, entre 5 e 6 semanas.**

## 12. Modelo de dados

```
attachments   + sha256, storage_class, destino, original INTEGER,
                deleted_at, last_verified_at

documents     chassi (PK), doc_type, sha256, issuer_name, issuer_tax_id,
              amount, due_at, paid_at, bank_code, linha_digitavel, e2e_id,
              txid, nfe_key, extracted (JSON), confidence,
              source_attachment_id, chat_id, created_at

doc_links     boleto_chassi, comprovante_chassi, match_status, diff (JSON), created_at

custody       id, owner_id, target_type, target_id, destino, sha256, bytes,
              guarded_at, expires_at, last_verified_at, verify_status, replicas

timestamps    day, merkle_root, signature, published_at

quotas        owner_id, free_bytes, extra_bytes, sponsored_bytes, used_bytes
sponsorships  workspace_id, user_id, bytes, created_at

photo_meta    attachment_id, taken_at, gps_lat, gps_lon, camera,
              people_count, scene_labels, source ('exif'|'ia'|'manual')
```

A tabela `facts` do Plano Cômodos passa a apontar para `documents`. A aba Dinheiro deixa
de ser um detector de palpites e vira a vitrine deste registro verificado.

## 13. Monetização: o que a empresa ganha por pagar

Vantagens que nascem da própria arquitetura, sem travar funcionalidade artificialmente:

1. **Cobrança com chassi.** O boleto ou Pix emitido pelo aplicativo já nasce rastreável, e
   a baixa acontece sozinha quando o cliente manda o comprovante. Mata a planilha de
   conciliação.
2. **Painel de recebimentos.** Quem pagou, quem não pagou, quem prometeu pagar.
3. **Antifraude em nome da empresa.** Alerta quando circula boleto falso usando o nome
   dela. Nenhum banco oferece isso ao lojista.
4. **Cota patrocinada.** A empresa paga a guarda dos documentos que ela emite. O cliente
   ganha espaço, a empresa ganha o argumento de marketing, e o interesse comercial passa a
   financiar o arquivo do cidadão.
5. **Cofre da empresa** com selo de integridade e carimbo do tempo para contratos e notas,
   que vira defesa jurídica.
6. **Selo de empresa verificada** por domínio, CNPJ e telefone comercial.
7. Mais atendentes, mais robôs, limites maiores na interface de programação, relatórios e
   exportação contábil, prioridade no suporte.

## 14. Riscos e decisões que ficam para a execução

- **Geolocalização obrigatória é um risco real.** Condicionar a guarda de uma foto de
  família à liberação de localização contraria a tese do produto, é consentimento
  legalmente frágil sob a LGPD, que exige consentimento livre, e tecnicamente não entrega o
  que se espera: o que importa é onde a foto foi tirada, informação que está nos metadados
  do arquivo, e não onde o celular está no momento de guardar. Recomendação: localização
  como enriquecimento opcional, nunca como condição.
- **Depender do Google desloca a promessa.** Se o usuário cancelar o plano ou apagar de
  lá, o arquivo some. A regra das duas cópias e o catálogo local existem exatamente para
  isso. Comprovantes ficam conosco, porque são leves e porque o selo de integridade exige
  que os bytes sejam nossos.
- **Comprovante não vai para galeria de fotos.** Misturar documento financeiro com foto de
  aniversário é má organização e quebra o selo. Exportação para nuvem de arquivos, sim.
  Para galeria de fotos, não.
- **Leitura errada de valor ou data.** Toda extração é sugestão confirmável. Nunca lançar
  em silêncio, nunca somar sozinho.
- **Isso não é serviço financeiro.** Não processa, não intermedia, não guarda saldo.
  Explícito na interface e nos termos, para não atrair regulação de pagamentos.
- **LGPD.** Dado financeiro exige cifragem em repouso, política de retenção e direito de
  exclusão. O direito de apagar do próprio dono sempre vence a promessa de guarda: o
  compromisso é contra a perda acidental, nunca contra a vontade do titular.
- **Custo de reconhecimento de texto e de descrição de imagem** cresce com o uso. Só rodar
  no que for guardado, e medir desde o primeiro dia.

## 15. Ordem geral dos planos, atualizada

1. Plano Cômodos, etapa de fundação do sistema de abas.
2. **Plano Baú**, este documento.
3. Restante do Plano Cômodos, com a aba Dinheiro já apoiada no Baú.
4. Plano Chave Dupla, privacidade do telefone.
5. Funções do WhatsApp que faltam, sem pagamentos.
6. Criptografia de ponta a ponta, chamadas, aplicativos nativos, escala e LGPD.
