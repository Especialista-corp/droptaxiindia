# Pendências do MontaJá

Fonte da verdade do que falta fazer. Planilha equivalente: `docs/lista-de-tarefas.xlsx`.
Marque `[x]` ao concluir um passo e faça commit. "Dono" = depende do dono do projeto; "Claude" = o assistente faz.

## Gatilho "voltar onde paramos"

Quando o dono do projeto escrever **"voltar onde paramos"**, retome pelos passos da Etapa 1 e 2 que dependem dele:

1. Pedir a saída do diagnóstico da VPS (Hostinger, terminal do navegador):
   `docker ps -a; docker compose ls -a; docker network ls; df -h /; free -h`
2. Pedir as credenciais do projeto Supabase (Project URL, anon key, service_role key) e guiar a criação passo a passo.
3. Perguntar qual domínio usar no Cloudflare.
4. Se o dono já criou a conta no Didit, pedir a chave de API e iniciar a integração (primeiro provedor de verificação de identidade).

Nunca peça chaves no chat para serem guardadas no repositório: elas ficam só na VPS.

## Etapa 1: Banco de dados real (Supabase)
- [ ] 1. (Dono) Criar conta e projeto no Supabase (região São Paulo)
- [ ] 2. (Dono) Enviar Project URL, anon key e service_role key (por canal seguro)
- [ ] 3. (Claude) Aplicar as migrações 0001 a 0005 no projeto
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

## Etapa 3: Mapa e notificações
- [ ] 14. (Dono) Criar a chave do Google Maps
- [ ] 15. (Claude) Ligar o mapa ao vivo e testar com dois celulares
- [ ] 16. (Claude) Trocar o mapa claro por mapa escuro
- [ ] 17. (Dono) Criar a conta Resend e configurar o e-mail do domínio
- [ ] 18. (Claude) Testar notificações no celular e por e-mail
- [ ] 19. (Dono) Criar o bot do Telegram pelo @BotFather e me enviar o token
- [ ] 20. (Dono) Criar o número oficial de WhatsApp da empresa: um chip novo só para a plataforma, na WhatsApp Business Platform da Meta
- [ ] 21. (Dono) Criar uma caixa de e-mail só para arquivar cadastros (ex.: cadastros@seu-domínio)

## Etapa 4: Funcionalidades que faltam
- [ ] 22. (Claude) Fluxo de disputas: cliente abre, pagamento congela, admin resolve
- [ ] 23. (Claude) Revisão de documentos pelo admin: abrir comprovante e certidão no painel
- [ ] 24. (Dono) Criar a conta no Didit com o e-mail corporativo (business.didit.me) e me enviar a chave de API
- [ ] 25. (Claude) Integrar o Didit: link de verificação, retorno automático e leitura do resultado; testar CNH, RG, CIN e CNH digital no ambiente de teste
- [ ] 26. (Dono) Abrir a conta ou pedir a chave de teste da Validra
- [ ] 27. (Claude) Integrar a Validra como segundo provedor
- [ ] 28. (Dono) Abrir a conta ou pedir a chave de teste da BigDataCorp
- [ ] 29. (Claude) Integrar a BigDataCorp como terceiro provedor (ou só como consulta de CPF, se não oferecer captura)
- [ ] 30. (Claude) Painel do admin: chave liga/desliga por provedor, escolha do principal e contador de uso e custo
- [ ] 31. (Claude) Mudar a aprovação: cadastro verde é aprovado sozinho; amarelo e vermelho esperam o admin; só aprovado recebe pedidos
- [ ] 32. (Claude) Exigir CNH ou RG novo (CIN): explicar os modelos aceitos e fotografar só pela câmera do app, sem envio de arquivo
- [ ] 33. (Claude) Leitura automática (OCR) do documento e comparação com o nome e o CPF digitados
- [ ] 34. (Claude) Pontuação de risco por cadastro (CPF, nome x documento, telefone, placa e rosto repetidos)
- [ ] 35. (Claude) Aviso no Telegram ao admin a cada cadastro, com dados, link seguro para as fotos e botões Aprovar e Reprovar
- [ ] 36. (Claude) Área do admin: botão para ligar o Telegram dele ao bot
- [ ] 37. (Claude) Reprovação com motivos em botões e mensagem automática ao montador explicando o que corrigir
- [ ] 38. (Claude) Lembrete de cadastro parado há mais de 24 horas e resumo diário ao admin
- [ ] 39. (Claude) Guia na câmera: moldura, aviso de reflexo, borrão e pouca luz, e selfie segurando o documento
- [ ] 40. (Claude) Avisar antes de a CNH e a certidão vencerem e reverificar uma vez por ano
- [ ] 41. (Claude) Vários admins no grupo do Telegram, com registro de quem aprovou e quando
- [ ] 42. (Claude) Resolver o nono dígito do WhatsApp: aceitar o número com e sem o 9 ao comparar e guardar sempre o formato completo
- [ ] 43. (Dono) Testar o botão Confirmar pelo WhatsApp com dois aparelhos reais (WhatsApp comum e Business)
- [ ] 44. (Claude) Botão "Confirmar pelo WhatsApp": a mensagem recebida no número oficial confirma o número de quem enviou
- [ ] 45. (Claude) E-mail de arquivo ao admin: título com nome, CPF e WhatsApp, dados do cadastro e cópias dos documentos
- [ ] 46. (Claude) Corrigir a lista de itens que o montador vê no pedido
- [ ] 47. (Dono) Contratar o serviço de mensagens para o código (SMS ou WhatsApp)
- [ ] 48. (Claude) Verificação do WhatsApp do montador por código (SMS ou WhatsApp)
- [ ] 49. (Claude) Gerar os ícones PNG para iPhone e Android

## Etapa 5: Qualidade e segurança
- [ ] 50. (Claude) Criar os testes automáticos do fluxo principal
- [ ] 51. (Claude) Revisão de segurança (acesso, ações do servidor, pagamento)
- [ ] 52. (Dono) Testar em iPhone e Android reais
- [ ] 53. (Claude) Limpar a cópia antiga: pasta marketplace do droptaxiindia e a PR #1

## Etapa 6: Pagamentos (Asaas)
- [ ] 54. (Dono) Criar a conta Asaas sandbox e enviar a chave de API
- [ ] 55. (Claude) Testar cobrança Pix real no sandbox e o retorno automático (webhook)
- [ ] 56. (Claude) Implementar o repasse ao montador (subconta e divisão)
- [ ] 57. (Claude) Testar cancelamento e reembolso
- [ ] 58. (Dono) Abrir a conta Asaas de produção (documentos da empresa), cerca de 1 semana antes do piloto

## Etapa 7: Lançamento
- [ ] 59. (Dono) Decidir o nome definitivo e consultar a marca no INPI
- [ ] 60. (Dono) Termos de uso e política de privacidade (LGPD)
- [ ] 61. (Claude) Guia de operação e lista de ideias da Fase 2
- [ ] 62. (Dono) Piloto com poucos montadores e clientes
- [ ] 63. (Dono) Decidir quando migrar para o plano pago do Supabase
- [ ] 64. (Dono) Reavaliar o Serpro Datavalid direto quando houver CNPJ e certificado e-CNPJ
