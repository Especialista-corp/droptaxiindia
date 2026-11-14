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
- [ ] 20. (Claude) Corrigir a lista de itens que o montador vê no pedido
- [ ] 21. (Claude) Admin abrir os documentos do montador no painel (comprovante e certidão)
- [ ] 22. (Claude) Testar o que ficou sem teste: cancelamento, recusa de proposta, “montador não apareceu” e ações do admin
- [ ] 23. (Claude) Gerar os ícones PNG para instalar o app no iPhone e no Android
- [ ] 24. (Dono) Testar o Beta em iPhone e Android reais, seguindo o roteiro, e anotar o que achar
- [ ] 25. (Claude) Corrigir os defeitos encontrados no teste do Beta
- [ ] 26. (Dono) Decidir se o Beta está aprovado para seguir às próximas etapas

## Etapa 5: Funcionalidades que faltam
- [ ] 27. (Claude) Fluxo de disputas: cliente abre, pagamento congela, admin resolve
- [ ] 28. (Claude) Trocar o mapa claro por mapa escuro

## Etapa 6: Qualidade e segurança
- [ ] 29. (Claude) Criar os testes automáticos do fluxo principal
- [ ] 30. (Claude) Revisão de segurança (acesso, ações do servidor, pagamento)
- [ ] 31. (Claude) Limpar a cópia antiga: pasta marketplace do droptaxiindia e a PR #1

## Etapa 7: Pagamentos (Asaas)
- [ ] 32. (Dono) Criar a conta Asaas sandbox e enviar a chave de API
- [ ] 33. (Claude) Testar cobrança Pix real no sandbox e o retorno automático (webhook)
- [ ] 34. (Claude) Implementar o repasse ao montador (subconta e divisão)
- [ ] 35. (Claude) Testar cancelamento e reembolso
- [ ] 36. (Dono) Abrir a conta Asaas de produção (documentos da empresa), cerca de 1 semana antes do piloto

## Etapa 8: Verificação de identidade e avisos ao admin (por último, depois do Beta)
- [ ] 37. (Dono) Criar a conta no Didit com o e-mail corporativo (business.didit.me) e me enviar a chave de API
- [ ] 38. (Claude) Integrar o Didit: link de verificação, retorno automático e leitura do resultado; testar CNH, RG, CIN e CNH digital no ambiente de teste
- [ ] 39. (Dono) Abrir a conta ou pedir a chave de teste da Validra
- [ ] 40. (Claude) Integrar a Validra como segundo provedor
- [ ] 41. (Dono) Abrir a conta ou pedir a chave de teste da BigDataCorp
- [ ] 42. (Claude) Integrar a BigDataCorp como terceiro provedor (ou só como consulta de CPF, se não oferecer captura)
- [ ] 43. (Claude) Painel do admin: chave liga/desliga por provedor, escolha do principal e contador de uso e custo
- [ ] 44. (Claude) Exigir CNH ou RG novo (CIN): explicar os modelos aceitos e fotografar só pela câmera do app, sem envio de arquivo
- [ ] 45. (Claude) Leitura automática (OCR) do documento e comparação com o nome e o CPF digitados
- [ ] 46. (Claude) Pontuação de risco por cadastro (CPF, nome x documento, telefone, placa e rosto repetidos)
- [ ] 47. (Claude) Mudar a aprovação: cadastro verde é aprovado sozinho; amarelo e vermelho esperam o admin; só aprovado recebe pedidos
- [ ] 48. (Claude) Guia na câmera: moldura, aviso de reflexo, borrão e pouca luz, e selfie segurando o documento
- [ ] 49. (Dono) Criar o bot do Telegram pelo @BotFather e me enviar o token
- [ ] 50. (Claude) Aviso no Telegram ao admin a cada cadastro, com dados, link seguro para as fotos e botões Aprovar e Reprovar
- [ ] 51. (Claude) Área do admin: botão para ligar o Telegram dele ao bot
- [ ] 52. (Claude) Vários admins no grupo do Telegram, com registro de quem aprovou e quando
- [ ] 53. (Claude) Reprovação com motivos em botões e mensagem automática ao montador explicando o que corrigir
- [ ] 54. (Claude) Lembrete de cadastro parado há mais de 24 horas e resumo diário ao admin
- [ ] 55. (Dono) Criar uma caixa de e-mail só para arquivar cadastros (ex.: cadastros@seu-domínio)
- [ ] 56. (Claude) E-mail de arquivo ao admin: título com nome, CPF e WhatsApp, dados do cadastro e cópias dos documentos
- [ ] 57. (Dono) Criar o número oficial de WhatsApp da empresa: um chip novo só para a plataforma, na WhatsApp Business Platform da Meta
- [ ] 58. (Claude) Resolver o nono dígito do WhatsApp: aceitar o número com e sem o 9 ao comparar e guardar sempre o formato completo
- [ ] 59. (Claude) Botão “Confirmar pelo WhatsApp”: a mensagem recebida no número oficial confirma o número de quem enviou
- [ ] 60. (Dono) Testar o botão Confirmar pelo WhatsApp com dois aparelhos reais (WhatsApp comum e Business)
- [ ] 61. (Dono) Contratar o serviço de mensagens para o código (SMS ou WhatsApp)
- [ ] 62. (Claude) Verificação do WhatsApp do montador por código (SMS ou WhatsApp)
- [ ] 63. (Claude) Avisar antes de a CNH e a certidão vencerem e reverificar uma vez por ano
- [ ] 64. (Claude) Subir a verificação de identidade para o Beta e liberar para o seu teste
- [ ] 65. (Dono) Testar a verificação de ponta a ponta (cadastro, documento, aprovação pelo Telegram, e-mail de arquivo) e aprovar

## Etapa 9: Lançamento
- [ ] 66. (Dono) Decidir o nome definitivo e consultar a marca no INPI
- [ ] 67. (Dono) Termos de uso e política de privacidade (LGPD)
- [ ] 68. (Claude) Guia de operação e lista de ideias da Fase 2
- [ ] 69. (Dono) Piloto com poucos montadores e clientes
- [ ] 70. (Dono) Decidir quando migrar para o plano pago do Supabase
- [ ] 71. (Dono) Reavaliar o Serpro Datavalid direto quando houver CNPJ e certificado e-CNPJ
