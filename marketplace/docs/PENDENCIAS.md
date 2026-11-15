# Pendências do MontaJá

Fonte da verdade do que falta fazer. Planilha equivalente: `docs/lista-de-tarefas.xlsx`.
Marque `[x]` ao concluir um passo e faça commit. "Dono" = depende do dono do projeto; "Claude" = o assistente faz.

## Gatilho "voltar onde paramos"

Quando o dono do projeto escrever **"voltar onde paramos"**, retome pelos passos da Etapa 1 e 2 que dependem dele:

1. Pedir a saída do diagnóstico da VPS (Hostinger, terminal do navegador):
   `docker ps -a; docker compose ls -a; docker network ls; df -h /; free -h`
2. Pedir as credenciais do projeto Supabase (Project URL, anon key, service_role key) e guiar a criação passo a passo.
3. Perguntar qual domínio usar no Cloudflare.
Observação: a verificação de identidade (Didit, Validra, BigDataCorp, Telegram, e-mail de arquivo, WhatsApp) fica por último, depois de o dono testar o Beta.

Nunca peça chaves no chat para serem guardadas no repositório: elas ficam só na VPS.

## Etapa 1: Banco de dados real (Supabase)
- [ ] 1. (Dono) Criar conta e projeto no Supabase (região São Paulo)
- [ ] 2. (Dono) Enviar Project URL, anon key e service_role key (por canal seguro)
- [ ] 3. (Claude) Aplicar as migrações 0001 a 0006 no projeto
- [ ] 4. (Claude) Conferir regras de acesso (RLS) e as pastas privadas de fotos
- [ ] 5. (Claude) Criar o primeiro usuário administrador
- [ ] 6. (Claude) Definir o backup do banco de dados real
- [ ] 7. (Claude) Configurar o Supabase: ligar a confirmação de e-mail, definir o Site URL e colar o modelo de e-mail em português

## Etapa 2: Servidor (VPS Hostinger + Cloudflare)
- [ ] 8. (Dono) Rodar o diagnóstico na VPS e colar o resultado
- [ ] 9. (Dono) Escolher o domínio e apontá-lo pelo Cloudflare
- [ ] 10. (Claude) Gerar CRON_SECRET e chaves de notificação (VAPID) e montar a configuração
- [ ] 11. (Claude) Preparar Docker Compose com Traefik e HTTPS
- [ ] 12. (Claude) Subir o app e o agendador de tarefas
- [ ] 13. (Claude) Repetir o ciclo completo no endereço real

## Etapa 3: Mapa e e-mail para o Beta
- [ ] 14. (Dono) Criar a chave do Google Maps
- [ ] 15. (Claude) Ligar o mapa ao vivo e testar com dois celulares
- [ ] 16. (Dono) Criar a conta Resend e configurar o e-mail do domínio
- [ ] 17. (Claude) Testar notificações no celular e por e-mail

## Etapa 4: Beta: testes e correções
- [ ] 18. (Claude) Marcar o ambiente como Beta: faixa “Versão Beta” no app e aviso de que os pagamentos são simulados
- [ ] 19. (Claude) Criar contas de teste (cliente, montador e admin) e um roteiro de teste em português para você seguir
- [ ] 20. (Claude) Novo cadastro do cliente: nome completo, WhatsApp, e-mail, senha com confirmação, CEP com endereço automático, número, tipo de local (casa, apartamento ou empresa; em condomínio ou não), CPF ou CNPJ validado e aceite dos termos (18 anos)
- [ ] 21. (Claude) Pedir ao cliente e ao montador a permissão de notificações no momento certo, com explicação antes do pedido do sistema
- [ ] 22. (Claude) Guia para instalar o app na tela inicial do iPhone, necessário para receber notificações
- [ ] 23. (Claude) Corrigir a lista de itens que o montador vê no pedido
- [ ] 24. (Claude) Admin abrir os documentos do montador no painel (comprovante e certidão)
- [ ] 25. (Claude) Testar o que ficou sem teste: cancelamento, recusa de proposta, “montador não apareceu” e ações do admin
- [ ] 26. (Claude) Gerar os ícones PNG para instalar o app no iPhone e no Android
- [ ] 27. (Claude) Avisar o cliente quando o montador iniciar o deslocamento (notificação no celular e e-mail, com link para o mapa)
- [ ] 28. (Claude) Avisar o cliente quando o montador chegar ao local
- [ ] 29. (Claude) Aviso na tela do montador: manter o app aberto e a tela ligada durante o deslocamento (impedir a tela de apagar quando possível)
- [ ] 30. (Claude) Tempo estimado de chegada no mapa (“chega em X min”): levantar o custo do serviço do Google Maps e implementar se couber
- [ ] 31. (Dono) Testar o Beta em iPhone e Android reais, seguindo o roteiro, e anotar o que achar
- [ ] 32. (Claude) Corrigir os defeitos encontrados no teste do Beta
- [ ] 33. (Dono) Decidir se o Beta está aprovado para seguir às próximas etapas

## Etapa 5: Funcionalidades que faltam
- [ ] 34. (Claude) Fluxo de disputas: cliente abre, pagamento congela, admin resolve
- [ ] 35. (Claude) Trocar o mapa claro por mapa escuro

## Etapa 6: Qualidade e segurança
- [ ] 36. (Claude) Criar os testes automáticos do fluxo principal
- [ ] 37. (Claude) Revisão de segurança (acesso, ações do servidor, pagamento)
- [ ] 38. (Claude) Limpar a cópia antiga: pasta marketplace do droptaxiindia e a PR #1

## Etapa 7: Pagamentos (Asaas)
- [ ] 39. (Dono) Criar a conta Asaas sandbox e enviar a chave de API
- [ ] 40. (Claude) Testar cobrança Pix real no sandbox e o retorno automático (webhook)
- [ ] 41. (Claude) Implementar o repasse ao montador (subconta e divisão)
- [ ] 42. (Claude) Testar cancelamento e reembolso
- [ ] 43. (Dono) Abrir a conta Asaas de produção (documentos da empresa), cerca de 1 semana antes do piloto

## Etapa 8: Verificação de identidade e avisos ao admin (por último, depois do Beta)
- [ ] 44. (Dono) Criar a conta no Didit com o e-mail corporativo (business.didit.me) e me enviar a chave de API
- [ ] 45. (Claude) Integrar o Didit: link de verificação, retorno automático e leitura do resultado; testar CNH, RG, CIN e CNH digital no ambiente de teste
- [ ] 46. (Dono) Abrir a conta ou pedir a chave de teste da Validra
- [ ] 47. (Claude) Integrar a Validra como segundo provedor
- [ ] 48. (Dono) Abrir a conta ou pedir a chave de teste da BigDataCorp
- [ ] 49. (Claude) Integrar a BigDataCorp como terceiro provedor (ou só como consulta de CPF, se não oferecer captura)
- [ ] 50. (Claude) Painel do admin: chave liga/desliga por provedor, escolha do principal e contador de uso e custo
- [ ] 51. (Claude) Exigir CNH ou RG novo (CIN): explicar os modelos aceitos e fotografar só pela câmera do app, sem envio de arquivo
- [ ] 52. (Claude) Leitura automática (OCR) do documento e comparação com o nome e o CPF digitados
- [ ] 53. (Claude) Pontuação de risco por cadastro (CPF, nome x documento, telefone, placa e rosto repetidos)
- [ ] 54. (Claude) Mudar a aprovação: cadastro verde é aprovado sozinho; amarelo e vermelho esperam o admin; só aprovado recebe pedidos
- [ ] 55. (Claude) Guia na câmera: moldura, aviso de reflexo, borrão e pouca luz, e selfie segurando o documento
- [ ] 56. (Dono) Criar o bot do Telegram pelo @BotFather e me enviar o token
- [ ] 57. (Claude) Aviso no Telegram ao admin a cada cadastro, com dados, link seguro para as fotos e botões Aprovar e Reprovar
- [ ] 58. (Claude) Área do admin: botão para ligar o Telegram dele ao bot
- [ ] 59. (Claude) Vários admins no grupo do Telegram, com registro de quem aprovou e quando
- [ ] 60. (Claude) Reprovação com motivos em botões e mensagem automática ao montador explicando o que corrigir
- [ ] 61. (Claude) Lembrete de cadastro parado há mais de 24 horas e resumo diário ao admin
- [ ] 62. (Dono) Criar uma caixa de e-mail só para arquivar cadastros (ex.: cadastros@seu-domínio)
- [ ] 63. (Claude) E-mail de arquivo ao admin: título com nome, CPF e WhatsApp, dados do cadastro e cópias dos documentos
- [ ] 64. (Dono) Criar o número oficial de WhatsApp da empresa: um chip novo só para a plataforma, na WhatsApp Business Platform da Meta
- [ ] 65. (Claude) Resolver o nono dígito do WhatsApp: aceitar o número com e sem o 9 ao comparar e guardar sempre o formato completo
- [ ] 66. (Claude) Botão “Confirmar pelo WhatsApp”: a mensagem recebida no número oficial confirma o número de quem enviou
- [ ] 67. (Dono) Testar o botão Confirmar pelo WhatsApp com dois aparelhos reais (WhatsApp comum e Business)
- [ ] 68. (Dono) Contratar o serviço de mensagens para o código (SMS ou WhatsApp)
- [ ] 69. (Claude) Verificação do WhatsApp do montador por código (SMS ou WhatsApp)
- [ ] 70. (Claude) Estender ao cliente a verificação do WhatsApp por código
- [ ] 71. (Claude) Avisar antes de a CNH e a certidão vencerem e reverificar uma vez por ano
- [ ] 72. (Claude) Caixa de consentimento no pedido para o cliente autorizar receber mensagens por WhatsApp
- [ ] 73. (Dono) Aprovar na Meta os modelos de mensagem do WhatsApp (“montador saiu” e “montador chegou”)
- [ ] 74. (Claude) Aviso por WhatsApp ao cliente quando o montador sair e quando chegar, com link para o app
- [ ] 75. (Claude) Subir a verificação de identidade para o Beta e liberar para o seu teste
- [ ] 76. (Dono) Testar a verificação de ponta a ponta (cadastro, documento, aprovação pelo Telegram, e-mail de arquivo) e aprovar

## Etapa 9: Lançamento
- [ ] 77. (Dono) Decidir o nome definitivo e consultar a marca no INPI
- [ ] 78. (Dono) Termos de uso e política de privacidade (LGPD)
- [ ] 79. (Claude) Guia de operação e lista de ideias da Fase 2
- [ ] 80. (Dono) Piloto com poucos montadores e clientes
- [ ] 81. (Dono) Decidir quando migrar para o plano pago do Supabase
- [ ] 82. (Dono) Reavaliar o Serpro Datavalid direto quando houver CNPJ e certificado e-CNPJ
- [ ] 83. (Dono) Avaliar um app de loja (Android e iPhone) para o rastreamento funcionar com a tela apagada, como no Uber
