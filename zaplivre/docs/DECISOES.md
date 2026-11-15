# Decisões de produto: soluções para os três pontos em aberto

Ordem: da maior para a menor importância. Cada item traz as soluções viáveis, a escolhida
e o que já está programado.

## 1. Criptografia de ponta a ponta versus IA no servidor (maior importância)

**O problema.** Robôs de atendimento, painel de mídias e transcrição de áudio precisam que
o servidor leia o conteúdo. Criptografia de ponta a ponta impede exatamente isso.

| Solução                                                                                       | Viável? | Avaliação                                                                                   |
| --------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| **A. Separar por aba: Social cifrado de ponta a ponta; Atendimento legível pela empresa** (escolhida) | Sim     | É o modelo da API do WhatsApp Business: a empresa lê mesmo. A pessoa sabe o que é privado.  |
| B. Tudo cifrado e IA rodando no aparelho (Whisper WASM, modelos locais)                       | Parcial | Privacidade máxima, mas transcrição lenta em celulares simples e robôs de empresa impossíveis. |
| C. Nada cifrado, só HTTPS + consentimento                                                     | Sim     | Mais simples e barato, porém sem vantagem competitiva em privacidade.                        |

**Programado agora:** categorias `social`, `work` e `desk` no banco e na interface;
empresas só existem em `desk`; transcrição de áudio **sob demanda** (botão), nunca
automática; resumo só com consentimento implícito do clique.
**Próximo passo:** cifrar `social` e `work` no aparelho (X3DH + Double Ratchet ou libsignal).

## 2. Liberdade de automação sem virar spam

**O problema.** "Zero ban" sem regras transforma a aba Atendimento em caixa de spam.

| Solução                                                                   | Viável? | Avaliação                                                                       |
| ------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| **A. Só entrada: empresa nunca inicia, apenas responde** (escolhida)      | Sim     | Elimina o spam na origem. Empresa é achada por `@dominio`, link ou QR code.      |
| **B. Limites por plano e bloqueio pelo usuário** (escolhida, complementar) | Sim     | Freia abuso sem punir uso legítimo. Bloqueio devolve o controle à pessoa.        |
| C. Opt-in por mensagem-modelo aprovada (como o WhatsApp)                  | Sim     | Burocrático, exige moderação humana; deixar para quando houver escala.           |
| D. Reputação e denúncias                                                  | Sim     | Bom complemento futuro (fase antiabuso do roteiro).                              |

**Programado agora:** `openDirectChat` rejeita empresas como iniciadoras; limite de envios
por hora por plano; bloqueio e desbloqueio; domínio verificado por DNS.

## 3. Descoberta de contatos sem expor o telefone (menor importância, mas decisiva para crescer)

**O problema.** O WhatsApp cresce pela agenda do celular. Sem telefone na identidade,
perdemos isso.

| Solução                                                                         | Viável? | Avaliação                                                                          |
| ------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| **A. Telefone privado e opcional só para descoberta entre pessoas** (escolhida) | Sim     | Amigos se encontram pela agenda; empresas nunca veem o número.                      |
| **B. `@usuário` + link e QR code de convite** (escolhida, complementar)         | Sim     | Funciona sem agenda, ideal para perfis públicos e comércio.                          |
| C. Descoberta por e-mail ou redes sociais                                       | Sim     | Útil depois, quando houver login por e-mail.                                         |

**Programado agora:** `discoverableByPhone` no perfil (padrão ligado, pode desligar),
busca por `@usuário`, sincronização da agenda devolve só quem permitiu, link de convite
`https://SEU-SERVIDOR/@usuario`.
